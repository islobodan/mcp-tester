/**
 * Tests for secret masking utilities.
 */

import {
  maskSecrets,
  maskValue,
  addSecretPattern,
  resetSecretPatterns,
  getSecretPatterns,
  getSensitiveEnvKeys,
} from '../utils/masking.js';
import { describe, it, expect, beforeEach } from '@jest/globals';

describe('maskValue', () => {
  it('should mask long values with visible prefix and suffix', () => {
    expect(maskValue('sk-abc123def456ghi789')).toBe('sk-...789');
  });

  it('should return *** for short values', () => {
    expect(maskValue('ab')).toBe('***');
    expect(maskValue('abc')).toBe('***');
    expect(maskValue('abcdefg')).toBe('***');
    expect(maskValue('abcdefgh')).toBe('***');
    expect(maskValue('abcdefghi')).toBe('***');
  });

  it('should mask values that are just barely long enough', () => {
    // length 10 = 3 (start) + 3 (end) + 3 (...) = shows start...end
    expect(maskValue('abcdefghij')).toBe('abc...hij');
  });

  it('should handle empty string', () => {
    expect(maskValue('')).toBe('***');
  });

  it('should respect custom visibleChars', () => {
    expect(maskValue('sk-abc123def456ghi789jkl', 4)).toBe('sk-a...9jkl');
    expect(maskValue('sk-abc123def456ghi789jkl', 0)).toBe('***');
  });
});

describe('maskSecrets', () => {
  beforeEach(() => {
    resetSecretPatterns();
  });

  it('should pass through non-sensitive strings unchanged', () => {
    expect(maskSecrets('Hello, world!')).toBe('Hello, world!');
    expect(maskSecrets('No secrets here')).toBe('No secrets here');
  });

  it('should handle null and undefined', () => {
    expect(maskSecrets(null)).toBe('null');
    expect(maskSecrets(undefined)).toBe('undefined');
  });

  it('should handle non-string input', () => {
    expect(maskSecrets(42)).toBe('42');
    expect(maskSecrets(true)).toBe('true');
  });

  // OpenAI keys
  it('should mask OpenAI-style API keys', () => {
    const key = 'sk-proj-abcdefghijklmnopqrstuvwxyz1234567890';
    const result = maskSecrets(`Using key ${key} for API`);
    expect(result).not.toContain(key);
  });

  // Anthropic keys
  it('should mask Anthropic-style API keys', () => {
    const key = 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890';
    const result = maskSecrets(`Key: ${key}`);
    expect(result).not.toContain(key);
  });

  // AWS keys
  it('should mask AWS access keys', () => {
    const result = maskSecrets('AWS key: AKIAIOSFODNN7EXAMPLE');
    expect(result).not.toContain('AKIAIOSFODNN7EXAMPLE');
  });

  // Bearer tokens
  it('should mask bearer tokens', () => {
    const result = maskSecrets(
      'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.XMBSER'
    );
    expect(result).not.toContain('eyJhbGciOiJIUzI1NiJ9');
  });

  // Hex tokens
  it('should mask long hex tokens', () => {
    const hex = 'abcdef0123456789abcdef0123456789abcdef0123456789a';
    const result = maskSecrets(`token=${hex}`);
    expect(result).not.toContain(hex);
  });

  // JWT tokens
  it('should mask JWT-style tokens', () => {
    const result = maskSecrets('token: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.XMBSER');
    expect(result).not.toBe('token: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.XMBSER');
  });

  // URL credentials
  it('should mask URL credentials', () => {
    const result = maskSecrets('mongodb://admin:supersecretpass@cluster.example.com:27017');
    expect(result).not.toContain('supersecretpass');
    expect(result).toContain('...com');
  });

  // Key-value patterns
  it('should mask password in key=value patterns', () => {
    const result = maskSecrets('password=mysecretpassword123');
    expect(result).not.toContain('mysecretpassword123');
  });

  it('should mask token in key=value patterns', () => {
    const result = maskSecrets('TOKEN=abc123def456ghi789jkl012');
    expect(result).not.toContain('abc123def456ghi789jkl012');
  });

  it('should mask secrets in key: value patterns', () => {
    const key = 'sk-proj-abcdefghijklmnopqrstuvwxyz1234567890';
    const result = maskSecrets(`api_key: "${key}"`);
    expect(result).not.toContain(key);
  });

  // Sensitive environment variable names
  it('should mask values of sensitive env vars', () => {
    expect(maskSecrets('API_KEY=my_secret_value_here')).toContain('API_KEY=***');
    expect(maskSecrets('PASSWORD=hunter42abcd')).not.toContain('hunter42abcd');
    expect(maskSecrets('DATABASE_URL=postgres://user:pass@host')).not.toContain(
      'postgres://user:pass@host'
    );
    expect(maskSecrets('OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz')).not.toContain(
      'abcdefghijklmnopqrstuvwxyz'
    );
  });

  it('should NOT mask non-sensitive env vars', () => {
    expect(maskSecrets('NODE_ENV=production')).toBe('NODE_ENV=production');
    expect(maskSecrets('PORT=3000')).toBe('PORT=3000');
    expect(maskSecrets('HOME=/Users/test')).toBe('HOME=/Users/test');
  });

  it('should mask multiple secrets in one string', () => {
    const openai_key = 'sk-proj-abcdefghijklmnopqrstuvwxyz1234567890';
    const aws_key = 'AKIAIOSFODNN7EXAMPLE';
    const input = `key1=${openai_key} key2=${aws_key}`;
    const result = maskSecrets(input);
    expect(result).not.toContain(openai_key);
    expect(result).not.toContain(aws_key);
  });
});

describe('addSecretPattern', () => {
  beforeEach(() => {
    resetSecretPatterns();
  });

  it('should add a custom secret pattern', () => {
    addSecretPattern(/my-org-key-[a-zA-Z0-9]{20,}/g, 'MyOrg API key');
    const input = 'Using my-org-key-abcdefghijklmnopqrstuvwxyz1234567890 now';
    const result = maskSecrets(input);
    expect(result).not.toContain('abcdefghijklmnopqrstuvwxyz1234567890');
  });

  it('should appear in getSecretPatterns', () => {
    addSecretPattern(/custom-pattern-\d+/g, 'Custom pattern');
    const patterns = getSecretPatterns();
    const customPattern = patterns.find((p) => p.name === 'Custom pattern');
    expect(customPattern).toBeDefined();
    expect(customPattern!.name).toBe('Custom pattern');
  });

  it('should not affect built-in patterns', () => {
    const beforeCount = getSecretPatterns().length;
    addSecretPattern(/custom/g, 'Custom');
    expect(getSecretPatterns().length).toBe(beforeCount + 1);
  });
});

describe('resetSecretPatterns', () => {
  it('should reset to default patterns', () => {
    addSecretPattern(/custom/g, 'Custom');
    expect(getSecretPatterns().length).toBeGreaterThan(8);
    resetSecretPatterns();
    expect(getSecretPatterns().length).toBe(8);
  });
});

describe('getSensitiveEnvKeys', () => {
  it('should include common sensitive keys', () => {
    const keys = getSensitiveEnvKeys();
    expect(keys.has('API_KEY')).toBe(true);
    expect(keys.has('PASSWORD')).toBe(true);
    expect(keys.has('TOKEN')).toBe(true);
    expect(keys.has('DATABASE_URL')).toBe(true);
    expect(keys.has('AWS_SECRET_ACCESS_KEY')).toBe(true);
    expect(keys.has('OPENAI_API_KEY')).toBe(true);
    expect(keys.has('ANTHROPIC_API_KEY')).toBe(true);
  });

  it('should not include non-sensitive keys', () => {
    const keys = getSensitiveEnvKeys();
    expect(keys.has('NODE_ENV')).toBe(false);
    expect(keys.has('PORT')).toBe(false);
    expect(keys.has('HOME')).toBe(false);
    expect(keys.has('PATH')).toBe(false);
  });
});

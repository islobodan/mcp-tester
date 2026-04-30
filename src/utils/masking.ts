/**
 * Secret masking utility for preventing sensitive data from appearing in logs.
 *
 * Automatically detects and masks common secret patterns like API keys,
 * tokens, passwords, and connection strings. Also masks values of known
 * sensitive environment variable keys.
 *
 * @example
 * ```typescript
 * import { maskSecrets, addSecretPattern } from '@slbdn/mcp-tester';
 *
 * // Built-in patterns are applied automatically
 * maskSecrets('API key: sk-abc123def456ghi789');
 * // → 'API key: sk-ab...789'
 *
 * // Add custom patterns
 * addSecretPattern(/my-secret-key-[a-zA-Z0-9]+/g, 'MyOrg API key');
 * ```
 */

/**
 * A secret masking pattern with a regex and human-readable name.
 */
export interface SecretPattern {
  /** Regex pattern to match secrets. */
  pattern: RegExp;
  /** Human-readable name for the pattern (used in diagnostics). */
  name: string;
}

/**
 * Environment variable keys that commonly contain secrets.
 * Values for these keys will be masked in log output.
 */
const SENSITIVE_ENV_KEYS: ReadonlySet<string> = new Set([
  'API_KEY',
  'API_SECRET',
  'SECRET_KEY',
  'SECRET',
  'PRIVATE_KEY',
  'ACCESS_KEY',
  'ACCESS_TOKEN',
  'ACCESS_SECRET',
  'AUTH_TOKEN',
  'AUTHORIZATION',
  'BEARER_TOKEN',
  'TOKEN',
  'REFRESH_TOKEN',
  'SESSION_TOKEN',
  'SESSION_ID',
  'ID_TOKEN',
  'PASSWORD',
  'PASSWD',
  'DB_PASSWORD',
  'DATABASE_PASSWORD',
  'REDIS_PASSWORD',
  'MONGO_PASSWORD',
  'DATABASE_URL',
  'DB_URL',
  'MONGODB_URI',
  'POSTGRES_URL',
  'MYSQL_URL',
  'REDIS_URL',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SESSION_TOKEN',
  'AZURE_CLIENT_SECRET',
  'GCP_API_KEY',
  'GOOGLE_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GITHUB_TOKEN',
  'GITLAB_TOKEN',
  'NPM_TOKEN',
  'NPM_AUTH_TOKEN',
  'SLACK_TOKEN',
  'SLACK_WEBHOOK',
  'SENTRY_DSN',
  'ENCRYPTION_KEY',
  'SIGNING_KEY',
  'JWT_SECRET',
  'CSRF_SECRET',
  'APP_SECRET',
]);

const OPENAI_KEY_REGEX = /\bsk-(?:proj|ant)-[a-zA-Z0-9_-]{10,}/g;
const SK_KEY_REGEX = /\bsk-[a-zA-Z0-9]{12,}/g;
const AWS_KEY_REGEX = /\bAKIA[A-Z0-9]{16}\b/g;
const BEARER_REGEX = /\bBearer\s+[a-zA-Z0-9._-]{8,}/gi;
const JWT_REGEX = /\beyJ[a-zA-Z0-9_-]{10,}/g;
const HEX_REGEX = /\b[a-f0-9]{40,}\b/g;
const URL_CREDS_REGEX = /:[a-zA-Z0-9._-]{4,}@[a-zA-Z0-9.-]+/g;
const KV_REGEX =
  /\b(?:password|passwd|secret|token|key|auth|credential)s?\s*[:=]\s*["']?[a-zA-Z0-9._/@+-]{8,}["']?/gi;

/**
 * Built-in secret patterns that are automatically masked.
 */
const DEFAULT_SECRET_PATTERNS: SecretPattern[] = [
  { pattern: OPENAI_KEY_REGEX, name: 'OpenAI/Anthropic API key' },
  { pattern: SK_KEY_REGEX, name: 'API key (sk-)' },
  { pattern: AWS_KEY_REGEX, name: 'AWS access key' },
  { pattern: BEARER_REGEX, name: 'Bearer token' },
  { pattern: JWT_REGEX, name: 'JWT token' },
  { pattern: HEX_REGEX, name: 'Hex token' },
  { pattern: URL_CREDS_REGEX, name: 'URL credentials' },
  { pattern: KV_REGEX, name: 'Key-value secret' },
];

/** Active secret patterns (built-in + user-added). */
let activePatterns: SecretPattern[] = [...DEFAULT_SECRET_PATTERNS];

/** Number of characters to keep visible at start/end when masking. */
const VISIBLE_CHARS = 3;

/**
 * Mask a string value, keeping the first few and last few characters visible
 * and replacing the rest with `...`.
 *
 * @param value - The secret value to mask
 * @param visibleChars - How many characters to keep visible at start and end
 * @returns Masked string like "sk-ab...789"
 */
export function maskValue(value: string, visibleChars: number = VISIBLE_CHARS): string {
  if (visibleChars <= 0 || value.length <= visibleChars * 2 + 3) {
    return '***';
  }
  const start = value.slice(0, visibleChars);
  const end = value.slice(-visibleChars);
  return `${start}...${end}`;
}

/**
 * Mask secrets in a string by applying all active secret patterns
 * and masking values of known sensitive environment variable keys.
 *
 * @param input - The value to mask (any type — converted to string)
 * @returns String with secrets replaced by masked versions
 */
export function maskSecrets(input: unknown): string {
  if (input === null || input === undefined) {
    return String(input);
  }

  let result = String(input);

  // 1. First mask values of known sensitive environment variable keys
  //    Matches: KEY=value, KEY="value", KEY: value, KEY: "value"
  result = result.replace(
    /\b([A-Z_][A-Z0-9_]{2,})(\s*[:=]\s*)(["']?)([^\s"']{4,})\3/g,
    (_match, key, separator, quote, _value) => {
      if (SENSITIVE_ENV_KEYS.has(key.toUpperCase())) {
        return `${key}${separator}${quote}***${quote}`;
      }
      return _match;
    }
  );

  // 2. Then apply built-in and user-added secret patterns
  for (const { pattern } of activePatterns) {
    // Create fresh regex to avoid lastIndex issues from global flag
    const regex = new RegExp(pattern.source, pattern.flags);
    result = result.replace(regex, (match) => maskValue(match));
  }

  return result;
}

/**
 * Add a custom secret pattern to the masking rules.
 *
 * @param pattern - Regex pattern to match secrets
 * @param name - Human-readable name for the pattern
 */
export function addSecretPattern(pattern: RegExp, name: string = 'custom'): void {
  activePatterns.push({ pattern, name });
}

/**
 * Reset all secret patterns to the built-in defaults.
 * Removes any patterns added via `addSecretPattern()`.
 */
export function resetSecretPatterns(): void {
  activePatterns = [...DEFAULT_SECRET_PATTERNS];
}

/**
 * Get the list of currently active secret patterns.
 */
export function getSecretPatterns(): SecretPattern[] {
  return [...activePatterns];
}

/**
 * Get the set of sensitive environment variable key names.
 */
export function getSensitiveEnvKeys(): ReadonlySet<string> {
  return SENSITIVE_ENV_KEYS;
}

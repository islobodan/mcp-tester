import { describe, it, expect } from '@jest/globals';
import {
  validateServerConfig,
  validateToolCallOptions,
  validateResourceUri,
  validatePromptName,
  validatePromptArgs,
  validateSamplingRequest,
  validateClientOptions,
} from '../utils/validation.js';
import { MCPClientError } from '../utils/errors.js';
import { MCPClient } from '../client/MCPClient.js';

describe('Input Validation', () => {
  // ─── validateServerConfig ───────────────────────────────────────────────

  describe('validateServerConfig', () => {
    it('should accept valid config', () => {
      expect(() => validateServerConfig({ command: 'node' })).not.toThrow();
      expect(() => validateServerConfig({ command: 'node', args: ['./server.js'] })).not.toThrow();
      expect(() =>
        validateServerConfig({
          command: 'node',
          args: ['./server.js'],
          env: { NODE_ENV: 'test' },
          startupDelay: 1000,
        })
      ).not.toThrow();
    });

    it('should reject null config', () => {
      expect(() => validateServerConfig(null)).toThrow(MCPClientError);
      expect(() => validateServerConfig(null)).toThrow('required');
    });

    it('should reject undefined config', () => {
      expect(() => validateServerConfig(undefined)).toThrow(MCPClientError);
    });

    it('should reject non-object config', () => {
      expect(() => validateServerConfig('node')).toThrow('must be an object');
      expect(() => validateServerConfig(42)).toThrow('must be an object');
      expect(() => validateServerConfig(true)).toThrow('must be an object');
    });

    it('should reject array config', () => {
      expect(() => validateServerConfig(['node'])).toThrow('must be an object');
    });

    it('should reject missing command', () => {
      expect(() => validateServerConfig({})).toThrow('command is required');
    });

    it('should reject undefined command', () => {
      expect(() => validateServerConfig({ command: undefined })).toThrow('command is required');
    });

    it('should reject null command', () => {
      expect(() => validateServerConfig({ command: null })).toThrow('command is required');
    });

    it('should reject non-string command', () => {
      expect(() => validateServerConfig({ command: 42 })).toThrow('must be a string');
      expect(() => validateServerConfig({ command: true })).toThrow('must be a string');
    });

    it('should reject empty command', () => {
      expect(() => validateServerConfig({ command: '' })).toThrow('cannot be empty');
      expect(() => validateServerConfig({ command: '   ' })).toThrow('cannot be empty');
    });

    it('should reject non-array args', () => {
      expect(() => validateServerConfig({ command: 'node', args: 'server.js' })).toThrow(
        'must be an array'
      );
      expect(() => validateServerConfig({ command: 'node', args: 42 })).toThrow('must be an array');
    });

    it('should reject non-string args items', () => {
      expect(() => validateServerConfig({ command: 'node', args: [42] })).toThrow(
        'args[0] must be a string'
      );
      expect(() => validateServerConfig({ command: 'node', args: ['ok', 123] })).toThrow(
        'args[1] must be a string'
      );
    });

    it('should reject non-object env', () => {
      expect(() => validateServerConfig({ command: 'node', env: 'bad' })).toThrow(
        'env must be an object'
      );
      expect(() => validateServerConfig({ command: 'node', env: ['bad'] })).toThrow(
        'env must be an object'
      );
      expect(() => validateServerConfig({ command: 'node', env: null })).toThrow(
        'env must be an object'
      );
    });

    it('should reject non-string env values', () => {
      expect(() => validateServerConfig({ command: 'node', env: { KEY: 42 } })).toThrow(
        'must be a string or undefined'
      );
      expect(() => validateServerConfig({ command: 'node', env: { KEY: true } })).toThrow(
        'must be a string or undefined'
      );
    });

    it('should allow undefined env values', () => {
      expect(() =>
        validateServerConfig({ command: 'node', env: { KEY: undefined } })
      ).not.toThrow();
    });

    it('should reject non-number startupDelay', () => {
      expect(() => validateServerConfig({ command: 'node', startupDelay: 'slow' })).toThrow(
        'startupDelay must be a number'
      );
    });

    it('should reject NaN startupDelay', () => {
      expect(() => validateServerConfig({ command: 'node', startupDelay: NaN })).toThrow(
        'startupDelay must be a number'
      );
    });

    it('should reject negative startupDelay', () => {
      expect(() => validateServerConfig({ command: 'node', startupDelay: -100 })).toThrow(
        'startupDelay must be non-negative'
      );
    });

    it('should accept zero startupDelay', () => {
      expect(() => validateServerConfig({ command: 'node', startupDelay: 0 })).not.toThrow();
    });
  });

  // ─── validateToolCallOptions ────────────────────────────────────────────

  describe('validateToolCallOptions', () => {
    it('should accept valid options', () => {
      expect(() => validateToolCallOptions({ name: 'echo' })).not.toThrow();
      expect(() =>
        validateToolCallOptions({ name: 'echo', arguments: { msg: 'hi' } })
      ).not.toThrow();
      expect(() =>
        validateToolCallOptions({ name: 'echo', arguments: {}, timeout: 5000, retries: 3 })
      ).not.toThrow();
    });

    it('should reject null options', () => {
      expect(() => validateToolCallOptions(null)).toThrow(MCPClientError);
      expect(() => validateToolCallOptions(null)).toThrow('required');
    });

    it('should reject undefined options', () => {
      expect(() => validateToolCallOptions(undefined)).toThrow('required');
    });

    it('should reject non-object options', () => {
      expect(() => validateToolCallOptions('echo')).toThrow('must be an object');
    });

    it('should reject missing name', () => {
      expect(() => validateToolCallOptions({})).toThrow('name is required');
    });

    it('should reject null name', () => {
      expect(() => validateToolCallOptions({ name: null })).toThrow('name is required');
    });

    it('should reject non-string name', () => {
      expect(() => validateToolCallOptions({ name: 42 })).toThrow('must be a string');
    });

    it('should reject empty name', () => {
      expect(() => validateToolCallOptions({ name: '' })).toThrow('cannot be empty');
      expect(() => validateToolCallOptions({ name: '  ' })).toThrow('cannot be empty');
    });

    it('should reject null arguments', () => {
      expect(() => validateToolCallOptions({ name: 'echo', arguments: null })).toThrow(
        'must be an object'
      );
    });

    it('should reject array arguments', () => {
      expect(() => validateToolCallOptions({ name: 'echo', arguments: ['a'] })).toThrow(
        'must be an object'
      );
    });

    it('should reject non-number timeout', () => {
      expect(() => validateToolCallOptions({ name: 'echo', timeout: 'slow' })).toThrow(
        'timeout must be a number'
      );
    });

    it('should reject zero timeout', () => {
      expect(() => validateToolCallOptions({ name: 'echo', timeout: 0 })).toThrow(
        'timeout must be positive'
      );
    });

    it('should reject negative timeout', () => {
      expect(() => validateToolCallOptions({ name: 'echo', timeout: -1 })).toThrow(
        'timeout must be positive'
      );
    });

    it('should reject NaN timeout', () => {
      expect(() => validateToolCallOptions({ name: 'echo', timeout: NaN })).toThrow(
        'timeout must be a number'
      );
    });

    it('should reject negative retries', () => {
      expect(() => validateToolCallOptions({ name: 'echo', retries: -1 })).toThrow(
        'retries must be non-negative'
      );
    });

    it('should accept zero retries', () => {
      expect(() => validateToolCallOptions({ name: 'echo', retries: 0 })).not.toThrow();
    });
  });

  // ─── validateResourceUri ────────────────────────────────────────────────

  describe('validateResourceUri', () => {
    it('should accept valid URIs', () => {
      expect(() => validateResourceUri('config://settings')).not.toThrow();
      expect(() => validateResourceUri('file:///path/to/resource')).not.toThrow();
      expect(() => validateResourceUri('https://example.com/data')).not.toThrow();
      expect(() => validateResourceUri('custom://anything')).not.toThrow();
    });

    it('should reject undefined', () => {
      expect(() => validateResourceUri(undefined)).toThrow('required');
    });

    it('should reject null', () => {
      expect(() => validateResourceUri(null)).toThrow('required');
    });

    it('should reject non-string', () => {
      expect(() => validateResourceUri(42)).toThrow('must be a string');
      expect(() => validateResourceUri({})).toThrow('must be a string');
    });

    it('should reject empty string', () => {
      expect(() => validateResourceUri('')).toThrow('cannot be empty');
      expect(() => validateResourceUri('   ')).toThrow('cannot be empty');
    });
  });

  // ─── validatePromptName ─────────────────────────────────────────────────

  describe('validatePromptName', () => {
    it('should accept valid names', () => {
      expect(() => validatePromptName('greet')).not.toThrow();
      expect(() => validatePromptName('summarize')).not.toThrow();
    });

    it('should reject undefined', () => {
      expect(() => validatePromptName(undefined)).toThrow('required');
    });

    it('should reject null', () => {
      expect(() => validatePromptName(null)).toThrow('required');
    });

    it('should reject non-string', () => {
      expect(() => validatePromptName(42)).toThrow('must be a string');
    });

    it('should reject empty string', () => {
      expect(() => validatePromptName('')).toThrow('cannot be empty');
      expect(() => validatePromptName('  ')).toThrow('cannot be empty');
    });
  });

  // ─── validatePromptArgs ─────────────────────────────────────────────────

  describe('validatePromptArgs', () => {
    it('should accept undefined (optional)', () => {
      expect(() => validatePromptArgs(undefined)).not.toThrow();
    });

    it('should accept null (optional)', () => {
      expect(() => validatePromptArgs(null)).not.toThrow();
    });

    it('should accept valid string args', () => {
      expect(() => validatePromptArgs({ name: 'Alice' })).not.toThrow();
      expect(() => validatePromptArgs({ name: 'Alice', lang: 'en' })).not.toThrow();
    });

    it('should accept empty object', () => {
      expect(() => validatePromptArgs({})).not.toThrow();
    });

    it('should reject non-object', () => {
      expect(() => validatePromptArgs('bad')).toThrow('must be an object');
      expect(() => validatePromptArgs(42)).toThrow('must be an object');
    });

    it('should reject array', () => {
      expect(() => validatePromptArgs(['a'])).toThrow('must be an object');
    });

    it('should reject non-string values', () => {
      expect(() => validatePromptArgs({ name: 42 })).toThrow('must be a string');
      expect(() => validatePromptArgs({ name: 'ok', count: true })).toThrow('must be a string');
    });
  });

  // ─── validateSamplingRequest ────────────────────────────────────────────

  describe('validateSamplingRequest', () => {
    it('should accept valid request', () => {
      expect(() =>
        validateSamplingRequest({
          messages: [{ role: 'user', content: { type: 'text', text: 'Hello' } }],
          maxTokens: 100,
        })
      ).not.toThrow();
    });

    it('should reject null', () => {
      expect(() => validateSamplingRequest(null)).toThrow('required');
    });

    it('should reject undefined', () => {
      expect(() => validateSamplingRequest(undefined)).toThrow('required');
    });

    it('should reject non-object', () => {
      expect(() => validateSamplingRequest('bad')).toThrow('must be an object');
    });

    it('should reject missing messages', () => {
      expect(() => validateSamplingRequest({ maxTokens: 100 })).toThrow('messages');
    });

    it('should reject non-array messages', () => {
      expect(() => validateSamplingRequest({ messages: 'bad' })).toThrow('messages');
    });

    it('should reject empty messages array', () => {
      expect(() => validateSamplingRequest({ messages: [] })).toThrow('cannot be empty');
    });
  });

  // ─── validateClientOptions ──────────────────────────────────────────────

  describe('validateClientOptions', () => {
    it('should accept undefined (optional)', () => {
      expect(() => validateClientOptions(undefined)).not.toThrow();
    });

    it('should accept null (optional)', () => {
      expect(() => validateClientOptions(null)).not.toThrow();
    });

    it('should accept empty object', () => {
      expect(() => validateClientOptions({})).not.toThrow();
    });

    it('should accept valid options', () => {
      expect(() =>
        validateClientOptions({
          name: 'test',
          version: '1.0.0',
          timeout: 30000,
          retries: 3,
          retryDelay: 1000,
          startupDelay: 500,
          enableProtocolLogging: true,
        })
      ).not.toThrow();
    });

    it('should reject non-object', () => {
      expect(() => validateClientOptions('bad')).toThrow('must be an object');
      expect(() => validateClientOptions(42)).toThrow('must be an object');
    });

    it('should reject array', () => {
      expect(() => validateClientOptions(['bad'])).toThrow('must be an object');
    });

    it('should reject non-string name', () => {
      expect(() => validateClientOptions({ name: 42 })).toThrow('"name" must be a string');
    });

    it('should reject non-string version', () => {
      expect(() => validateClientOptions({ version: 1 })).toThrow('"version" must be a string');
    });

    it('should reject non-number timeout', () => {
      expect(() => validateClientOptions({ timeout: 'slow' })).toThrow(
        '"timeout" must be a number'
      );
    });

    it('should reject zero timeout', () => {
      expect(() => validateClientOptions({ timeout: 0 })).toThrow('"timeout" must be positive');
    });

    it('should reject negative timeout', () => {
      expect(() => validateClientOptions({ timeout: -1 })).toThrow('"timeout" must be positive');
    });

    it('should reject NaN timeout', () => {
      expect(() => validateClientOptions({ timeout: NaN })).toThrow('"timeout" must be a number');
    });

    it('should reject negative retries', () => {
      expect(() => validateClientOptions({ retries: -1 })).toThrow(
        '"retries" must be non-negative'
      );
    });

    it('should reject negative retryDelay', () => {
      expect(() => validateClientOptions({ retryDelay: -1 })).toThrow(
        '"retryDelay" must be non-negative'
      );
    });

    it('should reject negative startupDelay', () => {
      expect(() => validateClientOptions({ startupDelay: -1 })).toThrow(
        '"startupDelay" must be non-negative'
      );
    });

    it('should reject non-boolean enableProtocolLogging', () => {
      expect(() => validateClientOptions({ enableProtocolLogging: 'yes' })).toThrow(
        '"enableProtocolLogging" must be a boolean'
      );
    });

    it('should accept zero retries and delays', () => {
      expect(() =>
        validateClientOptions({ retries: 0, retryDelay: 0, startupDelay: 0 })
      ).not.toThrow();
    });
  });

  // ─── Integration: MCPClient validation ──────────────────────────────────

  describe('MCPClient integration', () => {
    it('should throw on invalid constructor options', () => {
      expect(() => new MCPClient({ timeout: 'slow' } as any)).toThrow(MCPClientError);
      expect(() => new MCPClient({ timeout: 'slow' } as any)).toThrow('"timeout" must be a number');
    });

    it('should throw on negative timeout in constructor', () => {
      expect(() => new MCPClient({ timeout: -1 })).toThrow('must be positive');
    });

    it('should throw on invalid start config', async () => {
      const client = new MCPClient();
      await expect(client.start(null as any)).rejects.toThrow('required');
    });

    it('should throw on empty command', async () => {
      const client = new MCPClient();
      await expect(client.start({ command: '' })).rejects.toThrow('cannot be empty');
    });

    it('should throw on missing tool name', async () => {
      const client = new MCPClient();
      await expect(client.callTool(null as any)).rejects.toThrow('required');
    });

    it('should throw on empty tool name', async () => {
      const client = new MCPClient();
      await expect(client.callTool({ name: '' })).rejects.toThrow('cannot be empty');
    });

    it('should throw on empty resource URI', async () => {
      const client = new MCPClient();
      await expect(client.readResource('')).rejects.toThrow('cannot be empty');
    });

    it('should throw on null resource URI', async () => {
      const client = new MCPClient();
      await expect(client.readResource(null as any)).rejects.toThrow('required');
    });

    it('should throw on empty prompt name', async () => {
      const client = new MCPClient();
      await expect(client.getPrompt('')).rejects.toThrow('cannot be empty');
    });

    it('should throw on null prompt name', async () => {
      const client = new MCPClient();
      await expect(client.getPrompt(null as any)).rejects.toThrow('required');
    });

    it('should throw on invalid prompt args', async () => {
      const client = new MCPClient();
      await expect(client.getPrompt('greet', 42 as any)).rejects.toThrow('must be an object');
    });

    it('should throw on invalid sampling request', async () => {
      const client = new MCPClient();
      await expect(client.requestSampling(null as any)).rejects.toThrow('required');
    });

    it('should throw on empty messages in sampling', async () => {
      const client = new MCPClient();
      await expect(client.requestSampling({ messages: [], maxTokens: 100 } as any)).rejects.toThrow(
        'cannot be empty'
      );
    });

    it('should validate before checking connection state', async () => {
      // Even without start(), invalid args should throw validation error, not MCPNotStartedError
      const client = new MCPClient();
      await expect(client.callTool({ name: '' })).rejects.toThrow('cannot be empty');
      // NOT 'Client not started'
      await expect(client.callTool({ name: '' })).rejects.not.toThrow('not started');
    });

    it('should validate callTool with non-string name before MCPNotStartedError', async () => {
      const client = new MCPClient();
      await expect(client.callTool({ name: 42 } as any)).rejects.toThrow('must be a string');
    });
  });
});

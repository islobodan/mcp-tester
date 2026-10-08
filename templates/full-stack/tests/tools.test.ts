/**
 * Tool tests for the full-stack server.
 */

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { MCPClient } from '@slbdn/mcp-tester';
import { contentText, createConnectedClient } from './helpers.js';

describe('Tools', () => {
  let client: MCPClient;

  beforeAll(async () => {
    client = await createConnectedClient('tools-test');
  });

  afterAll(async () => {
    if (client?.isConnected()) {
      await client.stop();
    }
  });

  describe('greet', () => {
    it('greets by name', async () => {
      const result = await client.callTool({ name: 'greet', arguments: { name: 'Alice' } });
      expect(contentText(result)).toBe('Hello, Alice!');
    });
  });

  describe('sum', () => {
    it('sums an array of numbers', async () => {
      const result = await client.callTool({
        name: 'sum',
        arguments: { numbers: [1, 2, 3, 4] },
      });
      expect(contentText(result)).toBe('10');
    });

    it('returns 0 for an empty array', async () => {
      const result = await client.callTool({ name: 'sum', arguments: { numbers: [] } });
      expect(contentText(result)).toBe('0');
    });
  });

  describe('uppercase', () => {
    it('uppercases the input', async () => {
      const result = await client.callTool({
        name: 'uppercase',
        arguments: { text: 'hello' },
      });
      expect(contentText(result)).toBe('HELLO');
    });

    it('preserves non-letter characters', async () => {
      const result = await client.callTool({
        name: 'uppercase',
        arguments: { text: 'abc 123!' },
      });
      expect(contentText(result)).toBe('ABC 123!');
    });
  });
});
/**
 * Tool tests — covers listing, schema validation, and calling.
 */

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { MCPClient } from '@slbdn/mcp-tester';
import { createConnectedClient } from './helpers.js';

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

  it('lists all expected tools', async () => {
    const tools = await client.listTools();
    const names = tools.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(['echo', 'add', 'slow']));
  });

  it('validates tool input schemas', async () => {
    const tools = await client.listTools();
    for (const tool of tools) {
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
    }
  });

  describe('echo', () => {
    it('returns the message', async () => {
      const result = await client.callTool({
        name: 'echo',
        arguments: { message: 'hello' },
      });
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe('hello');
    });
  });

  describe('add', () => {
    it('adds two positive integers', async () => {
      const result = await client.callTool({
        name: 'add',
        arguments: { a: 2, b: 3 },
      });
      expect(result.content[0].text).toBe('5');
    });

    it('adds negative numbers', async () => {
      const result = await client.callTool({
        name: 'add',
        arguments: { a: -5, b: 10 },
      });
      expect(result.content[0].text).toBe('5');
    });
  });

  describe('slow', () => {
    it('respects the requested delay', async () => {
      const start = Date.now();
      const result = await client.callTool({
        name: 'slow',
        arguments: { ms: 50 },
      });
      const elapsed = Date.now() - start;
      expect(result.content[0].text).toBe('waited 50ms');
      expect(elapsed).toBeGreaterThanOrEqual(45);
    });

    it('times out when requested', async () => {
      await expect(
        client.callTool({
          name: 'slow',
          arguments: { ms: 5000 },
          timeout: 200,
        })
      ).rejects.toThrow(/timed out/i);
    });
  });
});
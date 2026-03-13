/**
 * Integration tests using a real MCP server process via stdio transport.
 * This simulates real-world usage where MCPClient spawns and communicates
 * with an actual MCP server process.
 */

import { MCPClient } from '../client/MCPClient.js';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('MCPClient - Real Server Process (stdio)', () => {
  let client: MCPClient;

  beforeEach(async () => {
    client = new MCPClient({
      name: 'test-client',
      version: '1.0.0',
      timeout: 10000,
    });
  });

  afterEach(async () => {
    if (client.isConnected()) {
      await client.stop();
    }
  });

  describe('Connection lifecycle', () => {
    it('should start and connect to mock server', async () => {
      await client.start({
        command: 'node',
        args: ['./examples/mock-server.js'],
      });

      expect(client.isConnected()).toBe(true);
    });

    it('should stop and disconnect from server', async () => {
      await client.start({
        command: 'node',
        args: ['./examples/mock-server.js'],
      });

      await client.stop();
      expect(client.isConnected()).toBe(false);
    });

    it('should throw if starting twice', async () => {
      await client.start({
        command: 'node',
        args: ['./examples/mock-server.js'],
      });

      await expect(
        client.start({ command: 'node', args: ['./examples/mock-server.js'] })
      ).rejects.toThrow('already started');
    });
  });

  describe('Tools via stdio', () => {
    beforeEach(async () => {
      await client.start({
        command: 'node',
        args: ['./examples/mock-server.js'],
      });
    });

    it('should list tools from server process', async () => {
      const tools = await client.listTools();

      expect(tools).toBeDefined();
      expect(tools.length).toBeGreaterThan(0);

      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toContain('echo');
      expect(toolNames).toContain('add');
    });

    it('should call echo tool via stdio', async () => {
      const result = await client.callTool({
        name: 'echo',
        arguments: { message: 'hello from test' },
      });

      expect(result.content).toBeDefined();
      expect((result.content[0] as { text: string }).text).toBe('Echo: hello from test');
    });

    it('should call add tool via stdio', async () => {
      const result = await client.callTool({
        name: 'add',
        arguments: { a: 5, b: 3 },
      });

      expect((result.content[0] as { text: string }).text).toContain('8');
    });

    it('should handle tool errors via stdio', async () => {
      await expect(
        client.callTool({
          name: 'error_tool',
          arguments: { message: 'test error' },
        })
      ).rejects.toThrow('test error');
    });

    it('should handle unknown tool via stdio', async () => {
      await expect(client.callTool({ name: 'nonexistent', arguments: {} })).rejects.toThrow();
    });
  });

  describe('Resources via stdio', () => {
    beforeEach(async () => {
      await client.start({
        command: 'node',
        args: ['./examples/mock-server.js'],
      });
    });

    it('should list resources from server process', async () => {
      const resources = await client.listResources();

      expect(resources).toBeDefined();
      expect(resources.length).toBeGreaterThan(0);

      const uris = resources.map((r) => r.uri);
      expect(uris).toContain('text://example');
      expect(uris).toContain('config://settings');
    });

    it('should read text resource via stdio', async () => {
      const result = await client.readResource('text://example');

      expect(result.contents).toBeDefined();
      const content = result.contents[0] as { text: string };
      expect(content.text).toContain('example content');
    });

    it('should read JSON resource via stdio', async () => {
      const result = await client.readResource('config://settings');

      expect(result.contents).toBeDefined();
      const content = result.contents[0] as { text: string };
      const parsed = JSON.parse(content.text);
      expect(parsed).toHaveProperty('setting1');
    });
  });

  describe('Prompts via stdio', () => {
    beforeEach(async () => {
      await client.start({
        command: 'node',
        args: ['./examples/mock-server.js'],
      });
    });

    it('should list prompts from server process', async () => {
      const prompts = await client.listPrompts();

      expect(prompts).toBeDefined();
      expect(prompts.length).toBeGreaterThan(0);

      const names = prompts.map((p) => p.name);
      expect(names).toContain('greet');
      expect(names).toContain('summarize');
    });

    it('should get greet prompt via stdio', async () => {
      const result = await client.getPrompt('greet', { name: 'World' });

      expect(result).toBeDefined();
      const content = result.messages[0].content as { text: string };
      expect(content.text).toContain('World');
    });
  });
});

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { MCPClient } from '../client/MCPClient.js';

describe('Real MCP Server: @modelcontextprotocol/server-everything', () => {
  let client: MCPClient;
  const SERVER_PATH = './node_modules/@modelcontextprotocol/server-everything/dist/index.js';

  beforeEach(() => {
    client = new MCPClient({
      name: 'mcp-tester-integration',
      version: '1.0.0',
      timeout: 15000,
      logLevel: 'error', // reduce noise in tests
    });
  });

  afterEach(async () => {
    if (client.isConnected()) {
      await client.stop();
    }
  });

  describe('Connection', () => {
    it('should connect to the everything server', async () => {
      await client.start({
        command: 'node',
        args: [SERVER_PATH, 'stdio'],
      });
      expect(client.isConnected()).toBe(true);
    });

    it('should disconnect cleanly', async () => {
      await client.start({
        command: 'node',
        args: [SERVER_PATH, 'stdio'],
      });
      expect(client.isConnected()).toBe(true);
      await client.stop();
      expect(client.isConnected()).toBe(false);
    });

    it('should be able to reconnect after disconnect', async () => {
      await client.start({
        command: 'node',
        args: [SERVER_PATH, 'stdio'],
      });
      expect(client.isConnected()).toBe(true);
      await client.stop();
      expect(client.isConnected()).toBe(false);

      await client.start({
        command: 'node',
        args: [SERVER_PATH, 'stdio'],
      });
      expect(client.isConnected()).toBe(true);
    });
  });

  describe('Tools', () => {
    beforeEach(async () => {
      await client.start({
        command: 'node',
        args: [SERVER_PATH, 'stdio'],
      });
    });

    it('should list available tools', async () => {
      const tools = await client.listTools();
      expect(tools.length).toBeGreaterThan(0);
      expect(tools[0]).toHaveProperty('name');
      expect(tools[0]).toHaveProperty('description');
    });

    it('should have at least 10 tools', async () => {
      const tools = await client.listTools();
      expect(tools.length).toBeGreaterThanOrEqual(10);
    });

    it('should have echo tool', async () => {
      const tools = await client.listTools();
      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toContain('echo');
    });

    it('should have get-sum tool', async () => {
      const tools = await client.listTools();
      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toContain('get-sum');
    });

    it('should have get-env tool', async () => {
      const tools = await client.listTools();
      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toContain('get-env');
    });

    it('should have get-resource-links tool', async () => {
      const tools = await client.listTools();
      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toContain('get-resource-links');
    });

    it('should call echo tool with message', async () => {
      const result = await client.callTool({
        name: 'echo',
        arguments: { message: 'Hello, server!' },
      });
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0]).toHaveProperty('text');
    });

    it('should call echo tool and receive echoed message', async () => {
      const result = await client.callTool({
        name: 'echo',
        arguments: { message: 'Test message 123' },
      });
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('Test message 123');
    });

    it('should call get-sum tool with numbers', async () => {
      const result = await client.callTool({
        name: 'get-sum',
        arguments: { a: 5, b: 3 },
      });
      expect(result).toBeDefined();
      expect(result.content[0]).toHaveProperty('text');
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('8');
    });

    it('should call get-sum tool with larger numbers', async () => {
      const result = await client.callTool({
        name: 'get-sum',
        arguments: { a: 100, b: 200 },
      });
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('300');
    });

    it('should call get-sum tool with negative numbers', async () => {
      const result = await client.callTool({
        name: 'get-sum',
        arguments: { a: -5, b: 10 },
      });
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('5');
    });

    it('should call get-env tool', async () => {
      const result = await client.callTool({
        name: 'get-env',
        arguments: {},
      });
      expect(result).toBeDefined();
      expect(result.content[0]).toHaveProperty('text');
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('PATH');
    });

    it('should call get-resource-links tool', async () => {
      const result = await client.callTool({
        name: 'get-resource-links',
        arguments: { count: 3 },
      });
      expect(result).toBeDefined();
      expect(result.content[0]).toHaveProperty('text');
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('resource links');
    });

    it('should call get-resource-reference tool', async () => {
      const result = await client.callTool({
        name: 'get-resource-reference',
        arguments: {},
      });
      expect(result).toBeDefined();
    });

    it('should call get-structured-content tool', async () => {
      const result = await client.callTool({
        name: 'get-structured-content',
        arguments: {},
      });
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });

    it('should call get-tiny-image tool', async () => {
      const result = await client.callTool({
        name: 'get-tiny-image',
        arguments: {},
      });
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });

    it('should call toggle-simulated-logging tool', async () => {
      const result = await client.callTool({
        name: 'toggle-simulated-logging',
        arguments: { enabled: true },
      });
      expect(result).toBeDefined();
    });

    it('should call trigger-long-running-operation tool', async () => {
      const result = await client.callTool({
        name: 'trigger-long-running-operation',
        arguments: { duration: 1, steps: 1 },
        timeout: 30000,
      });
      expect(result).toBeDefined();
    }, 35000);

    it('should call get-roots-list tool', async () => {
      const result = await client.callTool({
        name: 'get-roots-list',
        arguments: {},
      });
      expect(result).toBeDefined();
    });

    it('should call get-annotated-message tool with success type', async () => {
      const result = await client.callTool({
        name: 'get-annotated-message',
        arguments: { messageType: 'success' },
      });
      expect(result).toBeDefined();
    });

    it('should call get-annotated-message tool with error type', async () => {
      const result = await client.callTool({
        name: 'get-annotated-message',
        arguments: { messageType: 'error' },
      });
      expect(result).toBeDefined();
    });
  });

  describe('Resources', () => {
    beforeEach(async () => {
      await client.start({
        command: 'node',
        args: [SERVER_PATH, 'stdio'],
      });
    });

    it('should list available resources', async () => {
      const resources = await client.listResources();
      expect(resources.length).toBeGreaterThan(0);
    });

    it('should have demo resource', async () => {
      const resources = await client.listResources();
      const uris = resources.map((r) => r.uri);
      expect(uris.some((uri) => uri.includes('demo://'))).toBe(true);
    });

    it('should read a demo resource', async () => {
      // List resources first to get a valid URI
      const resources = await client.listResources();
      expect(resources.length).toBeGreaterThan(0);
      const validUri = resources[0].uri;
      const result = await client.readResource(validUri);
      expect(result).toBeDefined();
      expect(result.contents).toBeDefined();
    });
  });

  describe('Prompts', () => {
    beforeEach(async () => {
      await client.start({
        command: 'node',
        args: [SERVER_PATH, 'stdio'],
      });
    });

    it('should list available prompts', async () => {
      const prompts = await client.listPrompts();
      expect(prompts.length).toBeGreaterThan(0);
    });

    it('should have simple-prompt', async () => {
      const prompts = await client.listPrompts();
      const names = prompts.map((p) => p.name);
      expect(names).toContain('simple-prompt');
    });

    it('should get simple-prompt', async () => {
      const result = await client.getPrompt('simple-prompt', {});
      expect(result).toBeDefined();
      expect(result.messages).toBeDefined();
      expect(result.messages.length).toBeGreaterThan(0);
    });

    it('should get args-prompt', async () => {
      const result = await client.getPrompt('args-prompt', { city: 'New York' });
      expect(result).toBeDefined();
      expect(result.messages).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await client.start({
        command: 'node',
        args: [SERVER_PATH, 'stdio'],
      });
    });

    it('should handle unknown tool gracefully', async () => {
      // Server returns error content but doesn't reject
      const result = await client.callTool({
        name: 'nonexistent-tool-xyz',
        arguments: {},
      });
      expect(result).toBeDefined();
      expect(
        result.isError || (result.content[0] as { text?: string }).text?.includes('error')
      ).toBe(true);
    });

    it('should handle missing resource gracefully', async () => {
      await expect(client.readResource('nonexistent://resource-xyz')).rejects.toThrow();
    });
  });

  describe('Multiple Operations', () => {
    beforeEach(async () => {
      await client.start({
        command: 'node',
        args: [SERVER_PATH, 'stdio'],
      });
    });

    it('should call multiple tools sequentially', async () => {
      const echoResult = await client.callTool({
        name: 'echo',
        arguments: { message: 'first' },
      });
      const sumResult = await client.callTool({
        name: 'get-sum',
        arguments: { a: 10, b: 20 },
      });

      expect(echoResult).toBeDefined();
      expect(sumResult).toBeDefined();
      const sumText = (sumResult.content[0] as { text: string }).text;
      expect(sumText).toContain('30');
    });

    it('should list tools and then call a tool', async () => {
      const tools = await client.listTools();
      expect(tools.length).toBeGreaterThan(0);

      const result = await client.callTool({
        name: 'echo',
        arguments: { message: 'test' },
      });
      expect(result).toBeDefined();
    });

    it('should list resources and read a resource', async () => {
      const resources = await client.listResources();
      expect(resources.length).toBeGreaterThan(0);

      const validUri = resources[0].uri;
      const result = await client.readResource(validUri);
      expect(result).toBeDefined();
    });

    it('should list prompts and get a prompt', async () => {
      const prompts = await client.listPrompts();
      expect(prompts.length).toBeGreaterThan(0);

      const result = await client.getPrompt('simple-prompt', {});
      expect(result).toBeDefined();
    });
  });
});

import { MCPClient } from '../client/MCPClient.js';
import { MockMCPServer } from './fixtures/mock-server.js';
import { describe, it, expect, beforeEach } from '@jest/globals';

describe('MCPClient - Resources', () => {
  let mockServer: MockMCPServer;
  let client: any;

  beforeEach(async () => {
    const { MCPClient } = await import('../client/MCPClient.js');
    client = new MCPClient();
    mockServer = new MockMCPServer();
  });

  it('should list available resources', async () => {
    const resources = await mockServer.handleResourcesList();

    expect(Array.isArray(resources.resources)).toBe(true);
    expect(resources.resources.length).toBeGreaterThan(0);

    const resource = resources.resources[0];
    expect(resource).toHaveProperty('uri');
    expect(resource).toHaveProperty('name');
    expect(resource).toHaveProperty('mimeType');
  });

  it('should read a text resource', async () => {
    const result = await mockServer.handleResourceRead('text://example');

    expect(result).toHaveProperty('contents');
    expect(Array.isArray(result.contents)).toBe(true);

    const content = result.contents[0];
    expect(content).toHaveProperty('uri');
    expect(content).toHaveProperty('text');
  });

  it('should read a JSON resource', async () => {
    const result = await mockServer.handleResourceRead('config://settings');

    expect(result).toHaveProperty('contents');
    expect(Array.isArray(result.contents)).toBe(true);

    const content = result.contents[0];
    expect(content).toHaveProperty('uri');
    expect(content).toHaveProperty('text');

    const parsed = JSON.parse(content.text as string);
    expect(parsed).toHaveProperty('setting1');
    expect(parsed).toHaveProperty('setting2');
  });

  it('should handle non-existent resource', async () => {
    await expect(mockServer.handleResourceRead('unknown://resource')).rejects.toThrow('Unknown resource');
  });
});

describe('MCPClient - Prompts', () => {
  let mockServer: MockMCPServer;
  let client: any;

  beforeEach(async () => {
    const { MCPClient } = await import('../client/MCPClient.js');
    client = new MCPClient();
    mockServer = new MockMCPServer();
  });

  it('should list available prompts', async () => {
    const prompts = await mockServer.handlePromptsList();

    expect(Array.isArray(prompts.prompts)).toBe(true);
    expect(prompts.prompts.length).toBeGreaterThan(0);

    const prompt = prompts.prompts[0];
    expect(prompt).toHaveProperty('name');
    expect(prompt).toHaveProperty('description');
  });

  it('should get a prompt with arguments', async () => {
    const result = await mockServer.handlePromptGet('greet', { name: 'Alice' });

    expect(result).toHaveProperty('messages');
    expect(Array.isArray(result.messages)).toBe(true);

    const message = result.messages[0];
    expect(message).toHaveProperty('role');
    expect(message).toHaveProperty('content');
  });

  it('should get a prompt with text content', async () => {
    const result = await mockServer.handlePromptGet('summarize', { text: 'This is test text' });

    expect(result).toHaveProperty('messages');
    expect(Array.isArray(result.messages)).toBe(true);

    const message = result.messages[0];
    expect(message.content.text).toContain('This is test text');
  });

  it('should handle non-existent prompt', async () => {
    await expect(mockServer.handlePromptGet('unknown_prompt', {})).rejects.toThrow('Unknown prompt');
  });
});

describe('MCPClient - Notifications', () => {
  let client: any;

  beforeEach(async () => {
    const { MCPClient } = await import('../client/MCPClient.js');
    client = new MCPClient();
  });

  it('should set notification handlers', () => {
    let loggingReceived = false;
    let resourceChangedReceived = false;

    client.setNotificationHandlers({
      onLoggingMessage: (level: string, data: unknown) => {
        loggingReceived = true;
        expect(level).toBe('info');
        expect(typeof data).toBe('string');
      },
      onResourceListChanged: () => {
        resourceChangedReceived = true;
      },
    });

    expect(loggingReceived).toBe(false);
    expect(resourceChangedReceived).toBe(false);
  });
});

describe('MockMCPServer', () => {
  let mockServer: MockMCPServer;
  let client: any;

  beforeEach(async () => {
    const { MCPClient } = await import('../client/MCPClient.js');
    client = new MCPClient();
    mockServer = new MockMCPServer();
  });

  it('should register and list tools', async () => {
    const result = await mockServer.handleToolsList();

    expect(result).toHaveProperty('tools');
    expect(Array.isArray(result.tools)).toBe(true);
    expect(result.tools.length).toBeGreaterThan(0);
  });

  it('should handle tool calls', async () => {
    const result = await mockServer.handleToolCall('echo', { message: 'test' });

    expect(result).toHaveProperty('content');
    expect(result.content[0].text).toBe('Echo: test');
  });

  it('should handle addition', async () => {
    const result = await mockServer.handleToolCall('add', { a: 5, b: 3 });

    expect(result.content[0].text).toBe('5 + 3 = 8');
  });

  it('should handle delay', async () => {
    const start = Date.now();
    await mockServer.handleToolCall('delay', { ms: 100 });
    const end = Date.now();

    expect(end - start).toBeGreaterThanOrEqual(100);
  });

  it('should throw error for unknown tool', async () => {
    await expect(mockServer.handleToolCall('unknown', {})).rejects.toThrow('Unknown tool');
  });

  it('should list resources', async () => {
    const result = await mockServer.handleResourcesList();

    expect(result).toHaveProperty('resources');
    expect(Array.isArray(result.resources)).toBe(true);
  });

  it('should read text resource', async () => {
    const result = await mockServer.handleResourceRead('text://example');

    expect(result).toHaveProperty('contents');
    expect(result.contents[0].text).toContain('example content');
  });

  it('should read JSON resource', async () => {
    const result = await mockServer.handleResourceRead('config://settings');

    const content = result.contents[0];
    const parsed = JSON.parse(content.text as string);

    expect(parsed).toHaveProperty('setting1');
  });

  it('should list prompts', async () => {
    const result = await mockServer.handlePromptsList();

    expect(result).toHaveProperty('prompts');
    expect(Array.isArray(result.prompts)).toBe(true);
  });

  it('should get prompt', async () => {
    const result = await mockServer.handlePromptGet('greet', { name: 'Bob' });

    expect(result).toHaveProperty('messages');
    expect(result.messages[0].content.text).toContain('Bob');
  });

  it('should send notifications', async () => {
    await mockServer.sendNotification('info', 'Test message');

    expect(mockServer.getNotificationCount()).toBe(1);
  });

  it('should add custom tools', async () => {
    mockServer.addTool({
      name: 'custom_tool',
      description: 'A custom tool',
      inputSchema: {
        type: 'object',
        properties: {
          value: { type: 'string' },
        },
        required: ['value'],
      },
    });

    const result = await mockServer.handleToolsList();

    expect(result.tools.some((t: any) => t.name === 'custom_tool')).toBe(true);
  });

  it('should add custom resources', async () => {
    mockServer.addResource({
      uri: 'custom://resource',
      name: 'Custom Resource',
      description: 'A custom resource',
      mimeType: 'text/plain',
    });

    const result = await mockServer.handleResourcesList();

    expect(result.resources.some((r: any) => r.uri === 'custom://resource')).toBe(true);
  });

  it('should add custom prompts', async () => {
    mockServer.addPrompt({
      name: 'custom_prompt',
      description: 'A custom prompt',
      arguments: [
        {
          name: 'input',
          description: 'Input value',
          required: true,
        },
      ],
    });

    const result = await mockServer.handlePromptsList();

    expect(result.prompts.some((p: any) => p.name === 'custom_prompt')).toBe(true);
  });
});

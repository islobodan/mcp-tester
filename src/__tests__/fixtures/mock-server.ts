import type { Tool, Prompt } from '@modelcontextprotocol/sdk/types.js';

/**
 * Mock MCP tool definition for testing.
 */
interface MockTool {
  name: string;
  description: string;
  inputSchema: Tool['inputSchema'];
}

/**
 * Mock MCP resource definition for testing.
 */
interface MockResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

/**
 * Mock MCP prompt definition for testing.
 */
interface MockPrompt {
  name: string;
  description: string;
  arguments: Prompt['arguments'];
}

/**
 * Tool call result content item.
 */
interface MockContentItem {
  type: string;
  text: string;
}

/**
 * Resource content item.
 */
interface MockResourceContent {
  uri: string;
  mimeType: string;
  text: string;
}

/**
 * Prompt message content.
 */
interface MockPromptContent {
  type: string;
  text: string;
}

/**
 * Prompt message.
 */
interface MockPromptMessage {
  role: string;
  content: MockPromptContent;
}

/**
 * In-memory mock MCP server for unit testing.
 * Provides tools, resources, and prompts without requiring a real server process.
 */
export class MockMCPServer {
  private tools: Map<string, MockTool> = new Map();
  private resources: Map<string, MockResource> = new Map();
  private prompts: Map<string, MockPrompt> = new Map();
  private notificationCount = 0;

  constructor() {
    this.registerDefaultTools();
    this.registerDefaultResources();
    this.registerDefaultPrompts();
  }

  private registerDefaultTools(): void {
    this.tools.set('echo', {
      name: 'echo',
      description: 'Echo back the input',
      inputSchema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'Message to echo',
          },
        },
        required: ['message'],
      },
    });

    this.tools.set('add', {
      name: 'add',
      description: 'Add two numbers',
      inputSchema: {
        type: 'object',
        properties: {
          a: { type: 'number' },
          b: { type: 'number' },
        },
        required: ['a', 'b'],
      },
    });

    this.tools.set('delay', {
      name: 'delay',
      description: 'Delay for specified milliseconds',
      inputSchema: {
        type: 'object',
        properties: {
          ms: { type: 'number' },
        },
        required: ['ms'],
      },
    });

    this.tools.set('error_tool', {
      name: 'error_tool',
      description: 'Always returns an error',
      inputSchema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
        },
        required: ['message'],
      },
    });
  }

  private registerDefaultResources(): void {
    this.resources.set('text://example', {
      uri: 'text://example',
      name: 'Example Text Resource',
      description: 'A simple text resource',
      mimeType: 'text/plain',
    });

    this.resources.set('config://settings', {
      uri: 'config://settings',
      name: 'Settings',
      description: 'Configuration settings',
      mimeType: 'application/json',
    });
  }

  private registerDefaultPrompts(): void {
    this.prompts.set('greet', {
      name: 'greet',
      description: 'Greet someone',
      arguments: [
        {
          name: 'name',
          description: 'Name to greet',
          required: true,
        },
      ],
    });

    this.prompts.set('summarize', {
      name: 'summarize',
      description: 'Summarize text',
      arguments: [
        {
          name: 'text',
          description: 'Text to summarize',
          required: true,
        },
      ],
    });
  }

  async handleToolsList(): Promise<{ tools: MockTool[] }> {
    return {
      tools: Array.from(this.tools.values()),
    };
  }

  async handleToolCall(
    name: string,
    args: Record<string, string | number | boolean>
  ): Promise<{ content: MockContentItem[] }> {
    if (name === 'echo') {
      return {
        content: [{ type: 'text', text: `Echo: ${args.message}` }],
      };
    }

    if (name === 'add') {
      const result = Number(args.a) + Number(args.b);
      return {
        content: [{ type: 'text', text: `${args.a} + ${args.b} = ${result}` }],
      };
    }

    if (name === 'delay') {
      await new Promise((resolve) => setTimeout(resolve, Number(args.ms)));
      return {
        content: [{ type: 'text', text: `Delayed for ${args.ms}ms` }],
      };
    }

    if (name === 'error_tool') {
      throw new Error(String(args.message || 'Tool error'));
    }

    throw new Error(`Unknown tool: ${name}`);
  }

  async handleResourcesList(): Promise<{ resources: MockResource[] }> {
    return {
      resources: Array.from(this.resources.values()),
    };
  }

  async handleResourceRead(uri: string): Promise<{ contents: MockResourceContent[] }> {
    if (uri === 'text://example') {
      return {
        contents: [
          {
            uri,
            mimeType: 'text/plain',
            text: 'This is example content from the resource.',
          },
        ],
      };
    }

    if (uri === 'config://settings') {
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({ setting1: 'value1', setting2: 'value2' }, null, 2),
          },
        ],
      };
    }

    throw new Error(`Unknown resource: ${uri}`);
  }

  async handlePromptsList(): Promise<{ prompts: MockPrompt[] }> {
    return {
      prompts: Array.from(this.prompts.values()),
    };
  }

  async handlePromptGet(
    name: string,
    args: Record<string, string>
  ): Promise<{ messages: MockPromptMessage[] }> {
    if (name === 'greet') {
      const userName = args.name || 'World';
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Hello, ${userName}! How are you today?`,
            },
          },
        ],
      };
    }

    if (name === 'summarize') {
      const text = args.text || '';
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please summarize: ${text}`,
            },
          },
        ],
      };
    }

    throw new Error(`Unknown prompt: ${name}`);
  }

  async sendNotification(level: string, message: string): Promise<void> {
    this.notificationCount++;
    console.log(`[Mock Server Notification #${this.notificationCount}] ${level}: ${message}`);
  }

  getNotificationCount(): number {
    return this.notificationCount;
  }

  addTool(tool: MockTool): void {
    this.tools.set(tool.name, tool);
  }

  addResource(resource: MockResource): void {
    this.resources.set(resource.uri, resource);
  }

  addPrompt(prompt: MockPrompt): void {
    this.prompts.set(prompt.name, prompt);
  }
}

export function createMockServer(): MockMCPServer {
  return new MockMCPServer();
}

export class MockMCPServer {
  private tools: Map<string, any> = new Map();
  private resources: Map<string, any> = new Map();
  private prompts: Map<string, any> = new Map();
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

  async handleToolsList(): Promise<any> {
    return {
      tools: Array.from(this.tools.values()),
    };
  }

  async handleToolCall(name: string, args: Record<string, any>): Promise<any> {
    if (name === 'echo') {
      return {
        content: [{ type: 'text', text: `Echo: ${args.message}` }],
      };
    }

    if (name === 'add') {
      const result = args.a + args.b;
      return {
        content: [{ type: 'text', text: `${args.a} + ${args.b} = ${result}` }],
      };
    }

    if (name === 'delay') {
      await new Promise((resolve) => setTimeout(resolve, args.ms));
      return {
        content: [{ type: 'text', text: `Delayed for ${args.ms}ms` }],
      };
    }

    if (name === 'error_tool') {
      throw new Error(args.message || 'Tool error');
    }

    throw new Error(`Unknown tool: ${name}`);
  }

  async handleResourcesList(): Promise<any> {
    return {
      resources: Array.from(this.resources.values()),
    };
  }

  async handleResourceRead(uri: string): Promise<any> {
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

  async handlePromptsList(): Promise<any> {
    return {
      prompts: Array.from(this.prompts.values()),
    };
  }

  async handlePromptGet(name: string, args: Record<string, string>): Promise<any> {
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

  addTool(tool: any): void {
    this.tools.set(tool.name, tool);
  }

  addResource(resource: any): void {
    this.resources.set(resource.uri, resource);
  }

  addPrompt(prompt: any): void {
    this.prompts.set(prompt.name, prompt);
  }
}

export function createMockServer(): MockMCPServer {
  return new MockMCPServer();
}

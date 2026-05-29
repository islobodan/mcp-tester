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
 * Configuration for mock server behavior.
 */
export interface MockServerConfig {
  /** Default delay in ms for all tool calls. @defaultValue 0 */
  defaultDelay?: number;
  /** Probability of a random failure (0-1). @defaultValue 0 */
  failureRate?: number;
  /** Whether to validate input schemas. @defaultValue false */
  validateSchemas?: boolean;
  /** Custom error message for random failures. @defaultValue 'Random failure' */
  failureMessage?: string;
}

/**
 * Tool handler function type.
 */
export type ToolHandler = (
  args: Record<string, unknown>
) => Promise<MockContentItem[]> | MockContentItem[];

/**
 * Resource handler function type.
 */
export type ResourceHandler = (
  uri: string
) => Promise<MockResourceContent[]> | MockResourceContent[];

/**
 * Prompt handler function type.
 */
export type PromptHandler = (
  args: Record<string, string>
) => Promise<MockPromptMessage[]> | MockPromptMessage[];

/**
 * In-memory mock MCP server for unit testing.
 * Provides tools, resources, and prompts without requiring a real server process.
 *
 * Features:
 * - Configurable delays and random failures for testing retry logic
 * - Custom tool/resource/prompt handlers
 * - Input schema validation (optional)
 * - Streaming response support
 * - Stateful tools (counter, items)
 */
export class MockMCPServer {
  private tools: Map<string, MockTool> = new Map();
  private resources: Map<string, MockResource> = new Map();
  private prompts: Map<string, MockPrompt> = new Map();
  private notificationCount = 0;

  // Custom handlers
  private toolHandlers: Map<string, ToolHandler> = new Map();
  private resourceHandlers: Map<string, ResourceHandler> = new Map();
  private promptHandlers: Map<string, PromptHandler> = new Map();

  // Configurable behavior
  private config: Required<MockServerConfig>;

  // Stateful counters for testing
  private counters: Map<string, number> = new Map();

  // Stateful items for testing
  private items: Map<string, unknown[]> = new Map();

  // Call history for assertions
  private callHistory: Array<{ tool: string; args: Record<string, unknown>; timestamp: number }> =
    [];

  // Streaming chunks
  private streamBuffers: Map<string, string[]> = new Map();

  constructor(config: MockServerConfig = {}) {
    this.config = {
      defaultDelay: config.defaultDelay ?? 0,
      failureRate: config.failureRate ?? 0,
      validateSchemas: config.validateSchemas ?? false,
      failureMessage: config.failureMessage ?? 'Random failure',
    };

    this.registerDefaultTools();
    this.registerDefaultResources();
    this.registerDefaultPrompts();
  }

  // ─── Configuration ────────────────────────────────────────────────

  /**
   * Update server configuration.
   */
  setConfig(config: Partial<MockServerConfig>): void {
    Object.assign(this.config, config);
  }

  /**
   * Get current configuration.
   */
  getConfig(): Required<MockServerConfig> {
    return { ...this.config };
  }

  /**
   * Reset all stateful data (counters, items, call history).
   */
  resetState(): void {
    this.counters.clear();
    this.items.clear();
    this.callHistory = [];
    this.streamBuffers.clear();
  }

  // ─── Stateful Operations ──────────────────────────────────────────

  /**
   * Get a named counter value.
   */
  getCounter(name: string): number {
    return this.counters.get(name) ?? 0;
  }

  /**
   * Get items list by name.
   */
  getItems(name: string): unknown[] {
    return this.items.get(name) ?? [];
  }

  /**
   * Get call history for assertions.
   */
  getCallHistory(): Array<{ tool: string; args: Record<string, unknown>; timestamp: number }> {
    return [...this.callHistory];
  }

  /**
   * Get call count for a specific tool.
   */
  getCallCount(toolName: string): number {
    return this.callHistory.filter((c) => c.tool === toolName).length;
  }

  /**
   * Set up a streaming response buffer for a tool.
   * The tool will return chunks one at a time via `nextStreamChunk`.
   */
  setupStream(toolName: string, chunks: string[]): void {
    this.streamBuffers.set(toolName, [...chunks]);
  }

  /**
   * Get the next chunk from a tool's stream buffer.
   * Returns undefined if no more chunks.
   */
  nextStreamChunk(toolName: string): string | undefined {
    const buffer = this.streamBuffers.get(toolName);
    if (!buffer || buffer.length === 0) return undefined;
    return buffer.shift();
  }

  // ─── Custom Handlers ──────────────────────────────────────────────

  /**
   * Register a custom tool handler. The handler receives the args and returns content items.
   * Simulated delay and random failure still apply unless the handler is registered
   * as a raw handler via `registerRawToolHandler`.
   */
  registerToolHandler(name: string, handler: ToolHandler): void {
    this.toolHandlers.set(name, handler);
  }

  /**
   * Register a custom resource handler.
   */
  registerResourceHandler(uri: string, handler: ResourceHandler): void {
    this.resourceHandlers.set(uri, handler);
  }

  /**
   * Register a custom prompt handler.
   */
  registerPromptHandler(name: string, handler: PromptHandler): void {
    this.promptHandlers.set(name, handler);
  }

  // ─── Default Tool Registration ────────────────────────────────────

  private registerDefaultTools(): void {
    // echo — echoes input
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

    // add — adds two numbers
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

    // delay — delays for specified ms
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

    // error_tool — always throws
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

    // counter — stateful counter (increment, get, reset)
    this.tools.set('counter', {
      name: 'counter',
      description: 'Stateful counter: increment, get value, or reset',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            description: 'Action: increment, get, or reset',
            enum: ['increment', 'get', 'reset'],
          },
          by: {
            type: 'number',
            description: 'Amount to increment by (default 1)',
          },
        },
        required: ['action'],
      },
    });

    // items — stateful item list (add, list, remove, clear)
    this.tools.set('items', {
      name: 'items',
      description: 'Stateful item list: add, list, remove, or clear items',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            description: 'Action: add, list, remove, clear',
            enum: ['add', 'list', 'remove', 'clear'],
          },
          value: {
            description: 'Value to add or index to remove',
          },
        },
        required: ['action'],
      },
    });

    // transform — returns different results based on input type
    this.tools.set('transform', {
      name: 'transform',
      description: 'Transform input: upper, lower, reverse, length',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text to transform' },
          operation: {
            type: 'string',
            enum: ['upper', 'lower', 'reverse', 'length'],
          },
        },
        required: ['text', 'operation'],
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

  // ─── Schema Validation ────────────────────────────────────────────

  /**
   * Validate tool call args against the tool's input schema.
   * Only checks required fields and basic types.
   */
  private validateInput(toolName: string, args: Record<string, unknown>): void {
    const tool = this.tools.get(toolName);
    if (!tool) return;

    const schema = tool.inputSchema;
    if (!schema || !schema.properties) return;

    const required = new Set((schema.required as string[]) || []);

    for (const field of required) {
      if (!(field in args) || args[field] === undefined || args[field] === null) {
        throw new Error(
          `Missing required field "${field}" for tool "${toolName}". ` +
            `Required: [${Array.from(required).join(', ')}]`
        );
      }

      // Basic type check
      const propSchema = (schema.properties as Record<string, Record<string, unknown>>)[field];
      if (propSchema && propSchema.type) {
        const expectedType = propSchema.type as string;
        const actualType = typeof args[field];

        if (expectedType === 'number' && actualType !== 'number') {
          throw new Error(
            `Field "${field}" must be a number, got ${actualType} for tool "${toolName}"`
          );
        }
        if (expectedType === 'string' && actualType !== 'string') {
          throw new Error(
            `Field "${field}" must be a string, got ${actualType} for tool "${toolName}"`
          );
        }
        if (expectedType === 'boolean' && actualType !== 'boolean') {
          throw new Error(
            `Field "${field}" must be a boolean, got ${actualType} for tool "${toolName}"`
          );
        }
        // Check enum values
        if (propSchema.enum && Array.isArray(propSchema.enum)) {
          if (!propSchema.enum.includes(args[field])) {
            throw new Error(
              `Field "${field}" must be one of [${propSchema.enum.join(', ')}], ` +
                `got "${String(args[field])}" for tool "${toolName}"`
            );
          }
        }
      }
    }
  }

  // ─── Request Handlers ─────────────────────────────────────────────

  async handleToolsList(): Promise<{ tools: MockTool[] }> {
    return {
      tools: Array.from(this.tools.values()),
    };
  }

  async handleToolCall(
    name: string,
    args: Record<string, string | number | boolean>
  ): Promise<{ content: MockContentItem[] }> {
    // Record call
    this.callHistory.push({ tool: name, args, timestamp: Date.now() });

    // Schema validation (if enabled)
    if (this.config.validateSchemas) {
      this.validateInput(name, args);
    }

    // Simulated delay
    if (this.config.defaultDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.config.defaultDelay));
    }

    // Random failure
    if (
      this.config.failureRate > 0 &&
      name !== 'error_tool' &&
      Math.random() < this.config.failureRate
    ) {
      throw new Error(this.config.failureMessage);
    }

    // Custom handler takes priority
    const customHandler = this.toolHandlers.get(name);
    if (customHandler) {
      const content = await customHandler(args);
      return { content };
    }

    // Built-in handlers
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

    // Stateful counter
    if (name === 'counter') {
      const action = String(args.action);
      const currentValue = this.counters.get('main') ?? 0;

      switch (action) {
        case 'increment': {
          const by = Number(args.by) || 1;
          const newValue = currentValue + by;
          this.counters.set('main', newValue);
          return {
            content: [{ type: 'text', text: `Counter: ${currentValue} → ${newValue}` }],
          };
        }
        case 'get':
          return {
            content: [{ type: 'text', text: `Counter: ${currentValue}` }],
          };
        case 'reset':
          this.counters.set('main', 0);
          return {
            content: [{ type: 'text', text: 'Counter: 0 (reset)' }],
          };
        default:
          throw new Error(`Unknown counter action: ${action}`);
      }
    }

    // Stateful items list
    if (name === 'items') {
      const action = String(args.action);
      const list = this.items.get('main') ?? [];

      switch (action) {
        case 'add': {
          list.push(args.value);
          this.items.set('main', list);
          return {
            content: [
              {
                type: 'text',
                text: `Added "${String(args.value)}". Items: [${list.map((i) => `"${String(i)}"`).join(', ')}]`,
              },
            ],
          };
        }
        case 'list':
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(list),
              },
            ],
          };
        case 'remove': {
          const index = Number(args.value);
          if (index >= 0 && index < list.length) {
            const removed = list.splice(index, 1)[0];
            this.items.set('main', list);
            return {
              content: [
                {
                  type: 'text',
                  text: `Removed "${String(removed)}". Items: [${list.map((i) => `"${String(i)}"`).join(', ')}]`,
                },
              ],
            };
          }
          throw new Error(`Index ${index} out of range (0-${list.length - 1})`);
        }
        case 'clear':
          this.items.set('main', []);
          return {
            content: [{ type: 'text', text: 'Items cleared' }],
          };
        default:
          throw new Error(`Unknown items action: ${action}`);
      }
    }

    // Transform tool — different results based on input
    if (name === 'transform') {
      const text = String(args.text);
      const operation = String(args.operation);

      switch (operation) {
        case 'upper':
          return { content: [{ type: 'text', text: text.toUpperCase() }] };
        case 'lower':
          return { content: [{ type: 'text', text: text.toLowerCase() }] };
        case 'reverse':
          return { content: [{ type: 'text', text: text.split('').reverse().join('') }] };
        case 'length':
          return { content: [{ type: 'text', text: `${text.length}` }] };
        default:
          throw new Error(`Unknown transform operation: ${operation}`);
      }
    }

    throw new Error(`Unknown tool: ${name}`);
  }

  async handleResourcesList(): Promise<{ resources: MockResource[] }> {
    return {
      resources: Array.from(this.resources.values()),
    };
  }

  async handleResourceRead(uri: string): Promise<{ contents: MockResourceContent[] }> {
    // Custom handler takes priority
    const customHandler = this.resourceHandlers.get(uri);
    if (customHandler) {
      const contents = await customHandler(uri);
      return { contents };
    }

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
    // Custom handler takes priority
    const customHandler = this.promptHandlers.get(name);
    if (customHandler) {
      const messages = await customHandler(args);
      return { messages };
    }

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

  // ─── Registration Helpers ─────────────────────────────────────────

  addTool(tool: MockTool): void {
    this.tools.set(tool.name, tool);
  }

  addResource(resource: MockResource): void {
    this.resources.set(resource.uri, resource);
  }

  addPrompt(prompt: MockPrompt): void {
    this.prompts.set(prompt.name, prompt);
  }

  removeTool(name: string): boolean {
    this.toolHandlers.delete(name);
    return this.tools.delete(name);
  }

  removeResource(uri: string): boolean {
    this.resourceHandlers.delete(uri);
    return this.resources.delete(uri);
  }

  removePrompt(name: string): boolean {
    this.promptHandlers.delete(name);
    return this.prompts.delete(name);
  }
}

export function createMockServer(config?: MockServerConfig): MockMCPServer {
  return new MockMCPServer(config);
}

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
// Note: Server process is managed by StdioClientTransport, no manual spawn needed
import {
  ListToolsRequest,
  ListToolsResultSchema,
  CallToolRequest,
  CallToolResultSchema,
  ListResourcesRequest,
  ListResourcesResultSchema,
  ReadResourceRequest,
  ReadResourceResultSchema,
  ListPromptsRequest,
  ListPromptsResultSchema,
  GetPromptRequest,
  GetPromptResultSchema,
  ElicitRequestSchema,
  LoggingMessageNotificationSchema,
  ResourceListChangedNotificationSchema,
  CreateMessageRequestParams,
  CreateMessageResultSchema,
  Tool,
  Resource,
  Prompt,
  CallToolResult,
  ReadResourceResult,
  GetPromptResult,
  CreateMessageResult,
} from '@modelcontextprotocol/sdk/types.js';
import { Logger, LogLevel, ConsoleLogger, NoOpLogger } from '../utils/logger.js';
import { mergeEnvironments } from '../utils/env.js';
import {
  MCPClientError,
  MCPNotStartedError,
  MCPAlreadyStartedError,
  MCPConnectionError,
  MCPTimeoutError,
  MCPServerError,
} from '../utils/errors.js';

/**
 * Configuration for starting an MCP server connection.
 */
export interface MCPServerConfig {
  /**
   * The command to execute the MCP server (e.g., "node", "python").
   */
  command: string;
  /**
   * Arguments to pass to the server command.
   */
  args?: string[];
  /**
   * Environment variables for the server process.
   */
  env?: Record<string, string | undefined>;
  /**
   * Delay in milliseconds to wait after starting the server before sending requests.
   * @defaultValue 500
   */
  startupDelay?: number;
}

/**
 * Options for configuring the MCPClient instance.
 */
export interface MCPClientOptions {
  /**
   * Client name/identifier sent to the MCP server during initialization.
   * @defaultValue "mcp-test-client"
   */
  name?: string;
  /**
   * Client version sent to the MCP server during initialization.
   * @defaultValue "1.0.0"
   */
  version?: string;
  /**
   * Default timeout in milliseconds for all requests.
   * @defaultValue 30000
   */
  timeout?: number;
  /**
   * Log level for the client.
   * @defaultValue "info"
   * @see {@link LogLevel}
   */
  logLevel?: LogLevel;
  /**
   * Enable protocol-level logging (JSON messages).
   * @defaultValue false
   */
  enableProtocolLogging?: boolean;
  /**
   * Number of retry attempts for failed requests.
   * @defaultValue 0
   */
  retries?: number;
  /**
   * Base delay in milliseconds between retry attempts.
   * @defaultValue 1000
   */
  retryDelay?: number;
  /**
   * Delay in milliseconds to wait after starting the server.
   * @defaultValue 500
   */
  startupDelay?: number;
}

/**
 * Options for calling a tool.
 */
export interface ToolCallOptions {
  /**
   * Name of the tool to call.
   */
  name: string;
  /**
   * Arguments to pass to the tool.
   */
  arguments?: Record<string, unknown>;
  /**
   * Timeout in milliseconds for this specific call. Overrides the default timeout.
   */
  timeout?: number;
  /**
   * Number of retries for this specific call. Overrides the default retries.
   */
  retries?: number;
}

/**
 * Handlers for server-initiated notifications.
 */
export interface NotificationHandler {
  /**
   * Handler for logging messages from the server.
   * @param level - Log level (debug, info, warning, error)
   * @param data - Log message content
   */
  onLoggingMessage?: (level: string, data: string) => void;
  /**
   * Handler for resource list change notifications.
   */
  onResourceListChanged?: () => void;
}

/**
 * Options for retry behavior with exponential backoff.
 */
export interface RetryOptions {
  /**
   * Maximum number of retry attempts.
   * @defaultValue 3
   */
  maxAttempts: number;
  /**
   * Initial delay in milliseconds between retries.
   * @defaultValue 1000
   */
  baseDelay: number;
  /**
   * Maximum delay in milliseconds between retries.
   * @defaultValue 10000
   */
  maxDelay: number;
  /**
   * Multiplier for exponential backoff.
   * @defaultValue 2
   */
  backoffMultiplier: number;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
};

/**
 * MCPClient is a wrapper around the Model Context Protocol SDK client.
 *
 * It provides a simplified API for testing MCP servers in CI/CD environments.
 * The client manages the lifecycle of the server process and provides methods
 * for calling tools, reading resources, and managing prompts.
 *
 * @example
 * ```typescript
 * const client = new MCPClient({
 *   name: 'my-test-client',
 *   version: '1.0.0',
 *   timeout: 30000,
 * });
 *
 * await client.start({
 *   command: 'node',
 *   args: ['./server.js'],
 * });
 *
 * const tools = await client.listTools();
 * const result = await client.callTool({
 *   name: 'my-tool',
 *   arguments: { param: 'value' },
 * });
 *
 * await client.stop();
 * ```
 *
 * @see {@link https://spec.modelcontextprotocol.io | MCP Specification}
 */
export class MCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private options: MCPClientOptions;
  private notificationHandlers: NotificationHandler;
  private logger: Logger;
  private retryOptions: RetryOptions;

  /**
   * Creates a new MCPClient instance.
   *
   * @param options - Configuration options for the client
   * @example
   * ```typescript
   * const client = new MCPClient({
   *   name: 'test-client',
   *   version: '1.0.0',
   *   timeout: 60000,
   *   logLevel: 'debug',
   * });
   * ```
   */
  constructor(options: MCPClientOptions = {}) {
    this.options = {
      name: options.name || 'mcp-test-client',
      version: options.version || '1.0.0',
      timeout: options.timeout || 30000,
      logLevel: options.logLevel || 'info',
      enableProtocolLogging: options.enableProtocolLogging || false,
      retries: options.retries ?? 0,
      retryDelay: options.retryDelay ?? 1000,
      startupDelay: options.startupDelay ?? 500,
    };

    this.notificationHandlers = {};
    this.retryOptions = {
      ...DEFAULT_RETRY_OPTIONS,
      maxAttempts: (this.options.retries ?? 0) > 0 ? (this.options.retries ?? 0) + 1 : 1,
      baseDelay: this.options.retryDelay ?? DEFAULT_RETRY_OPTIONS.baseDelay,
    };

    this.logger =
      this.options.logLevel === 'none'
        ? new NoOpLogger()
        : new ConsoleLogger({ level: this.options.logLevel, prefix: 'MCPClient' });
  }

  /**
   * Starts the client and connects to the MCP server.
   *
   * Spawns the server process and establishes the MCP connection.
   * The server process lifecycle is managed by StdioClientTransport.
   *
   * @param config - Server configuration including command and arguments
   * @throws `MCPAlreadyStartedError` if client is already started
   * @throws Error if server fails to start
   * @example
   * ```typescript
   * await client.start({
   *   command: 'node',
   *   args: ['./server.js', '--production'],
   *   env: { NODE_ENV: 'production' },
   * });
   * ```
   */
  async start(config: MCPServerConfig): Promise<void> {
    if (this.client) {
      throw new MCPAlreadyStartedError();
    }

    this.logger.info(`Starting MCP client: ${this.options.name} v${this.options.version}`);
    this.logger.debug(`Server command: ${config.command}`, config.args || []);

    const mergedEnv = mergeEnvironments(process.env, config.env);

    try {
      // Use StdioClientTransport to spawn the server process (single process)
      this.transport = new StdioClientTransport({
        command: config.command,
        args: config.args || [],
        env: mergedEnv,
      });

      this.client = new Client(
        {
          name: this.options.name || 'mcp-test-client',
          version: this.options.version || '1.0.0',
        },
        {
          capabilities: {
            roots: {
              listChanged: true,
            },
            sampling: {},
            elicitation: {
              form: {},
            },
          },
        }
      );

      this.client.onerror = (error) => {
        this.logger.error('Client error:', error);
      };

      this.setupNotificationHandlers();

      await this.client.connect(this.transport);
      this.logger.info('Successfully connected to MCP server');
    } catch (error) {
      this.logger.error('Failed to start MCP client:', error);
      if (this.transport) {
        try {
          await this.transport.close();
        } catch {
          // ignore cleanup errors
        }
        this.transport = null;
      }
      this.client = null;
      if (error instanceof MCPClientError) {
        throw error;
      }
      throw new MCPConnectionError(
        `Failed to connect to MCP server: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Stops the client and disconnects from the MCP server.
   *
   * Closes the MCP connection and terminates the server process.
   * Safe to call even if the client is not connected.
   *
   * @example
   * ```typescript
   * await client.stop();
   * ```
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping MCP client');

    if (this.client) {
      try {
        await this.client.close();
      } catch (error) {
        this.logger.warn('Error closing client:', error);
      }
      this.client = null;
    }

    if (this.transport) {
      try {
        await this.transport.close();
      } catch (error) {
        this.logger.warn('Error closing transport:', error);
      }
      this.transport = null;
    }

    this.logger.info('MCP client stopped');
  }

  private setupNotificationHandlers(): void {
    if (!this.client) return;

    this.client.setNotificationHandler(LoggingMessageNotificationSchema, (notification) => {
      if (this.notificationHandlers.onLoggingMessage) {
        this.notificationHandlers.onLoggingMessage(
          notification.params.level,
          String(notification.params.data)
        );
      }
      this.logger.debug(
        `[${notification.params.level}] ${String(notification.params.data).substring(0, 100)}`
      );
    });

    this.client.setNotificationHandler(ResourceListChangedNotificationSchema, async () => {
      if (this.notificationHandlers.onResourceListChanged) {
        this.notificationHandlers.onResourceListChanged();
      }
      this.logger.debug('Resource list changed notification received');
    });
  }

  /**
   * Lists all available tools from the MCP server.
   *
   * @returns Promise resolving to an array of Tool objects
   * @throws `MCPNotStartedError` if client is not started
   * @example
   * ```typescript
   * const tools = await client.listTools();
   * console.log(tools.map(t => t.name)); // ['echo', 'add', 'calculate']
   * ```
   */
  async listTools(): Promise<Tool[]> {
    if (!this.client) {
      throw new MCPNotStartedError();
    }

    const request: ListToolsRequest = {
      method: 'tools/list',
      params: {},
    };

    if (this.options.enableProtocolLogging) {
      this.logger.debug('Request:', request);
    }

    try {
      const result = await this.withRetry(async () =>
        this.client!.request(request, ListToolsResultSchema)
      );
      const tools = result.tools || [];
      this.logger.debug(`Listed ${tools.length} tools`);
      return tools;
    } catch (error) {
      this.logger.error('Failed to list tools:', error);
      this.wrapError(error, 'List tools');
    }
  }

  /**
   * Calls a tool on the MCP server with optional arguments.
   *
   * @param options - Tool call options including name and arguments
   * @returns Promise resolving to the tool result
   * @throws `MCPNotStartedError` if client is not started
   * @throws `MCPServerError` if the tool call fails
   * @example
   * ```typescript
   * const result = await client.callTool({
   *   name: 'calculator',
   *   arguments: { a: 5, b: 3 },
   *   timeout: 10000,
   * });
   * console.log(result.content[0].text);
   * ```
   */
  async callTool(options: ToolCallOptions): Promise<CallToolResult> {
    if (!this.client) {
      throw new MCPNotStartedError();
    }

    const request: CallToolRequest = {
      method: 'tools/call',
      params: {
        name: options.name,
        arguments: options.arguments || {},
      },
    };

    if (this.options.enableProtocolLogging) {
      this.logger.debug(`Calling tool: ${options.name}`, options.arguments);
    }

    try {
      const timeout = options.timeout ?? this.options.timeout;
      const result = await this.withRetry(
        async () => this.client!.request(request, CallToolResultSchema, { timeout }),
        options.retries
      );
      this.logger.debug(`Tool ${options.name} executed successfully`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to call tool ${options.name}:`, error);
      this.wrapError(error, `Call tool ${options.name}`, options.timeout ?? this.options.timeout);
    }
  }

  /**
   * Lists all available resources from the MCP server.
   *
   * @returns Promise resolving to an array of Resource objects
   * @throws `MCPNotStartedError` if client is not started
   * @example
   * ```typescript
   * const resources = await client.listResources();
   * console.log(resources.map(r => r.uri)); // ['config://settings', 'data://users']
   * ```
   */
  async listResources(): Promise<Resource[]> {
    if (!this.client) {
      throw new MCPNotStartedError();
    }

    const request: ListResourcesRequest = {
      method: 'resources/list',
      params: {},
    };

    if (this.options.enableProtocolLogging) {
      this.logger.debug('Request:', request);
    }

    try {
      const result = await this.withRetry(async () =>
        this.client!.request(request, ListResourcesResultSchema)
      );
      const resources = result.resources || [];
      this.logger.debug(`Listed ${resources.length} resources`);
      return resources;
    } catch (error) {
      this.logger.error('Failed to list resources:', error);
      this.wrapError(error, 'List resources');
    }
  }

  /**
   * Reads a specific resource by its URI.
   *
   * @param uri - The URI of the resource to read
   * @returns Promise resolving to the resource contents
   * @throws `MCPNotStartedError` if client is not started
   * @throws Error if the resource is not found or cannot be read
   * @example
   * ```typescript
   * const result = await client.readResource('config://settings');
   * console.log(result.contents[0].text);
   * ```
   */
  async readResource(uri: string): Promise<ReadResourceResult> {
    if (!this.client) {
      throw new MCPNotStartedError();
    }

    const request: ReadResourceRequest = {
      method: 'resources/read',
      params: { uri },
    };

    if (this.options.enableProtocolLogging) {
      this.logger.debug(`Reading resource: ${uri}`);
    }

    try {
      const result = await this.withRetry(async () =>
        this.client!.request(request, ReadResourceResultSchema)
      );
      this.logger.debug(`Resource ${uri} read successfully`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to read resource ${uri}:`, error);
      this.wrapError(error, `Read resource ${uri}`);
    }
  }

  /**
   * Lists all available prompts from the MCP server.
   *
   * @returns Promise resolving to an array of Prompt objects
   * @throws `MCPNotStartedError` if client is not started
   * @example
   * ```typescript
   * const prompts = await client.listPrompts();
   * console.log(prompts.map(p => p.name)); // ['greet', 'summarize']
   * ```
   */
  async listPrompts(): Promise<Prompt[]> {
    if (!this.client) {
      throw new MCPNotStartedError();
    }

    const request: ListPromptsRequest = {
      method: 'prompts/list',
      params: {},
    };

    if (this.options.enableProtocolLogging) {
      this.logger.debug('Request:', request);
    }

    try {
      const result = await this.withRetry(async () =>
        this.client!.request(request, ListPromptsResultSchema)
      );
      const prompts = result.prompts || [];
      this.logger.debug(`Listed ${prompts.length} prompts`);
      return prompts;
    } catch (error) {
      this.logger.error('Failed to list prompts:', error);
      this.wrapError(error, 'List prompts');
    }
  }

  /**
   * Gets a prompt template from the MCP server with optional arguments.
   *
   * @param name - Name of the prompt to retrieve
   * @param args - Optional arguments for the prompt template
   * @returns Promise resolving to the prompt messages
   * @throws `MCPNotStartedError` if client is not started
   * @throws Error if the prompt is not found
   * @example
   * ```typescript
   * const messages = await client.getPrompt('greet', { name: 'Alice' });
   * console.log(messages[0].content.text); // 'Hello Alice!'
   * ```
   */
  async getPrompt(name: string, args?: Record<string, string>): Promise<GetPromptResult> {
    if (!this.client) {
      throw new MCPNotStartedError();
    }

    const request: GetPromptRequest = {
      method: 'prompts/get',
      params: {
        name,
        arguments: args || {},
      },
    };

    if (this.options.enableProtocolLogging) {
      this.logger.debug(`Getting prompt: ${name}`, args);
    }

    try {
      const result = await this.withRetry(async () =>
        this.client!.request(request, GetPromptResultSchema)
      );
      this.logger.debug(`Prompt ${name} retrieved successfully`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to get prompt ${name}:`, error);
      this.wrapError(error, `Get prompt ${name}`);
    }
  }

  /**
   * Requests LLM sampling from the MCP server.
   *
   * @param request - Sampling request parameters including messages
   * @returns Promise resolving to the sampling result
   * @throws `MCPNotStartedError` if client is not started
   * @throws Error if sampling is not supported or fails
   * @example
   * ```typescript
   * const result = await client.requestSampling({
   *   messages: [{ role: 'user', content: { type: 'text', text: 'Hello' } }],
   *   maxTokens: 100,
   * });
   * console.log(result.content.text);
   * ```
   */
  async requestSampling(request: CreateMessageRequestParams): Promise<CreateMessageResult> {
    if (!this.client) {
      throw new MCPNotStartedError();
    }

    if (this.options.enableProtocolLogging) {
      this.logger.debug('Sampling request:', request);
    }

    try {
      const result = await this.withRetry(async () =>
        this.client!.request(
          {
            method: 'sampling/createMessage',
            params: request,
          },
          CreateMessageResultSchema
        )
      );
      this.logger.debug('Sampling completed successfully');
      return result;
    } catch (error) {
      this.logger.error('Failed to request sampling:', error);
      this.wrapError(error, 'Request sampling');
    }
  }

  /**
   * Configures a handler for server elicitation requests.
   *
   * Elicitation requests are sent when the server needs user input.
   *
   * @param handler - Async function that handles elicitation requests
   * @throws `MCPNotStartedError` if client is not started
   * @example
   * ```typescript
   * await client.setElicitationHandler(async (request) => {
   *   console.log('Elicitation request:', request.params);
   *   return { action: 'accept', content: { userInput: 'test' } };
   * });
   * ```
   */
  async setElicitationHandler(
    handler: (request: {
      params: { mode?: string; [key: string]: unknown };
    }) => Promise<{ action: 'accept' | 'decline' | 'cancel'; content?: Record<string, unknown> }>
  ): Promise<void> {
    if (!this.client) {
      return;
    }

    this.client.setRequestHandler(ElicitRequestSchema, handler);
    this.logger.debug('Elicitation handler configured');
  }

  /**
   * Configures handlers for server-initiated notifications.
   *
   * @param handlers - Object containing notification handlers
   * @example
   * ```typescript
   * client.setNotificationHandlers({
   *   onLoggingMessage: (level, data) => {
   *     console.log(`[${level}] ${data}`);
   *   },
   *   onResourceListChanged: () => {
   *     console.log('Resources updated');
   *   },
   * });
   * ```
   */
  setNotificationHandlers(handlers: NotificationHandler): void {
    this.notificationHandlers = handlers;
    this.setupNotificationHandlers();
    this.logger.debug('Notification handlers updated');
  }

  /**
   * Checks if the client is currently connected to an MCP server.
   *
   * @returns true if connected, false otherwise
   * @example
   * ```typescript
   * if (client.isConnected()) {
   *   console.log('Client is connected');
   * }
   * ```
   */
  isConnected(): boolean {
    return this.client !== null && this.transport !== null;
  }

  /**
   * Sets the logging level for the client.
   *
   * @param level - The log level to set
   * @example
   * ```typescript
   * client.setLogLevel('debug');
   * ```
   */
  setLogLevel(level: LogLevel): void {
    this.options.logLevel = level;
    this.logger =
      level === 'none' ? new NoOpLogger() : new ConsoleLogger({ level, prefix: 'MCPClient' });
    this.logger.debug(`Log level changed to ${level}`);
  }

  private wrapError(error: unknown, operation: string, timeout?: number): never {
    if (error instanceof MCPClientError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes('timeout') || message.toLowerCase().includes('timed out')) {
      throw new MCPTimeoutError(
        `${operation} timed out: ${message}`,
        timeout ?? this.options.timeout ?? 30000
      );
    }
    throw new MCPServerError(`${operation} failed: ${message}`);
  }

  private async withRetry<T>(operation: () => Promise<T>, retries?: number): Promise<T> {
    const maxAttempts = retries !== undefined ? retries + 1 : this.retryOptions.maxAttempts;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxAttempts) {
          throw error;
        }

        const delay = Math.min(
          this.retryOptions.baseDelay * Math.pow(this.retryOptions.backoffMultiplier, attempt - 1),
          this.retryOptions.maxDelay
        );

        this.logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`, error);
        await this.sleep(delay);
      }
    }

    throw new MCPClientError('Retry logic exhausted without result');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

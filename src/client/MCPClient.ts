import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn, ChildProcess } from 'child_process';
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
  MCPConnectionError,
  MCPNotStartedError,
  MCPAlreadyStartedError,
  MCPServerError,
} from '../utils/errors.js';

export interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string | undefined>;
  startupDelay?: number;
}

export interface MCPClientOptions {
  name?: string;
  version?: string;
  timeout?: number;
  logLevel?: LogLevel;
  enableProtocolLogging?: boolean;
  retries?: number;
  retryDelay?: number;
  startupDelay?: number;
}

export interface ToolCallOptions {
  name: string;
  arguments?: Record<string, unknown>;
  timeout?: number;
  retries?: number;
}

export interface NotificationHandler {
  onLoggingMessage?: (level: string, data: string) => void;
  onResourceListChanged?: () => void;
}

export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
};

export class MCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private serverProcess: ChildProcess | null = null;
  private options: MCPClientOptions;
  private notificationHandlers: NotificationHandler;
  private logger: Logger;
  private retryOptions: RetryOptions;

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

  async start(config: MCPServerConfig): Promise<void> {
    if (this.client) {
      throw new MCPAlreadyStartedError();
    }

    this.logger.info(`Starting MCP client: ${this.options.name} v${this.options.version}`);
    this.logger.debug(`Server command: ${config.command}`, config.args || []);

    const mergedEnv = mergeEnvironments(process.env, config.env);

    try {
      this.serverProcess = spawn(config.command, config.args || [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: mergedEnv,
      });

      if (this.serverProcess.stderr) {
        this.serverProcess.stderr.on('data', (data) => {
          this.logger.debug('[Server stderr]', data.toString());
        });
      }

      this.serverProcess.on('error', (error) => {
        this.logger.error('Server process error:', error);
        throw new MCPConnectionError(`Failed to spawn server: ${error.message}`);
      });

      this.serverProcess.on('exit', (code, signal) => {
        this.logger.debug(`Server exited with code ${code}, signal ${signal}`);
      });

      const startupDelay = config.startupDelay ?? this.options.startupDelay ?? 500;
      if (startupDelay > 0) {
        this.logger.debug(`Waiting ${startupDelay}ms for server startup`);
        await this.sleep(startupDelay);
      }

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
      if (this.serverProcess) {
        this.serverProcess.kill();
        this.serverProcess = null;
      }
      this.transport = null;
      this.client = null;
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping MCP client');

    if (this.transport) {
      try {
        await this.transport.close();
      } catch (error) {
        this.logger.warn('Error closing transport:', error);
      }
      this.transport = null;
    }

    if (this.serverProcess) {
      try {
        this.serverProcess.kill('SIGTERM');
        await this.sleep(1000);
        if (this.serverProcess.kill('SIGKILL')) {
          this.logger.debug('Force killed server process');
        }
      } catch (error) {
        this.logger.warn('Error killing server process:', error);
      }
      this.serverProcess = null;
    }

    this.client = null;
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
      throw new MCPServerError(
        `Failed to list tools: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

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
      throw new MCPServerError(
        `Failed to call tool ${options.name}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

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
      throw new MCPServerError(
        `Failed to list resources: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

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
      throw new MCPServerError(
        `Failed to read resource ${uri}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

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
      throw new MCPServerError(
        `Failed to list prompts: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

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
      throw new MCPServerError(
        `Failed to get prompt ${name}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

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
      throw new MCPServerError(
        `Failed to request sampling: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async setElicitationHandler(handler: (request: any) => Promise<any>): Promise<void> {
    if (!this.client) {
      return;
    }

    this.client.setRequestHandler(ElicitRequestSchema, handler);
    this.logger.debug('Elicitation handler configured');
  }

  setNotificationHandlers(handlers: NotificationHandler): void {
    this.notificationHandlers = handlers;
    this.setupNotificationHandlers();
    this.logger.debug('Notification handlers updated');
  }

  isConnected(): boolean {
    return this.client !== null && this.transport !== null;
  }

  setLogLevel(level: LogLevel): void {
    this.options.logLevel = level;
    this.logger =
      level === 'none' ? new NoOpLogger() : new ConsoleLogger({ level, prefix: 'MCPClient' });
    this.logger.debug(`Log level changed to ${level}`);
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

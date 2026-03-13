import { MCPClient, MCPServerConfig } from '../client/MCPClient.js';
import { MCPClientOptions } from '../client/index.js';

/**
 * Test utilities for MCP Client testing
 * Reduces boilerplate and provides common patterns
 */

/**
 * Default test client options
 */
export const DEFAULT_TEST_CLIENT_OPTIONS: MCPClientOptions = {
  name: 'test-client',
  version: '1.0.0',
  timeout: 30000,
  logLevel: 'error', // Silence logs in tests
};

/**
 * Default test server configuration
 */
export const DEFAULT_TEST_SERVER_CONFIG: MCPServerConfig = {
  command: 'node',
  args: ['./dist/__tests__/fixtures/mock-server.js'],
  env: {
    NODE_ENV: 'test',
  },
};

/**
 * Create a test client with default options
 * @param options - Override default options
 * @returns Configured MCPClient instance
 */
export function createTestClient(options?: Partial<MCPClientOptions>): MCPClient {
  return new MCPClient({
    ...DEFAULT_TEST_CLIENT_OPTIONS,
    ...options,
  });
}

/**
 * Create a test suite helper with automatic cleanup
 * Sets up client, server, and provides teardown function
 *
 * @param serverConfig - Server configuration
 * @param clientOptions - Client configuration (optional)
 * @returns Object with client, setup, and teardown functions
 */
export interface TestSuite {
  client: MCPClient;
  setup: () => Promise<void>;
  teardown: () => Promise<void>;
}

export function createTestSuite(
  serverConfig: MCPServerConfig,
  clientOptions?: Partial<MCPClientOptions>
): TestSuite {
  const client = createTestClient(clientOptions);
  let isStarted = false;

  return {
    client,

    /**
     * Start the client and connect to server
     */
    async setup(): Promise<void> {
      if (!isStarted) {
        await client.start(serverConfig);
        isStarted = true;
      }
    },

    /**
     * Stop the client and disconnect from server
     * Safe to call multiple times
     */
    async teardown(): Promise<void> {
      if (isStarted && client.isConnected()) {
        await client.stop();
        isStarted = false;
      }
    },
  };
}

/**
 * Setup client and server for a single test
 * Usage in beforeEach hook
 *
 * @param serverConfig - Server configuration
 * @param clientOptions - Client configuration (optional)
 * @returns MCPClient instance
 */
export async function setupTestServer(
  serverConfig: MCPServerConfig,
  clientOptions?: Partial<MCPClientOptions>
): Promise<MCPClient> {
  const client = createTestClient(clientOptions);
  await client.start(serverConfig);
  return client;
}

/**
 * Teardown test server
 * Usage in afterEach hook
 *
 * @param client - MCPClient instance to stop
 */
export async function teardownTestServer(client: MCPClient): Promise<void> {
  if (client.isConnected()) {
    await client.stop();
  }
}

/**
 * Wait for client to be in a specific state
 * @param client - MCPClient instance
 * @param isConnected - Expected connection state
 * @param timeout - Maximum time to wait (ms)
 * @returns Promise that resolves when state is reached
 */
export function waitForClientState(
  client: MCPClient,
  isConnected: boolean,
  timeout: number = 5000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkState = () => {
      if (client.isConnected() === isConnected) {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(
          new Error(
            `Timeout waiting for client to be ${isConnected ? 'connected' : 'disconnected'}`
          )
        );
      } else {
        setTimeout(checkState, 100);
      }
    };

    checkState();
  });
}

/**
 * Create a mock server config for testing
 * @param args - Command arguments
 * @returns MCPServerConfig
 */
export function createMockServerConfig(
  args: string[] = ['./dist/__tests__/fixtures/mock-server.js']
): MCPServerConfig {
  return {
    command: 'node',
    args,
    env: {
      NODE_ENV: 'test',
    },
  };
}

/**
 * Helper to run async test with timeout
 * @param fn - Async function to run
 * @param timeout - Maximum time to wait (ms)
 * @returns Promise that resolves or rejects after timeout
 */
export async function runWithTimeout<T>(fn: () => Promise<T>, timeout: number = 10000): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Test timed out after ${timeout}ms`)), timeout)
    ),
  ]);
}

/**
 * Retry a function until it succeeds or max attempts reached
 * @param fn - Async function to retry
 * @param maxAttempts - Maximum number of attempts
 * @param delay - Delay between attempts (ms)
 * @returns Promise that resolves with function result
 */
export async function retryUntil<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Unknown error in retryUntil');
}

/**
 * Create a tool call test helper
 * @param client - MCPClient instance
 * @param toolName - Tool name to call
 * @param args - Tool arguments
 * @returns Tool call result
 */
export async function callTool(
  client: MCPClient,
  toolName: string,
  args: Record<string, unknown> = {}
) {
  return await client.callTool({
    name: toolName,
    arguments: args,
  });
}

/**
 * Validate tool result
 * @param result - Tool call result
 * @returns Validation result
 */
export function validateToolResult(result: unknown): {
  valid: boolean;
  error?: string;
} {
  if (!result) {
    return { valid: false, error: 'Result is null or undefined' };
  }

  if (typeof result !== 'object') {
    return { valid: false, error: 'Result is not an object' };
  }

  // @ts-expect-error - TypeScript validation
  if (!result.content) {
    return { valid: false, error: 'Result missing content property' };
  }

  // @ts-expect-error - Checking content property type
  if (!Array.isArray(result.content)) {
    return { valid: false, error: 'Result content is not an array' };
  }

  return { valid: true };
}

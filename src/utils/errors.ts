/**
 * Error classes for MCPClient operations.
 *
 * All errors include a descriptive message, error code, and proper stack trace.
 *
 * @example
 * ```typescript
 * try {
 *   await client.callTool({ name: 'invalid-tool', arguments: {} });
 * } catch (error) {
 *   if (error instanceof MCPServerError) {
 *     console.error(`Server error: ${error.message}`);
 *   } else if (error instanceof MCPTimeoutError) {
 *     console.error(`Timeout after ${error.timeout}ms`);
 *   }
 * }
 * ```
 */

/**
 * Base error class for all MCP client errors.
 */
export class MCPClientError extends Error {
  /** Error code for programmatic error handling. */
  public readonly code: string;

  constructor(message: string, code: string = 'MCP_CLIENT_ERROR') {
    super(message);
    this.name = 'MCPClientError';
    this.code = code;
    Error.captureStackTrace(this, MCPClientError);
  }
}

/**
 * Error thrown when a request times out.
 */
export class MCPTimeoutError extends MCPClientError {
  /** The timeout value in milliseconds. */
  public readonly timeout: number;

  constructor(message: string, timeout: number) {
    super(message, 'MCP_TIMEOUT_ERROR');
    this.name = 'MCPTimeoutError';
    this.timeout = timeout;
    Error.captureStackTrace(this, MCPTimeoutError);
  }
}

/**
 * Error thrown when the client fails to connect to the MCP server.
 */
export class MCPConnectionError extends MCPClientError {
  constructor(message: string) {
    super(message, 'MCP_CONNECTION_ERROR');
    this.name = 'MCPConnectionError';
    Error.captureStackTrace(this, MCPConnectionError);
  }
}

/**
 * Error thrown when a client method is called before start().
 */
export class MCPNotStartedError extends MCPClientError {
  constructor() {
    super('Client not started. Call start() before using client methods.', 'MCP_NOT_STARTED');
    this.name = 'MCPNotStartedError';
    Error.captureStackTrace(this, MCPNotStartedError);
  }
}

/**
 * Error thrown when start() is called on an already-started client.
 */
export class MCPAlreadyStartedError extends MCPClientError {
  constructor() {
    super('Client already started. Call stop() before starting again.', 'MCP_ALREADY_STARTED');
    this.name = 'MCPAlreadyStartedError';
    Error.captureStackTrace(this, MCPAlreadyStartedError);
  }
}

/**
 * Error thrown when the MCP server returns an error response.
 */
export class MCPServerError extends MCPClientError {
  constructor(message: string) {
    super(message, 'MCP_SERVER_ERROR');
    this.name = 'MCPServerError';
    Error.captureStackTrace(this, MCPServerError);
  }
}

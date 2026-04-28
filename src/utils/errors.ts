/**
 * Error classes for MCPClient operations.
 *
 * All errors include a descriptive message, error code, and proper stack trace.
 * Timeout and connection errors include actionable suggestions for debugging.
 *
 * @example
 * ```typescript
 * try {
 *   await client.callTool({ name: 'invalid-tool', arguments: {} });
 * } catch (error) {
 *   if (error instanceof MCPServerError) {
 *     console.error(`Server error: ${error.message}`);
 *     console.error(`Operation: ${error.operation}`);
 *   } else if (error instanceof MCPTimeoutError) {
 *     console.error(`Timeout after ${error.timeout}ms on ${error.operation}`);
 *     console.error(`Suggestions: ${error.suggestions.join(', ')}`);
 *   } else if (error instanceof MCPConnectionError) {
 *     console.error(`Connection failed: ${error.message}`);
 *     console.error(`Command: ${error.command}`);
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
 *
 * Includes the operation that timed out, the timeout value, and
 * actionable suggestions for resolving the timeout.
 */
export class MCPTimeoutError extends MCPClientError {
  /** The timeout value in milliseconds. */
  public readonly timeout: number;

  /** The operation that timed out (e.g., "Call tool echo", "List tools"). */
  public readonly operation: string;

  /** Actionable suggestions for resolving the timeout. */
  public readonly suggestions: string[];

  constructor(message: string, timeout: number, operation?: string, suggestions?: string[]) {
    super(message, 'MCP_TIMEOUT_ERROR');
    this.name = 'MCPTimeoutError';
    this.timeout = timeout;
    this.operation = operation || 'unknown operation';
    this.suggestions = suggestions || MCPTimeoutError.defaultSuggestions(timeout);
    Error.captureStackTrace(this, MCPTimeoutError);
  }

  /**
   * Generate default suggestions based on timeout value.
   */
  private static defaultSuggestions(timeout: number): string[] {
    const suggestions: string[] = [
      `Increase timeout (current: ${timeout}ms) — pass a higher 'timeout' option`,
      'Check that the MCP server is running and responsive',
    ];

    if (timeout < 5000) {
      suggestions.push(
        'The timeout is very low — consider using at least 5000ms for CI environments'
      );
    }

    if (timeout < 10000) {
      suggestions.push('Network/server latency may require 10000ms+ in CI environments');
    }

    suggestions.push('Enable debug logging for more detail: new MCPClient({ logLevel: "debug" })');

    return suggestions;
  }
}

/**
 * Error thrown when the client fails to connect to the MCP server.
 *
 * Includes the server command and actionable suggestions for resolving
 * connection failures.
 */
export class MCPConnectionError extends MCPClientError {
  /** The command that was used to start the server. */
  public readonly command: string;

  /** Actionable suggestions for resolving the connection failure. */
  public readonly suggestions: string[];

  constructor(message: string, command?: string, suggestions?: string[]) {
    super(message, 'MCP_CONNECTION_ERROR');
    this.name = 'MCPConnectionError';
    this.command = command || 'unknown';
    this.suggestions = suggestions || MCPConnectionError.defaultSuggestions(command);
    Error.captureStackTrace(this, MCPConnectionError);
  }

  /**
   * Generate default suggestions based on the server command.
   */
  private static defaultSuggestions(command?: string): string[] {
    const suggestions: string[] = [
      'Verify the server command is correct and the executable exists',
      'Check that the server starts successfully when run manually',
      'Ensure the server communicates via stdio (stdin/stdout)',
    ];

    if (command === 'node' || command?.startsWith('node')) {
      suggestions.push('Make sure the Node.js script path is correct and the file exists');
      suggestions.push('Run the script directly to check for startup errors: node <path>');
    }

    if (command === 'python' || command === 'python3' || command?.startsWith('python')) {
      suggestions.push('Ensure the Python environment has all required dependencies installed');
      suggestions.push('Check that the Python script path is correct and the file exists');
    }

    if (command === 'npx') {
      suggestions.push('Verify the npm package name is correct and published');
      suggestions.push('Try installing the package globally first: npm install -g <package>');
    }

    suggestions.push('Enable debug logging for more detail: new MCPClient({ logLevel: "debug" })');

    return suggestions;
  }
}

/**
 * Error thrown when a client method is called before start().
 *
 * Includes which method was called to help identify the issue.
 */
export class MCPNotStartedError extends MCPClientError {
  /** The method that was called on the unstarted client. */
  public readonly method: string;

  constructor(method?: string) {
    const methodInfo = method ? ` (called ${method}())` : '';
    super(
      `Client not started${methodInfo}. Call start() before using client methods.`,
      'MCP_NOT_STARTED'
    );
    this.name = 'MCPNotStartedError';
    this.method = method || 'unknown';
    Error.captureStackTrace(this, MCPNotStartedError);
  }
}

/**
 * Error thrown when start() is called on an already-started client.
 */
export class MCPAlreadyStartedError extends MCPClientError {
  constructor() {
    super(
      'Client already started. Call stop() before starting again, or create a new MCPClient instance.',
      'MCP_ALREADY_STARTED'
    );
    this.name = 'MCPAlreadyStartedError';
    Error.captureStackTrace(this, MCPAlreadyStartedError);
  }
}

/**
 * Error thrown when the MCP server returns an error response.
 *
 * Includes the operation that failed and the server error code if available.
 */
export class MCPServerError extends MCPClientError {
  /** The operation that failed (e.g., "Call tool echo", "Read resource config://settings"). */
  public readonly operation: string;

  /** The MCP error code from the server response, if available. */
  public readonly serverCode?: number | string;

  constructor(message: string, operation?: string, serverCode?: number | string) {
    super(message, 'MCP_SERVER_ERROR');
    this.name = 'MCPServerError';
    this.operation = operation || 'unknown operation';
    this.serverCode = serverCode;
    Error.captureStackTrace(this, MCPServerError);
  }
}

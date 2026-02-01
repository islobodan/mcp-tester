export class MCPClientError extends Error {
  public readonly code: string;

  constructor(message: string, code: string = 'MCP_CLIENT_ERROR') {
    super(message);
    this.name = 'MCPClientError';
    this.code = code;
    Error.captureStackTrace(this, MCPClientError);
  }
}

export class MCPTimeoutError extends MCPClientError {
  public readonly timeout: number;

  constructor(message: string, timeout: number) {
    super(message, 'MCP_TIMEOUT_ERROR');
    this.name = 'MCPTimeoutError';
    this.timeout = timeout;
    Error.captureStackTrace(this, MCPTimeoutError);
  }
}

export class MCPConnectionError extends MCPClientError {
  constructor(message: string) {
    super(message, 'MCP_CONNECTION_ERROR');
    this.name = 'MCPConnectionError';
    Error.captureStackTrace(this, MCPConnectionError);
  }
}

export class MCPNotStartedError extends MCPClientError {
  constructor() {
    super('Client not started. Call start() before using client methods.', 'MCP_NOT_STARTED');
    this.name = 'MCPNotStartedError';
    Error.captureStackTrace(this, MCPNotStartedError);
  }
}

export class MCPAlreadyStartedError extends MCPClientError {
  constructor() {
    super('Client already started. Call stop() before starting again.', 'MCP_ALREADY_STARTED');
    this.name = 'MCPAlreadyStartedError';
    Error.captureStackTrace(this, MCPAlreadyStartedError);
  }
}

export class MCPServerError extends MCPClientError {
  constructor(message: string) {
    super(message, 'MCP_SERVER_ERROR');
    this.name = 'MCPServerError';
    Error.captureStackTrace(this, MCPServerError);
  }
}

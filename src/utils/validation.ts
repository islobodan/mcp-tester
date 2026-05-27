/**
 * Input validation utilities for MCPClient.
 *
 * Validates all user-facing inputs and throws descriptive `MCPClientError`
 * with actionable messages when validation fails.
 */

import { MCPClientError } from './errors.js';

/**
 * Validate `start()` config — command is required and must be a non-empty string.
 */
export function validateServerConfig(config: unknown): asserts config is {
  command: string;
  args?: string[];
  env?: Record<string, string | undefined>;
  startupDelay?: number;
} {
  if (config === null || config === undefined) {
    throw new MCPClientError(
      'Server config is required. Pass an object with at least { command: "node" }.',
      'MCP_INVALID_CONFIG'
    );
  }

  if (typeof config !== 'object' || Array.isArray(config)) {
    throw new MCPClientError(
      `Server config must be an object, got ${typeof config}.` +
        ' Example: { command: "node", args: ["./server.js"] }',
      'MCP_INVALID_CONFIG'
    );
  }

  const cfg = config as Record<string, unknown>;

  // command
  if (!('command' in cfg) || cfg.command === undefined || cfg.command === null) {
    throw new MCPClientError(
      'Server config.command is required.' +
        ' Specify the executable to run, e.g. { command: "node", args: ["./server.js"] }.',
      'MCP_INVALID_CONFIG'
    );
  }

  if (typeof cfg.command !== 'string') {
    throw new MCPClientError(
      `Server config.command must be a string, got ${typeof cfg.command}.` +
        ' Example: "node", "python", "npx"',
      'MCP_INVALID_CONFIG'
    );
  }

  if (cfg.command.trim() === '') {
    throw new MCPClientError(
      'Server config.command cannot be empty.' +
        ' Specify the executable to run, e.g. "node", "python", "npx".',
      'MCP_INVALID_CONFIG'
    );
  }

  // args (optional)
  if ('args' in cfg && cfg.args !== undefined) {
    if (!Array.isArray(cfg.args)) {
      throw new MCPClientError(
        `Server config.args must be an array of strings, got ${typeof cfg.args}.` +
          ' Example: ["./server.js", "--port", "3000"]',
        'MCP_INVALID_CONFIG'
      );
    }

    for (let i = 0; i < cfg.args.length; i++) {
      if (typeof cfg.args[i] !== 'string') {
        throw new MCPClientError(
          `Server config.args[${i}] must be a string, got ${typeof cfg.args[i]}.` +
            ` Full args: ${JSON.stringify(cfg.args)}`,
          'MCP_INVALID_CONFIG'
        );
      }
    }
  }

  // env (optional)
  if ('env' in cfg && cfg.env !== undefined) {
    if (typeof cfg.env !== 'object' || cfg.env === null || Array.isArray(cfg.env)) {
      throw new MCPClientError(
        `Server config.env must be an object, got ${typeof cfg.env}.` +
          ' Example: { NODE_ENV: "production", API_KEY: "..." }',
        'MCP_INVALID_CONFIG'
      );
    }

    const envKeys = Object.keys(cfg.env as Record<string, unknown>);
    for (const key of envKeys) {
      const val = (cfg.env as Record<string, unknown>)[key];
      if (val !== undefined && typeof val !== 'string') {
        throw new MCPClientError(
          `Server config.env["${key}"] must be a string or undefined, got ${typeof val}.` +
            ' Environment variable values must be strings.',
          'MCP_INVALID_CONFIG'
        );
      }
    }
  }

  // startupDelay (optional)
  if ('startupDelay' in cfg && cfg.startupDelay !== undefined) {
    if (typeof cfg.startupDelay !== 'number' || isNaN(cfg.startupDelay)) {
      throw new MCPClientError(
        `Server config.startupDelay must be a number, got ${typeof cfg.startupDelay}.` +
          ' Example: 500 (milliseconds)',
        'MCP_INVALID_CONFIG'
      );
    }

    if (cfg.startupDelay < 0) {
      throw new MCPClientError(
        `Server config.startupDelay must be non-negative, got ${cfg.startupDelay}.`,
        'MCP_INVALID_CONFIG'
      );
    }
  }
}

/**
 * Validate `callTool()` options — tool name is required.
 */
export function validateToolCallOptions(options: unknown): asserts options is {
  name: string;
  arguments?: Record<string, unknown>;
  timeout?: number;
  retries?: number;
} {
  if (options === null || options === undefined) {
    throw new MCPClientError(
      'Tool call options are required. Pass { name: "tool-name", arguments: {} }.',
      'MCP_INVALID_TOOL_CALL'
    );
  }

  if (typeof options !== 'object' || Array.isArray(options)) {
    throw new MCPClientError(
      `Tool call options must be an object, got ${typeof options}.`,
      'MCP_INVALID_TOOL_CALL'
    );
  }

  const opts = options as Record<string, unknown>;

  // name
  if (!('name' in opts) || opts.name === undefined || opts.name === null) {
    throw new MCPClientError(
      'Tool name is required. Pass { name: "tool-name" }.',
      'MCP_INVALID_TOOL_CALL'
    );
  }

  if (typeof opts.name !== 'string') {
    throw new MCPClientError(
      `Tool name must be a string, got ${typeof opts.name}.`,
      'MCP_INVALID_TOOL_CALL'
    );
  }

  if ((opts.name as string).trim() === '') {
    throw new MCPClientError(
      'Tool name cannot be empty. Specify the tool to call, e.g. { name: "echo" }.',
      'MCP_INVALID_TOOL_CALL'
    );
  }

  // arguments (optional)
  if ('arguments' in opts && opts.arguments !== undefined) {
    if (
      typeof opts.arguments !== 'object' ||
      opts.arguments === null ||
      Array.isArray(opts.arguments)
    ) {
      throw new MCPClientError(
        `Tool arguments must be an object, got ${typeof opts.arguments}.` +
          ' Example: { message: "hello" }',
        'MCP_INVALID_TOOL_CALL'
      );
    }
  }

  // timeout (optional)
  if ('timeout' in opts && opts.timeout !== undefined) {
    if (typeof opts.timeout !== 'number' || isNaN(opts.timeout)) {
      throw new MCPClientError(
        `Tool call timeout must be a number, got ${typeof opts.timeout}.`,
        'MCP_INVALID_TOOL_CALL'
      );
    }
    if ((opts.timeout as number) <= 0) {
      throw new MCPClientError(
        `Tool call timeout must be positive, got ${opts.timeout}.`,
        'MCP_INVALID_TOOL_CALL'
      );
    }
  }

  // retries (optional)
  if ('retries' in opts && opts.retries !== undefined) {
    if (typeof opts.retries !== 'number' || isNaN(opts.retries)) {
      throw new MCPClientError(
        `Tool call retries must be a number, got ${typeof opts.retries}.`,
        'MCP_INVALID_TOOL_CALL'
      );
    }
    if ((opts.retries as number) < 0) {
      throw new MCPClientError(
        `Tool call retries must be non-negative, got ${opts.retries}.`,
        'MCP_INVALID_TOOL_CALL'
      );
    }
  }
}

/**
 * Validate a resource URI — must be a non-empty string.
 */
export function validateResourceUri(uri: unknown): asserts uri is string {
  if (uri === undefined || uri === null) {
    throw new MCPClientError(
      'Resource URI is required. Pass a URI string, e.g. "config://settings".',
      'MCP_INVALID_RESOURCE_URI'
    );
  }

  if (typeof uri !== 'string') {
    throw new MCPClientError(
      `Resource URI must be a string, got ${typeof uri}.` +
        ' Example: "config://settings", "file:///path/to/resource"',
      'MCP_INVALID_RESOURCE_URI'
    );
  }

  if ((uri as string).trim() === '') {
    throw new MCPClientError(
      'Resource URI cannot be empty.' + ' Example: "config://settings", "file:///path/to/resource"',
      'MCP_INVALID_RESOURCE_URI'
    );
  }
}

/**
 * Validate prompt name — must be a non-empty string.
 */
export function validatePromptName(name: unknown): asserts name is string {
  if (name === undefined || name === null) {
    throw new MCPClientError(
      'Prompt name is required. Pass a prompt name string, e.g. "greet".',
      'MCP_INVALID_PROMPT'
    );
  }

  if (typeof name !== 'string') {
    throw new MCPClientError(
      `Prompt name must be a string, got ${typeof name}. Example: "greet", "summarize"`,
      'MCP_INVALID_PROMPT'
    );
  }

  if ((name as string).trim() === '') {
    throw new MCPClientError(
      'Prompt name cannot be empty. Example: "greet", "summarize"',
      'MCP_INVALID_PROMPT'
    );
  }
}

/**
 * Validate prompt arguments — must be an object with string values if provided.
 */
export function validatePromptArgs(args: unknown): asserts args is Record<string, string> {
  if (args === undefined || args === null) {
    return; // Optional
  }

  if (typeof args !== 'object' || Array.isArray(args)) {
    throw new MCPClientError(
      `Prompt arguments must be an object, got ${typeof args}.` + ' Example: { name: "Alice" }',
      'MCP_INVALID_PROMPT'
    );
  }

  const obj = args as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] !== 'string') {
      throw new MCPClientError(
        `Prompt argument "${key}" must be a string, got ${typeof obj[key]}.` +
          ' All prompt argument values must be strings.',
        'MCP_INVALID_PROMPT'
      );
    }
  }
}

/**
 * Validate sampling request params.
 */
export function validateSamplingRequest(request: unknown): asserts request is {
  messages: unknown[];
  maxTokens: number;
} {
  if (request === null || request === undefined) {
    throw new MCPClientError(
      'Sampling request is required.' + ' Pass { messages: [...], maxTokens: 100 }.',
      'MCP_INVALID_SAMPLING'
    );
  }

  if (typeof request !== 'object' || Array.isArray(request)) {
    throw new MCPClientError(
      `Sampling request must be an object, got ${typeof request}.`,
      'MCP_INVALID_SAMPLING'
    );
  }

  const req = request as Record<string, unknown>;

  if (!('messages' in req) || !Array.isArray(req.messages)) {
    throw new MCPClientError(
      'Sampling request must include a "messages" array.' +
        ' Example: { messages: [{ role: "user", content: { type: "text", text: "Hello" } }], maxTokens: 100 }',
      'MCP_INVALID_SAMPLING'
    );
  }

  if (req.messages.length === 0) {
    throw new MCPClientError(
      'Sampling request "messages" array cannot be empty.' + ' Include at least one message.',
      'MCP_INVALID_SAMPLING'
    );
  }
}

/**
 * Validate client constructor options.
 */
export function validateClientOptions(options: unknown): void {
  if (options === undefined || options === null) {
    return;
  }

  if (typeof options !== 'object' || Array.isArray(options)) {
    throw new MCPClientError(
      `Client options must be an object, got ${typeof options}.`,
      'MCP_INVALID_OPTIONS'
    );
  }

  const opts = options as Record<string, unknown>;

  // name (optional string)
  if ('name' in opts && opts.name !== undefined && typeof opts.name !== 'string') {
    throw new MCPClientError(
      `Client option "name" must be a string, got ${typeof opts.name}.`,
      'MCP_INVALID_OPTIONS'
    );
  }

  // version (optional string)
  if ('version' in opts && opts.version !== undefined && typeof opts.version !== 'string') {
    throw new MCPClientError(
      `Client option "version" must be a string, got ${typeof opts.version}.`,
      'MCP_INVALID_OPTIONS'
    );
  }

  // timeout (optional positive number)
  if ('timeout' in opts && opts.timeout !== undefined) {
    if (typeof opts.timeout !== 'number' || isNaN(opts.timeout)) {
      throw new MCPClientError(
        `Client option "timeout" must be a number, got ${typeof opts.timeout}.`,
        'MCP_INVALID_OPTIONS'
      );
    }
    if ((opts.timeout as number) <= 0) {
      throw new MCPClientError(
        `Client option "timeout" must be positive, got ${opts.timeout}.`,
        'MCP_INVALID_OPTIONS'
      );
    }
  }

  // retries (optional non-negative number)
  if ('retries' in opts && opts.retries !== undefined) {
    if (typeof opts.retries !== 'number' || isNaN(opts.retries)) {
      throw new MCPClientError(
        `Client option "retries" must be a number, got ${typeof opts.retries}.`,
        'MCP_INVALID_OPTIONS'
      );
    }
    if ((opts.retries as number) < 0) {
      throw new MCPClientError(
        `Client option "retries" must be non-negative, got ${opts.retries}.`,
        'MCP_INVALID_OPTIONS'
      );
    }
  }

  // retryDelay (optional non-negative number)
  if ('retryDelay' in opts && opts.retryDelay !== undefined) {
    if (typeof opts.retryDelay !== 'number' || isNaN(opts.retryDelay)) {
      throw new MCPClientError(
        `Client option "retryDelay" must be a number, got ${typeof opts.retryDelay}.`,
        'MCP_INVALID_OPTIONS'
      );
    }
    if ((opts.retryDelay as number) < 0) {
      throw new MCPClientError(
        `Client option "retryDelay" must be non-negative, got ${opts.retryDelay}.`,
        'MCP_INVALID_OPTIONS'
      );
    }
  }

  // startupDelay (optional non-negative number)
  if ('startupDelay' in opts && opts.startupDelay !== undefined) {
    if (typeof opts.startupDelay !== 'number' || isNaN(opts.startupDelay)) {
      throw new MCPClientError(
        `Client option "startupDelay" must be a number, got ${typeof opts.startupDelay}.`,
        'MCP_INVALID_OPTIONS'
      );
    }
    if ((opts.startupDelay as number) < 0) {
      throw new MCPClientError(
        `Client option "startupDelay" must be non-negative, got ${opts.startupDelay}.`,
        'MCP_INVALID_OPTIONS'
      );
    }
  }

  // enableProtocolLogging (optional boolean)
  if (
    'enableProtocolLogging' in opts &&
    opts.enableProtocolLogging !== undefined &&
    typeof opts.enableProtocolLogging !== 'boolean'
  ) {
    throw new MCPClientError(
      `Client option "enableProtocolLogging" must be a boolean, got ${typeof opts.enableProtocolLogging}.`,
      'MCP_INVALID_OPTIONS'
    );
  }
}

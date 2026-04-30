/**
 * Logging utilities for MCP client.
 *
 * Provides configurable logging with multiple output levels, secret masking,
 * request timing, and JSON pretty-printing for protocol debugging.
 *
 * All log output is automatically masked to prevent sensitive data leakage.
 */

import { maskSecrets } from './masking.js';

/**
 * Supported log levels in order of verbosity.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

/**
 * Options for configuring a Logger instance.
 */
export interface LoggerOptions {
  /**
   * Minimum log level to output.
   * @defaultValue "info"
   */
  level?: LogLevel;
  /**
   * Prefix added to all log messages.
   */
  prefix?: string;
  /**
   * Whether to mask secrets in log output.
   * @defaultValue true
   */
  maskSecrets?: boolean;
  /**
   * Whether to include timestamps in log messages.
   * @defaultValue false
   */
  timestamps?: boolean;
  /**
   * Whether to use colored output for different log levels.
   * Colors are only used when output is a TTY (terminal).
   * @defaultValue true
   */
  colors?: boolean;
}

/**
 * Logger interface for logging messages.
 */
export interface Logger {
  /** Log a debug message. */
  debug(...args: unknown[]): void;
  /** Log an info message. */
  info(...args: unknown[]): void;
  /** Log a warning message. */
  warn(...args: unknown[]): void;
  /** Log an error message. */
  error(...args: unknown[]): void;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 99,
};

/**
 * ANSI color codes for terminal output.
 * Only used when output is a TTY.
 */
const COLORS: Record<string, string> = {
  debug: '\x1b[36m', // cyan
  info: '\x1b[32m', // green
  warn: '\x1b[33m', // yellow
  error: '\x1b[31m', // red
  dim: '\x1b[2m', // dim
  reset: '\x1b[0m', // reset
};

/**
 * Check if stderr is a TTY (terminal).
 */
function isTTY(): boolean {
  return process.stderr?.isTTY ?? false;
}

/**
 * Colorize a string for terminal output.
 */
function colorize(text: string, color: string, useColors: boolean): string {
  if (!useColors || !isTTY()) return text;
  return `${color}${text}${COLORS.reset}`;
}

/**
 * Format a timestamp for log messages.
 */
function formatTimestamp(): string {
  const now = new Date();
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `${now.toISOString().slice(11, 23)}.${ms}`;
}

/**
 * Pretty-print a JSON-serializable value with indentation and masking.
 */
export function prettyPrint(value: unknown, shouldMask: boolean = true): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value === 'string') {
    return shouldMask ? maskSecrets(value) : value;
  }
  try {
    const json = JSON.stringify(value, null, 2);
    return shouldMask ? maskSecrets(json) : json;
  } catch {
    const str = String(value);
    return shouldMask ? maskSecrets(str) : str;
  }
}

/**
 * Start a timer and return a function that returns elapsed milliseconds.
 *
 * @example
 * ```typescript
 * const elapsed = startTimer();
 * await someOperation();
 * logger.debug(`Operation completed in ${elapsed()}ms`);
 * ```
 */
export function startTimer(): () => number {
  const start = performance.now();
  return () => Math.round(performance.now() - start);
}

/**
 * Mask all arguments in an array by converting to strings and masking secrets.
 */
function maskArgs(args: unknown[], shouldMask: boolean): unknown[] {
  if (!shouldMask) return args;
  return args.map((arg) => (typeof arg === 'string' ? maskSecrets(arg) : maskSecrets(String(arg))));
}

/**
 * Logger implementation that outputs to stderr with automatic secret masking,
 * timestamps, colors, and JSON pretty-printing.
 *
 * @example
 * ```typescript
 * const logger = new ConsoleLogger({ level: 'debug', prefix: 'MCPClient' });
 * logger.info('Starting...'); // [MCPClient] INFO: Starting...
 * logger.info('API key:', 'sk-abc123def456ghi789'); // [MCPClient] INFO: API key: sk-ab...789
 * ```
 */
export class ConsoleLogger implements Logger {
  private level: number;
  private prefix: string;
  private shouldMask: boolean;
  private useTimestamps: boolean;
  private useColors: boolean;

  constructor(options: LoggerOptions = {}) {
    this.level = LOG_LEVELS[options.level || 'info'];
    this.prefix = options.prefix || '';
    this.shouldMask = options.maskSecrets !== false; // default true
    this.useTimestamps = options.timestamps ?? false;
    this.useColors = options.colors ?? true;
  }

  private shouldLog(messageLevel: LogLevel): boolean {
    return LOG_LEVELS[messageLevel] >= this.level;
  }

  private format(level: LogLevel, args: unknown[]): unknown[] {
    const prefix = this.prefix ? `[${this.prefix}] ` : '';
    const levelStr = level.toUpperCase();
    const masked = maskArgs(args, this.shouldMask);

    const parts: unknown[] = [];

    if (this.useTimestamps) {
      parts.push(colorize(`[${formatTimestamp()}]`, COLORS.dim, this.useColors));
    }

    parts.push(colorize(`${prefix}${levelStr}:`, COLORS[level] || COLORS.reset, this.useColors));
    parts.push(...masked);

    return parts.length > 1 ? parts : [`${prefix}${levelStr}:`, ...masked];
  }

  debug(...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      // eslint-disable-next-line no-console
      console.error(...this.format('debug', args));
    }
  }

  info(...args: unknown[]): void {
    if (this.shouldLog('info')) {
      // eslint-disable-next-line no-console
      console.error(...this.format('info', args));
    }
  }

  warn(...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      // eslint-disable-next-line no-console
      console.error(...this.format('warn', args));
    }
  }

  error(...args: unknown[]): void {
    if (this.shouldLog('error')) {
      // eslint-disable-next-line no-console
      console.error(...this.format('error', args));
    }
  }
}

/**
 * No-op logger that discards all log messages.
 *
 * Use this when you don't want any logging output.
 *
 * @example
 * ```typescript
 * const logger = new NoOpLogger();
 * logger.info('This will be ignored');
 * ```
 */
export class NoOpLogger implements Logger {
  debug(..._args: unknown[]): void {}
  info(..._args: unknown[]): void {}
  warn(..._args: unknown[]): void {}
  error(..._args: unknown[]): void {}
}

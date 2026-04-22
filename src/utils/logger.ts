/**
 * Logging utilities for MCP client.
 *
 * Provides configurable logging with multiple output levels and formats.
 */

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
}

/**
 * Logger interface for logging messages.
 */
export interface Logger {
  /**
   * Log a debug message.
   * @param args - Message arguments to log
   */
  debug(...args: unknown[]): void;
  /**
   * Log an info message.
   * @param args - Message arguments to log
   */
  info(...args: unknown[]): void;
  /**
   * Log a warning message.
   * @param args - Message arguments to log
   */
  warn(...args: unknown[]): void;
  /**
   * Log an error message.
   * @param args - Message arguments to log
   */
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
 * Logger implementation that outputs to stderr.
 *
 * @example
 * ```typescript
 * const logger = new ConsoleLogger({ level: 'debug', prefix: 'MyApp' });
 * logger.info('Starting...'); // [MyApp] INFO: Starting...
 * ```
 */
export class ConsoleLogger implements Logger {
  private level: number;
  private prefix: string;

  constructor(options: LoggerOptions = {}) {
    this.level = LOG_LEVELS[options.level || 'info'];
    this.prefix = options.prefix || '';
  }

  private shouldLog(messageLevel: LogLevel): boolean {
    return LOG_LEVELS[messageLevel] >= this.level;
  }

  private format(level: LogLevel, args: unknown[]): unknown[] {
    const prefix = this.prefix ? `[${this.prefix}] ` : '';
    return [`${prefix}${level.toUpperCase()}:`, ...args];
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
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

export interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
}

export interface Logger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 99,
};

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
      console.debug(...this.format('debug', args));
    }
  }

  info(...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.info(...this.format('info', args));
    }
  }

  warn(...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn(...this.format('warn', args));
    }
  }

  error(...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error(...this.format('error', args));
    }
  }
}

export class NoOpLogger implements Logger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

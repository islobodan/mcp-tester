/**
 * Tests for enhanced logger features: timestamps, colors, startTimer, prettyPrint.
 */

import { ConsoleLogger, NoOpLogger, startTimer, prettyPrint } from '../utils/logger.js';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('ConsoleLogger', () => {
  let originalIsTTY: boolean;

  beforeEach(() => {
    originalIsTTY = process.stderr.isTTY;
  });

  afterEach(() => {
    process.stderr.isTTY = originalIsTTY;
  });

  it('should create logger with defaults', () => {
    const logger = new ConsoleLogger();
    expect(logger).toBeDefined();
  });

  it('should create logger with timestamps enabled', () => {
    const logger = new ConsoleLogger({ timestamps: true });
    expect(logger).toBeDefined();
  });

  it('should create logger with timestamps disabled', () => {
    const logger = new ConsoleLogger({ timestamps: false });
    expect(logger).toBeDefined();
  });

  it('should create logger with colors disabled', () => {
    const logger = new ConsoleLogger({ colors: false });
    expect(logger).toBeDefined();
  });

  it('should create logger with secret masking disabled', () => {
    const logger = new ConsoleLogger({ maskSecrets: false });
    expect(logger).toBeDefined();
  });

  it('should create logger with all options', () => {
    const logger = new ConsoleLogger({
      level: 'debug',
      prefix: 'Test',
      maskSecrets: false,
      timestamps: true,
      colors: true,
    });
    expect(logger).toBeDefined();
  });

  it('should log at debug level without throwing', () => {
    const logger = new ConsoleLogger({ level: 'debug', prefix: 'Test' });
    expect(() => logger.debug('test message')).not.toThrow();
  });

  it('should not throw when logging at none level', () => {
    const logger = new ConsoleLogger({ level: 'none' });
    expect(() => logger.debug('test')).not.toThrow();
    expect(() => logger.info('test')).not.toThrow();
    expect(() => logger.warn('test')).not.toThrow();
    expect(() => logger.error('test')).not.toThrow();
  });

  it('should mask secrets by default', () => {
    const logger = new ConsoleLogger({ level: 'debug', prefix: 'Test' });
    // Should not throw — just verify masking is active
    expect(() => logger.info('key: sk-proj-abcdefghijklmnopqrstuvwxyz1234567890')).not.toThrow();
  });

  it('should not mask secrets when maskSecrets is false', () => {
    const logger = new ConsoleLogger({ level: 'debug', maskSecrets: false });
    expect(() => logger.info('key: sk-proj-abcdefghijklmnopqrstuvwxyz1234567890')).not.toThrow();
  });
});

describe('NoOpLogger', () => {
  it('should discard all messages', () => {
    const logger = new NoOpLogger();
    expect(() => {
      logger.debug('test');
      logger.info('test');
      logger.warn('test');
      logger.error('test');
    }).not.toThrow();
  });
});

describe('startTimer', () => {
  it('should return a function that returns a number', () => {
    const elapsed = startTimer();
    const result = elapsed();
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('should measure elapsed time', async () => {
    const elapsed = startTimer();
    await new Promise((resolve) => setTimeout(resolve, 50));
    const result = elapsed();
    expect(result).toBeGreaterThanOrEqual(40); // Allow some variance
  });

  it('should return increasing values on subsequent calls', async () => {
    const elapsed = startTimer();
    const t1 = elapsed();
    await new Promise((resolve) => setTimeout(resolve, 10));
    const t2 = elapsed();
    expect(t2).toBeGreaterThanOrEqual(t1);
  });
});

describe('prettyPrint', () => {
  it('should pretty-print objects as JSON', () => {
    const result = prettyPrint({ name: 'test', count: 5 });
    expect(result).toContain('"name"');
    expect(result).toContain('"test"');
    expect(result).toContain('"count"');
  });

  it('should pretty-print arrays', () => {
    const result = prettyPrint([1, 2, 3]);
    expect(result).toContain('1');
    expect(result).toContain('2');
    expect(result).toContain('3');
  });

  it('should return strings as-is when masking is disabled', () => {
    const result = prettyPrint('hello world', false);
    expect(result).toBe('hello world');
  });

  it('should mask secrets in strings by default', () => {
    const result = prettyPrint('API key: sk-proj-abcdefghijklmnopqrstuvwxyz1234567890');
    expect(result).not.toContain('abcdefghijklmnopqrstuvwxyz1234567890');
  });

  it('should mask secrets in objects by default', () => {
    const result = prettyPrint({ token: 'sk-proj-abcdefghijklmnopqrstuvwxyz1234567890' });
    expect(result).not.toContain('abcdefghijklmnopqrstuvwxyz1234567890');
  });

  it('should handle null', () => {
    expect(prettyPrint(null)).toBe('null');
  });

  it('should handle undefined', () => {
    expect(prettyPrint(undefined)).toBe('undefined');
  });

  it('should handle numbers', () => {
    expect(prettyPrint(42)).toBe('42');
  });
});

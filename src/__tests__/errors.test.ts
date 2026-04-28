/**
 * Error class tests — validating improved error messages and properties.
 */

import {
  MCPClientError,
  MCPTimeoutError,
  MCPConnectionError,
  MCPNotStartedError,
  MCPAlreadyStartedError,
  MCPServerError,
} from '../utils/errors.js';
import { describe, it, expect } from '@jest/globals';

describe('MCPClientError', () => {
  it('should set name, message, and code', () => {
    const error = new MCPClientError('something failed', 'CUSTOM_CODE');
    expect(error.name).toBe('MCPClientError');
    expect(error.message).toBe('something failed');
    expect(error.code).toBe('CUSTOM_CODE');
  });

  it('should default code to MCP_CLIENT_ERROR', () => {
    const error = new MCPClientError('test');
    expect(error.code).toBe('MCP_CLIENT_ERROR');
  });

  it('should be instanceof Error', () => {
    const error = new MCPClientError('test');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(MCPClientError);
  });
});

describe('MCPTimeoutError', () => {
  it('should include timeout, operation, and suggestions', () => {
    const error = new MCPTimeoutError(
      'Call tool echo timed out after 5000ms',
      5000,
      'Call tool echo'
    );
    expect(error.name).toBe('MCPTimeoutError');
    expect(error.code).toBe('MCP_TIMEOUT_ERROR');
    expect(error.timeout).toBe(5000);
    expect(error.operation).toBe('Call tool echo');
    expect(error.suggestions).toBeInstanceOf(Array);
    expect(error.suggestions.length).toBeGreaterThan(0);
  });

  it('should include the timeout value in the message', () => {
    const error = new MCPTimeoutError(
      'Call tool echo timed out after 3000ms',
      3000,
      'Call tool echo'
    );
    expect(error.message).toContain('3000');
  });

  it('should default operation to "unknown operation"', () => {
    const error = new MCPTimeoutError('Timed out', 1000);
    expect(error.operation).toBe('unknown operation');
  });

  it('should generate default suggestions based on timeout value (low timeout)', () => {
    const error = new MCPTimeoutError('Timed out', 2000);
    expect(error.suggestions).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Increase timeout'),
        expect.stringContaining('5000ms'),
      ])
    );
  });

  it('should generate default suggestions for medium timeout', () => {
    const error = new MCPTimeoutError('Timed out', 8000);
    expect(error.suggestions).toEqual(
      expect.arrayContaining([expect.stringContaining('10000ms+')])
    );
  });

  it('should suggest debug logging', () => {
    const error = new MCPTimeoutError('Timed out', 30000);
    expect(error.suggestions).toEqual(
      expect.arrayContaining([expect.stringContaining('logLevel')])
    );
  });

  it('should use custom suggestions when provided', () => {
    const custom = ['Try again', 'Check network'];
    const error = new MCPTimeoutError('Timed out', 1000, 'op', custom);
    expect(error.suggestions).toEqual(['Try again', 'Check network']);
  });

  it('should be instanceof MCPClientError', () => {
    const error = new MCPTimeoutError('test', 1000);
    expect(error).toBeInstanceOf(MCPClientError);
    expect(error).toBeInstanceOf(MCPTimeoutError);
  });
});

describe('MCPConnectionError', () => {
  it('should include command and suggestions', () => {
    const error = new MCPConnectionError('Failed to connect', 'node server.js');
    expect(error.name).toBe('MCPConnectionError');
    expect(error.code).toBe('MCP_CONNECTION_ERROR');
    expect(error.command).toBe('node server.js');
    expect(error.suggestions).toBeInstanceOf(Array);
    expect(error.suggestions.length).toBeGreaterThan(0);
  });

  it('should default command to "unknown"', () => {
    const error = new MCPConnectionError('Failed to connect');
    expect(error.command).toBe('unknown');
  });

  it('should suggest Node.js-specific tips for node command', () => {
    const error = new MCPConnectionError('Failed', 'node');
    expect(error.suggestions).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Node.js script path'),
        expect.stringContaining('Run the script directly'),
      ])
    );
  });

  it('should suggest Python-specific tips for python command', () => {
    const error = new MCPConnectionError('Failed', 'python');
    expect(error.suggestions).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Python environment'),
        expect.stringContaining('Python script path'),
      ])
    );
  });

  it('should suggest npx-specific tips for npx command', () => {
    const error = new MCPConnectionError('Failed', 'npx');
    expect(error.suggestions).toEqual(
      expect.arrayContaining([
        expect.stringContaining('npm package name'),
        expect.stringContaining('installing the package globally'),
      ])
    );
  });

  it('should always include general troubleshooting tips', () => {
    const error = new MCPConnectionError('Failed', 'custom-server');
    expect(error.suggestions).toEqual(
      expect.arrayContaining([
        expect.stringContaining('command is correct'),
        expect.stringContaining('stdio'),
        expect.stringContaining('logLevel'),
      ])
    );
  });

  it('should use custom suggestions when provided', () => {
    const custom = ['Check firewall', 'Restart server'];
    const error = new MCPConnectionError('Failed', 'node', custom);
    expect(error.suggestions).toEqual(['Check firewall', 'Restart server']);
  });

  it('should be instanceof MCPClientError', () => {
    const error = new MCPConnectionError('Failed');
    expect(error).toBeInstanceOf(MCPClientError);
    expect(error).toBeInstanceOf(MCPConnectionError);
  });
});

describe('MCPNotStartedError', () => {
  it('should include method name in message', () => {
    const error = new MCPNotStartedError('callTool');
    expect(error.name).toBe('MCPNotStartedError');
    expect(error.code).toBe('MCP_NOT_STARTED');
    expect(error.message).toContain('callTool');
    expect(error.message).toContain('start()');
    expect(error.method).toBe('callTool');
  });

  it('should work without method name', () => {
    const error = new MCPNotStartedError();
    expect(error.message).toContain('Client not started');
    expect(error.method).toBe('unknown');
  });

  it('should be instanceof MCPClientError', () => {
    const error = new MCPNotStartedError('listTools');
    expect(error).toBeInstanceOf(MCPClientError);
    expect(error).toBeInstanceOf(MCPNotStartedError);
  });
});

describe('MCPAlreadyStartedError', () => {
  it('should have actionable message', () => {
    const error = new MCPAlreadyStartedError();
    expect(error.name).toBe('MCPAlreadyStartedError');
    expect(error.code).toBe('MCP_ALREADY_STARTED');
    expect(error.message).toContain('stop()');
    expect(error.message).toContain('new MCPClient');
  });

  it('should be instanceof MCPClientError', () => {
    const error = new MCPAlreadyStartedError();
    expect(error).toBeInstanceOf(MCPClientError);
    expect(error).toBeInstanceOf(MCPAlreadyStartedError);
  });
});

describe('MCPServerError', () => {
  it('should include operation and server code', () => {
    const error = new MCPServerError(
      'Call tool echo failed: Unknown tool',
      'Call tool echo',
      -32603
    );
    expect(error.name).toBe('MCPServerError');
    expect(error.code).toBe('MCP_SERVER_ERROR');
    expect(error.operation).toBe('Call tool echo');
    expect(error.serverCode).toBe(-32603);
  });

  it('should default operation to "unknown operation"', () => {
    const error = new MCPServerError('Something failed');
    expect(error.operation).toBe('unknown operation');
  });

  it('should default server code to undefined', () => {
    const error = new MCPServerError('Something failed', 'op');
    expect(error.serverCode).toBeUndefined();
  });

  it('should be instanceof MCPClientError', () => {
    const error = new MCPServerError('test');
    expect(error).toBeInstanceOf(MCPClientError);
    expect(error).toBeInstanceOf(MCPServerError);
  });
});

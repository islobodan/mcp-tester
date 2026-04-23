/**
 * Basic client operations tests
 */

import { MCPClient } from '../client/MCPClient.js';
import { describe, it, expect } from '@jest/globals';

describe('MCPClient - Basic Operations', () => {
  it('should create client with defaults', () => {
    const client = new MCPClient({
      name: 'test-client',
      version: '1.0.0',
      timeout: 30000,
      logLevel: 'error',
    });

    expect(client).toBeDefined();
    expect(client.isConnected()).toBe(false);
  });

  it('should throw error when calling methods without starting', async () => {
    const client = new MCPClient({
      name: 'test-client',
      version: '1.0.0',
      logLevel: 'error',
    });

    await expect(client.listTools()).rejects.toThrow('Client not started');
    await expect(client.listResources()).rejects.toThrow('Client not started');
    await expect(client.listPrompts()).rejects.toThrow('Client not started');
  });
});

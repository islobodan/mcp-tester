import { MCPClient } from '../client/MCPClient.js';
import { describe, it, expect, beforeEach } from '@jest/globals';

describe('MCPClient - Basic Operations', () => {
  let client: MCPClient;

  beforeEach(() => {
    client = new MCPClient({
      name: 'test-client',
      version: '1.0.0',
      timeout: 10000,
    });
  });

  it('should have default options', () => {
    expect(client).toBeDefined();
    expect(client.isConnected()).toBe(false);
  });

  it('should throw error when calling methods without starting', async () => {
    await expect(client.listTools()).rejects.toThrow('Client not started');
    await expect(client.listResources()).rejects.toThrow('Client not started');
    await expect(client.listPrompts()).rejects.toThrow('Client not started');
  });
});

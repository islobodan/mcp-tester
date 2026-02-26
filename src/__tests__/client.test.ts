/**
 * Basic client operations tests using test helpers
 */

import { createTestClient } from './helpers.js';
import { describe, it, expect } from '@jest/globals';

describe('MCPClient - Basic Operations', () => {
  it('should have default options using helper', () => {
    const client = createTestClient();

    expect(client).toBeDefined();
    expect(client.isConnected()).toBe(false);
  });

  it('should throw error when calling methods without starting', async () => {
    const client = createTestClient();

    await expect(client.listTools()).rejects.toThrow('Client not started');
    await expect(client.listResources()).rejects.toThrow('Client not started');
    await expect(client.listPrompts()).rejects.toThrow('Client not started');
  });
});

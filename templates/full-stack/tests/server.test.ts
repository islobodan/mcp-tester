/**
 * Server lifecycle tests.
 */

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { MCPClient } from '@slbdn/mcp-tester';
import { createConnectedClient } from './helpers.js';

describe('Server lifecycle', () => {
  let client: MCPClient;

  beforeAll(async () => {
    client = await createConnectedClient('lifecycle-test');
  });

  afterAll(async () => {
    if (client?.isConnected()) {
      await client.stop();
    }
  });

  it('connects to the mock server', () => {
    expect(client.isConnected()).toBe(true);
  });

  it('reports a healthy server', async () => {
    const health = await client.isHealthy();
    expect(health.healthy).toBe(true);
    expect(health.latencyMs).toBeGreaterThan(0);
  });

  it('lists all advertised tools', async () => {
    const tools = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(['greet', 'sum', 'uppercase']);
  });
});
/**
 * Resource tests.
 */

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { MCPClient } from '@slbdn/mcp-tester';
import { contentText, createConnectedClient, promptText, resourceText } from './helpers.js';

describe('Resources', () => {
  let client: MCPClient;

  beforeAll(async () => {
    client = await createConnectedClient('resources-test');
  });

  afterAll(async () => {
    if (client?.isConnected()) {
      await client.stop();
    }
  });

  it('lists available resources', async () => {
    const resources = await client.listResources();
    expect(resources.length).toBeGreaterThan(0);
    expect(resources.map((r) => r.uri)).toContain('config://version');
  });

  it('reads the version resource', async () => {
    const result = await client.readResource('config://version');
    expect(result.contents.length).toBe(1);
    expect(resourceText(result)).toBe('1.0.0');
  });

  it('rejects unknown resources', async () => {
    await expect(client.readResource('config://does-not-exist')).rejects.toThrow();
  });
});
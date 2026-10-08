/**
 * Parallel and stress tests — demonstrates `Promise.all` patterns.
 */

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { MCPClient } from '@slbdn/mcp-tester';
import { contentText, createConnectedClient } from './helpers.js';

describe('Parallel operations', () => {
  let client: MCPClient;

  beforeAll(async () => {
    client = await createConnectedClient('parallel-test');
  });

  afterAll(async () => {
    if (client?.isConnected()) {
      await client.stop();
    }
  });

  it('runs many calls in parallel', async () => {
    const calls = Array.from({ length: 20 }, (_, i) =>
      client.callTool({ name: 'greet', arguments: { name: `User${i}` } })
    );
    const results = await Promise.all(calls);
    expect(results).toHaveLength(20);
    results.forEach((r, i) => {
      expect(contentText(r)).toBe(`Hello, User${i}!`);
    });
  });

  it('handles a mixed workload concurrently', async () => {
    const calls = [
      client.callTool({ name: 'greet', arguments: { name: 'A' } }),
      client.callTool({ name: 'sum', arguments: { numbers: [1, 2, 3] } }),
      client.callTool({ name: 'uppercase', arguments: { text: 'hi' } }),
    ];
    const [greet, sum, upper] = await Promise.all(calls);
    expect(contentText(greet)).toBe('Hello, A!');
    expect(contentText(sum)).toBe('6');
    expect(contentText(upper)).toBe('HI');
  });
});
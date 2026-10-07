/**
 * Parallel and stress tests — demonstrates `Promise.all` patterns.
 */

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { MCPClient } from '@slbdn/mcp-tester';
import { createConnectedClient } from './helpers.js';

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
      expect(r.content[0].text).toBe(`Hello, User${i}!`);
    });
  });

  it('handles a mixed workload concurrently', async () => {
    const calls = [
      client.callTool({ name: 'greet', arguments: { name: 'A' } }),
      client.callTool({ name: 'sum', arguments: { numbers: [1, 2, 3] } }),
      client.callTool({ name: 'uppercase', arguments: { text: 'hi' } }),
    ];
    const [greet, sum, upper] = await Promise.all(calls);
    expect(greet.content[0].text).toBe('Hello, A!');
    expect(sum.content[0].text).toBe('6');
    expect(upper.content[0].text).toBe('HI');
  });
});
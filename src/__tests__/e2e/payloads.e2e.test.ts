import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createHash } from 'node:crypto';
import { MCPClient } from '../../client/MCPClient.js';
import { startE2EClient, stopE2EClient } from './helpers.js';

describe('E2E — Payload Handling', () => {
  let client: MCPClient;

  beforeAll(async () => {
    client = await startE2EClient({ timeout: 60_000 });
  });

  afterAll(async () => {
    await stopE2EClient(client);
  });

  it('should round-trip a 1MB echo payload byte-exactly', async () => {
    const size = 1_000_000;
    const expected = Array.from(
      { length: size },
      (_, i) => 'abcdefghijklmnopqrstuvwxyz0123456789'[i % 36]
    ).join('');
    const start = Date.now();
    const result = (await client.callTool({ name: 'echo_large', arguments: { size } })) as {
      content: Array<{ type: string; text: string }>;
    };
    const elapsed = Date.now() - start;
    const actual = result.content[0].text;

    expect(actual.length).toBe(size);
    expect(createHash('sha256').update(actual).digest('hex')).toBe(
      createHash('sha256').update(expected).digest('hex')
    );
    expect(elapsed).toBeLessThan(10_000);
  });

  it('should sum a 10,000-element number array exactly', async () => {
    const numbers = Array.from({ length: 10_000 }, (_, i) => i);
    const expectedSum = numbers.reduce((a, b) => a + b, 0);

    const result = (await client.callTool({ name: 'sum_large', arguments: { numbers } })) as {
      content: Array<{ type: string; text: string }>;
    };
    expect(result.content[0].text).toBe(`Sum: ${expectedSum}`);
  });

  it('should handle deep nesting without truncation', async () => {
    const result = (await client.callTool({ name: 'deep_nest', arguments: { depth: 100 } })) as {
      content: Array<{ type: string; text: string }>;
    };
    const parsed = JSON.parse(result.content[0].text);
    let depth = 0;
    let node = parsed;
    while (node && node.child) {
      depth += 1;
      node = node.child;
    }
    expect(depth).toBe(100);
  });

  it('should round-trip unicode strings exactly', async () => {
    const unicode = 'Hello — world! 你好 🎉 émoji 🇺🇸 combining: é';
    const result = (await client.callTool({
      name: 'unicode_echo',
      arguments: { message: unicode },
    })) as {
      content: Array<{ type: string; text: string }>;
    };
    expect(result.content[0].text).toBe(`Echo: ${unicode}`);
  });

  it('should handle 500 sequential calls correctly within a time budget', async () => {
    const start = Date.now();
    for (let i = 0; i < 500; i += 1) {
      const r = (await client.callTool({ name: 'echo', arguments: { message: `seq-${i}` } })) as {
        content: Array<{ type: string; text: string }>;
      };
      expect(r.content[0].text).toBe(`Echo: seq-${i}`);
    }
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(15_000);
  });
});

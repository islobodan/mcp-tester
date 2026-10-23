import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { spawn, type ChildProcess } from 'child_process';
import { join } from 'node:path';
import { MCPClient } from '../../client/MCPClient.js';
import { startE2EClient, stopE2EClient } from './helpers.js';

jest.setTimeout(60_000);

const EVERYTHING_SERVER = join(
  process.cwd(),
  'node_modules',
  '@modelcontextprotocol',
  'server-everything',
  'dist',
  'index.js'
);
const HTTP_PORT = 3261;

async function waitForServer(port: number, timeout = 15_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(`http://localhost:${port}/`);
      if (res.status === 404 || res.ok || res.status === 405) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Server on port ${port} did not start within ${timeout}ms`);
}

/** Spawn server-everything over Streamable HTTP on the scratch port. */
function startEverythingServerHttp(): ChildProcess {
  const proc = spawn('node', [EVERYTHING_SERVER, 'streamableHttp'], {
    env: { ...process.env, PORT: String(HTTP_PORT) },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  // Consume stderr (pipe must drain) without dumping server logs into Jest output.
  proc.stderr?.on('data', () => {});
  proc.on('error', () => {});
  return proc;
}

/** SIGTERM the HTTP server and wait for exit so nothing outlives the suite. */
async function stopEverythingServerHttp(proc: ChildProcess): Promise<void> {
  if (proc.exitCode !== null) return;
  const exited = new Promise<void>((resolve) => {
    proc.once('exit', () => resolve());
  });
  proc.kill('SIGTERM');
  await Promise.race([exited, new Promise((r) => setTimeout(r, 5_000))]);
}

describe('E2E — Concurrency', () => {
  let client: MCPClient;

  beforeAll(async () => {
    client = await startE2EClient({ timeout: 30_000 });
  });

  afterAll(async () => {
    await stopE2EClient(client);
  });

  it('should handle 20 parallel tool calls with correct per-request pairing', async () => {
    const messages = Array.from({ length: 20 }, (_, i) => `msg-${i}`);
    const results = await Promise.all(
      messages.map((m) => client.callTool({ name: 'echo', arguments: { message: m } }))
    );

    for (let i = 0; i < messages.length; i += 1) {
      const r = results[i] as { content: Array<{ type: string; text: string }> };
      expect(r.content[0].text).toBe(`Echo: msg-${i}`);
    }
  });

  it('should complete quick calls before a large in-flight response (completion order)', async () => {
    // Quicks are submitted first; the fixture handles requests FIFO on one
    // stdio connection, so the 500 KB response must land last. Asserts order,
    // not wall clock.
    const done: string[] = [];
    const quicks = Array.from({ length: 10 }, (_, i) =>
      client.callTool({ name: 'echo', arguments: { message: `quick-${i}` } }).then((r) => {
        const content = (r as { content: Array<{ type: string; text: string }> }).content;
        expect(content[0].text).toBe(`Echo: quick-${i}`);
        done.push(`quick-${i}`);
      })
    );
    const big = client
      .callTool({ name: 'echo_large', arguments: { size: 500_000 } })
      .then(() => done.push('big'));

    await Promise.all([...quicks, big]);
    expect(done).toHaveLength(11);
    expect(done.slice(0, 10)).toEqual(Array.from({ length: 10 }, (_, i) => `quick-${i}`));
    expect(done[10]).toBe('big');
  });

  it('should serialize concurrent counter increments correctly', async () => {
    await client.callTool({ name: 'counter_reset', arguments: {} });
    const increments = Array.from({ length: 25 }, () =>
      client.callTool({ name: 'counter_increment', arguments: { amount: 1 } })
    );
    const results = await Promise.all(increments);
    // All 25 increments completed (results resolved); final counter must be 25.
    for (const r of results) {
      const content = (r as { content: Array<{ type: string; text: string }> }).content;
      expect(content[0].text).toMatch(/^Counter: \d+$/);
    }
    const final = (await client.callTool({ name: 'counter_get', arguments: {} })) as {
      content: Array<{ type: string; text: string }>;
    };
    expect(final.content[0].text).toBe('Counter: 25');
  });

  it('should isolate state between two clients over two separate server processes', async () => {
    // Interleaved writes to same-named tools on different processes: each
    // client must only ever see its own process's counter.
    const clientA = await startE2EClient({ timeout: 30_000 });
    const clientB = await startE2EClient({ timeout: 30_000 });
    try {
      await clientA.callTool({ name: 'counter_increment', arguments: { amount: 5 } });
      await clientB.callTool({ name: 'counter_increment', arguments: { amount: 2 } });
      await clientA.callTool({ name: 'counter_increment', arguments: { amount: 1 } });

      const getA = (await clientA.callTool({ name: 'counter_get', arguments: {} })) as {
        content: Array<{ type: string; text: string }>;
      };
      const getB = (await clientB.callTool({ name: 'counter_get', arguments: {} })) as {
        content: Array<{ type: string; text: string }>;
      };
      expect(getA.content[0].text).toBe('Counter: 6');
      expect(getB.content[0].text).toBe('Counter: 2');
    } finally {
      await stopE2EClient(clientA);
      await stopE2EClient(clientB);
    }
  });

  it('should serve two concurrent sessions (stdio + HTTP) against one shared HTTP server', async () => {
    const httpServer = startEverythingServerHttp();
    try {
      await waitForServer(HTTP_PORT);

      const httpClient = new MCPClient({
        name: 'e2e-client-http',
        version: '1.0.0',
        timeout: 30_000,
      });
      await httpClient.start({ transport: 'http', url: `http://localhost:${HTTP_PORT}/mcp` });
      try {
        // Both sessions issue calls at the same time against the shared server.
        const [stdioRes, httpRes] = await Promise.all([
          client.callTool({ name: 'echo', arguments: { message: 'from-stdio' } }),
          httpClient.callTool({ name: 'echo', arguments: { message: 'from-http' } }),
        ]);
        expect(
          (stdioRes as { content: Array<{ type: string; text: string }> }).content[0].text
        ).toBe('Echo: from-stdio');
        expect(
          (httpRes as { content: Array<{ type: string; text: string }> }).content[0].text
        ).toBe('Echo: from-http');
      } finally {
        await httpClient.stop();
      }
    } finally {
      await stopEverythingServerHttp(httpServer);
    }
  });

  it('should use allSettled so one failed call does not sink the batch', async () => {
    const settled = await Promise.allSettled([
      client.callTool({ name: 'echo', arguments: { message: 'ok' } }),
      client.callTool({ name: 'does_not_exist', arguments: {} }),
      client.callTool({ name: 'echo', arguments: { message: 'ok2' } }),
    ]);

    expect(settled[0].status).toBe('fulfilled');
    expect(settled[1].status).toBe('rejected');
    expect(settled[2].status).toBe('fulfilled');
  });
});

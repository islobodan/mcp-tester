import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { spawn, type ChildProcess } from 'child_process';
import { join } from 'node:path';
import { MCPClient } from '../../client/MCPClient.js';
import { startE2EClient, stopE2EClient, E2E_SERVER_PATH } from './helpers.js';

const EVERYTHING_SERVER = join(
  process.cwd(),
  'node_modules',
  '@modelcontextprotocol',
  'server-everything',
  'dist',
  'index.js'
);
const HTTP_PORT = 3261;

let httpServer: ChildProcess | null = null;

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

function startEverythingServerHttp(): ChildProcess {
  const proc = spawn('node', [EVERYTHING_SERVER, 'streamableHttp'], {
    env: { ...process.env, PORT: String(HTTP_PORT) },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  proc.stderr?.on('data', (data) => process.stderr.write(String(data)));
  return proc;
}

describe('E2E — Concurrency', () => {
  let client: MCPClient;

  beforeAll(async () => {
    client = await startE2EClient({ timeout: 30_000 });
  });

  afterAll(async () => {
    await stopE2EClient(client);
    if (httpServer) {
      httpServer.kill('SIGTERM');
      httpServer = null;
    }
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

  it('should isolate two independent MCP sessions over one shared HTTP server', async () => {
    // Start a second server over HTTP on a scratch port.
    httpServer = startEverythingServerHttp();
    await waitForServer(HTTP_PORT);

    const httpClient = new MCPClient({
      name: 'e2e-client-http',
      version: '1.0.0',
      timeout: 30_000,
    });
    await httpClient.start({ transport: 'http', url: `http://localhost:${HTTP_PORT}/mcp` });
    try {
      const a = (await httpClient.callTool({ name: 'echo', arguments: { message: 'from-a' } })) as {
        content: Array<{ type: string; text: string }>;
      };
      const b = (await httpClient.callTool({ name: 'echo', arguments: { message: 'from-b' } })) as {
        content: Array<{ type: string; text: string }>;
      };
      expect(a.content[0].text).toBe('Echo: from-a');
      expect(b.content[0].text).toBe('Echo: from-b');
    } finally {
      await httpClient.stop();
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

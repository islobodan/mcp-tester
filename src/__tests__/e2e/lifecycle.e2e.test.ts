import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MCPClient } from '../../client/MCPClient.js';
import type { MCPClientOptions } from '../../client/MCPClient.js';
import { startE2EClient, stopE2EClient, E2E_SERVER_PATH } from './helpers.js';

describe('E2E — Server Lifecycle', () => {
  let client: MCPClient;

  beforeEach(async () => {
    client = await startE2EClient();
  });

  afterEach(async () => {
    await stopE2EClient(client);
  });

  it('should start and connect to the e2e fixture server', async () => {
    expect(client.isConnected()).toBe(true);
    const tools = await client.listTools();
    expect(tools.length).toBeGreaterThanOrEqual(15);
  });

  it('should stop and disconnect', async () => {
    await client.stop();
    expect(client.isConnected()).toBe(false);
  });

  it('should throw if starting twice', async () => {
    await expect(client.start({ command: 'node', args: [E2E_SERVER_PATH] })).rejects.toThrow(
      'already started'
    );
  });

  it('should be healthy while connected', async () => {
    const health = await client.isHealthy();
    expect(health.healthy).toBe(true);
  });

  it('should not be healthy after stop', async () => {
    await client.stop();
    const health = await client.isHealthy();
    expect(health.healthy).toBe(false);
  });

  it('should restart against a fresh server process (fresh state)', async () => {
    // Phase 1: a server process increments the counter to 5 and stops.
    const clientA = await startE2EClient();
    await clientA.callTool({ name: 'counter_increment', arguments: { amount: 5 } });
    expect(await clientA.callTool({ name: 'counter_get', arguments: {} })).toBeDefined();
    await stopE2EClient(clientA);

    // Phase 2: a brand-new server process must start with a clean counter.
    const clientB = await startE2EClient();
    const result = (await clientB.callTool({ name: 'counter_get', arguments: {} })) as {
      content: Array<{ type: string; text: string }>;
    };
    expect(result.content[0].text).toBe('Counter: 0');
    await stopE2EClient(clientB);
  });

  it('should tear down without leaking the server process (zombie proof)', async () => {
    const pidFile = join(tmpdir(), `e2e-pid-${Date.now()}.txt`);
    const env = { E2E_PID_FILE: pidFile };
    const e2eClient = await startE2EClient({ env, timeout: 30_000 });

    await e2eClient.callTool({ name: 'pid_dump', arguments: {} });
    const pidText = (await e2eClient.callTool({ name: 'pid_dump', arguments: {} })) as {
      content: Array<{ type: string; text: string }>;
    };
    const pid = Number(pidText.content[0].text);
    expect(Number.isInteger(pid)).toBe(true);

    await stopE2EClient(e2eClient);

    // The child must be reaped by now (bounded retries — teardown is async).
    let alive = true;
    for (let i = 0; i < 50; i += 1) {
      try {
        process.kill(pid, 0);
        await new Promise((r) => setTimeout(r, 100));
      } catch {
        alive = false;
        break;
      }
    }
    expect(alive).toBe(false);
  });

  it('should forward E2E_TOKEN env var through to tool calls', async () => {
    const e2eClient = await startE2EClient({
      env: { E2E_TOKEN: 'e2e-secret-token' },
      timeout: 30_000,
    });
    const result = (await e2eClient.callTool({ name: 'env_dump', arguments: {} })) as {
      content: Array<{ type: string; text: string }>;
    };
    expect(result.content[0].text).toBe('E2E_TOKEN=e2e-secret-token');
    await stopE2EClient(e2eClient);
  });

  it('should receive server→client logging notifications', async () => {
    const received: Array<{ level: string; data: string }> = [];
    client.setNotificationHandlers({
      onLoggingMessage: (level, data) => {
        received.push({ level, data });
      },
    });

    const result = (await client.callTool({
      name: 'counter_increment',
      arguments: { amount: 3 },
    })) as { content: Array<{ type: string; text: string }> };
    expect(result.content[0].text).toBe('Counter: 3');

    // The fixture sends notifications/message after incrementing.
    expect(received.length).toBeGreaterThan(0);
    expect(received[0].data).toContain('Counter incremented by 3');
  });
});

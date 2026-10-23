import { describe, it, expect, jest } from '@jest/globals';
import { MCPClient } from '../../client/MCPClient.js';
import { MCPTimeoutError, MCPServerError } from '../../utils/errors.js';
import { startE2EClient, stopE2EClient } from './helpers.js';

jest.setTimeout(60_000);

describe('E2E — Server Error Recovery', () => {
  it('should surface a server crash mid-session as a thrown error', async () => {
    // Restart with crash chaos enabled.
    const crashClient = await startE2EClient({
      env: { E2E_CRASH_ON_TOOL: 'crash_now' },
      timeout: 30_000,
    });
    await expect(crashClient.callTool({ name: 'crash_now', arguments: {} })).rejects.toThrow();

    const health = await crashClient.isHealthy();
    expect(health.healthy).toBe(false);
    await stopE2EClient(crashClient);
  });

  it('should stop cleanly after the server process has died', async () => {
    const crashClient = await startE2EClient({
      env: { E2E_CRASH_ON_TOOL: 'crash_now' },
      timeout: 30_000,
    });
    await crashClient.callTool({ name: 'crash_now', arguments: {} }).catch(() => undefined);
    await stopE2EClient(crashClient); // must not hang or throw
  });

  it('should recover with a fresh client against the same server command', async () => {
    const crashClient = await startE2EClient({
      env: { E2E_CRASH_ON_TOOL: 'crash_now' },
      timeout: 30_000,
    });
    await crashClient.callTool({ name: 'crash_now', arguments: {} }).catch(() => undefined);

    const recovered = await startE2EClient({ timeout: 30_000 });
    const result = (await recovered.callTool({ name: 'counter_get', arguments: {} })) as {
      content: Array<{ type: string; text: string }>;
    };
    expect(result.content[0].text).toBe('Counter: 0');
    await stopE2EClient(recovered);
  });

  it('should throw MCPTimeoutError on a hung tool with a small timeout', async () => {
    const hangClient = await startE2EClient({
      env: { E2E_HANG_ON_TOOL: 'hang_now' },
      timeout: 30_000,
    });
    await expect(
      hangClient.callTool({ name: 'hang_now', arguments: {}, timeout: 1500 })
    ).rejects.toBeInstanceOf(MCPTimeoutError);

    const err = await hangClient
      .callTool({ name: 'hang_now', arguments: {}, timeout: 1500 })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MCPTimeoutError);
    expect((err as MCPTimeoutError).timeout).toBe(1500);
    expect((err as MCPTimeoutError).operation).toContain('hang_now');

    // The connection itself is still alive — a non-hung tool must succeed.
    const ok = (await hangClient.callTool({
      name: 'echo',
      arguments: { message: 'still alive' },
    })) as {
      content: Array<{ type: string; text: string }>;
    };
    expect(ok.content[0].text).toBe('Echo: still alive');
    await stopE2EClient(hangClient);
  });

  it('should retry after a fail-once tool error and succeed', async () => {
    const retryClient = await startE2EClient({
      env: { E2E_FAIL_ONCE: 'fail_once_tool' },
      timeout: 30_000,
    });

    // First call fails once (fail-once consumed), retry succeeds.
    const result = (await retryClient.callTool({
      name: 'fail_once_tool',
      arguments: {},
      retries: 1,
    })) as { content: Array<{ type: string; text: string }> };
    expect(result.content[0].text).toBe('recovered-after-fail-once');

    const stats = (await retryClient.callTool({ name: 'call_stats', arguments: {} })) as {
      content: Array<{ type: string; text: string }>;
    };
    // Exact accounting: the failed attempt AND the successful retry both count.
    expect(JSON.parse(stats.content[0].text)).toMatchObject({ fail_once_tool: 2 });

    await stopE2EClient(retryClient);
  });

  it('should respect retries: 0 (no retry) and leave the call counted exactly once', async () => {
    const retryClient = await startE2EClient({
      env: { E2E_FAIL_ONCE: 'fail_once_tool' },
      timeout: 30_000,
    });

    await expect(
      retryClient.callTool({ name: 'fail_once_tool', arguments: {}, retries: 0 })
    ).rejects.toThrow();

    const stats = (await retryClient.callTool({ name: 'call_stats', arguments: {} })) as {
      content: Array<{ type: string; text: string }>;
    };
    expect(JSON.parse(stats.content[0].text)).toMatchObject({ fail_once_tool: 1 });

    await stopE2EClient(retryClient);
  });

  it('should surface server tool errors as MCPServerError with serverCode preserved', async () => {
    const client = await startE2EClient({ timeout: 30_000 });

    const err = await client
      .callTool({ name: 'error_tool', arguments: {} })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MCPServerError);
    expect((err as MCPServerError).serverCode).toBe(-32050);
    expect((err as MCPServerError).operation).toContain('error_tool');

    await stopE2EClient(client);
  });
});

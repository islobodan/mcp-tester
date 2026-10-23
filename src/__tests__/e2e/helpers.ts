/**
 * E2E test helpers (TODO #27).
 *
 * Thin wrappers around `MCPClient` for the E2E suites so each suite stays
 * focused on behaviour rather than transport plumbing.
 */

import { join } from 'node:path';
import { MCPClient } from '../../client/MCPClient.js';

/** Absolute path to the deterministic E2E fixture server. */
export const E2E_SERVER_PATH = join(
  process.cwd(),
  'src',
  '__tests__',
  'e2e',
  'fixtures',
  'e2e-server.mjs'
);

export interface StartE2EOptions {
  /** Extra env vars forwarded to the fixture server. */
  env?: Record<string, string>;
  /** Client request timeout in ms. Defaults to 30_000. */
  timeout?: number;
}

export async function startE2EClient(options: StartE2EOptions = {}): Promise<MCPClient> {
  const client = new MCPClient({
    name: 'e2e-client',
    version: '1.0.0',
    timeout: options.timeout ?? 30_000,
  });
  await client.start({
    command: 'node',
    args: [E2E_SERVER_PATH],
    env: options.env ?? {},
  });
  return client;
}

export async function stopE2EClient(client: MCPClient): Promise<void> {
  if (client.isConnected()) {
    await client.stop();
  }
}

/**
 * Poll until `process.kill(pid, 0)` fails (process is gone), or throw.
 * Process teardown is async — bounded retries, not a single check.
 */
export async function waitForPidGone(pid: number, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0);
    } catch {
      return; // gone (or unreapable zombie-free state)
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`pid ${pid} still alive after ${timeoutMs}ms`);
}

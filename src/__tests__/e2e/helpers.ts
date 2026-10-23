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

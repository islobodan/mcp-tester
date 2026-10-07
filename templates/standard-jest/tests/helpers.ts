/**
 * Shared test helpers: path resolution and per-suite client lifecycle.
 */

import { MCPClient } from '@slbdn/mcp-tester';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export const serverPath = join(here, '..', 'examples', 'mock-server.js');

/** Create a connected MCPClient pointed at the standard mock server. */
export async function createConnectedClient(name = 'standard-test'): Promise<MCPClient> {
  const client = new MCPClient({
    name,
    version: '0.1.0',
    timeout: 10000,
  });
  await client.start({ command: 'node', args: [serverPath] });
  return client;
}
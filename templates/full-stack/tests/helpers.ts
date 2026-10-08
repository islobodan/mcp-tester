/**
 * Shared helpers for the full-stack test suite.
 */

import { MCPClient } from '@slbdn/mcp-tester';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export const serverPath = join(here, '..', 'examples', 'mock-server.js');

/** The result type of {@link MCPClient.callTool}. */
type ToolCallResult = Awaited<ReturnType<MCPClient['callTool']>>;

/** Extract the text of the first content item (empty string if not text). */
export function contentText(result: ToolCallResult): string {
  const first = result.content[0];
  return first && first.type === 'text' ? first.text : '';
}

export async function createConnectedClient(name = 'full-stack-test'): Promise<MCPClient> {
  const client = new MCPClient({
    name,
    version: '0.1.0',
    timeout: 10000,
  });
  await client.start({ command: 'node', args: [serverPath] });
  return client;
}
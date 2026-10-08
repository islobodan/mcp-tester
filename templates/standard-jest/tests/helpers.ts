/**
 * Shared test helpers: path resolution and per-suite client lifecycle.
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

/** Extract the text of the first prompt message (empty string if not text). */
export function promptText(result: Awaited<ReturnType<MCPClient['getPrompt']>>): string {
  const first = result.messages[0];
  const content = first?.content;
  return content && content.type === 'text' ? content.text : '';
}

/** Extract the text of the first resource contents entry (empty string if not text). */
export function resourceText(result: Awaited<ReturnType<MCPClient['readResource']>>): string {
  const first = result.contents[0];
  return first && 'text' in first ? (first.text as string) : '';
}

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
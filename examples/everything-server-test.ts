/**
 * Everything Server Test Example
 *
 * Demonstrates testing against a real MCP server (@modelcontextprotocol/server-everything).
 * This is the same server used in the official MCP test suite.
 *
 * Run: npx tsx examples/everything-server-test.ts
 *
 * Prerequisites: npm install (server-everything is included as a dependency)
 */

import { MCPClient } from '../dist/index.js';
import type { CallToolResult, ReadResourceResult, GetPromptResult } from '@modelcontextprotocol/sdk/types.js';

const SERVER_PATH = './node_modules/@modelcontextprotocol/server-everything/dist/index.js';

function log(section: string, msg: string) {
  console.log(`[${section}] ${msg}`);
}

function extractText(result: CallToolResult): string {
  const item = result.content[0];
  if (item && 'text' in item) return item.text;
  return '';
}

// ─── Connection ─────────────────────────────────────────────────────────────

async function testConnection(client: MCPClient) {
  console.log('\n=== Connection ===\n');

  log('connect', 'Connecting to server-everything...');
  await client.start({ command: 'node', args: [SERVER_PATH, 'stdio'] });
  console.log('  ✓ Connected');

  log('disconnect', 'Disconnecting...');
  await client.stop();
  console.log('  ✓ Disconnected');

  log('reconnect', 'Reconnecting after disconnect...');
  await client.start({ command: 'node', args: [SERVER_PATH, 'stdio'] });
  console.log('  ✓ Reconnected successfully');
}

// ─── Tools ──────────────────────────────────────────────────────────────────

async function testTools(client: MCPClient) {
  console.log('\n=== Tools ===\n');

  // List tools
  const tools = await client.listTools();
  log('list', `Found ${tools.length} tools:`);
  tools.forEach((t) => console.log(`  • ${t.name}`));

  // Echo
  const echo = await client.callTool({
    name: 'echo',
    arguments: { message: 'Hello from MCP Tester!' },
  });
  log('echo', extractText(echo));

  // Get-sum
  const sum = await client.callTool({
    name: 'get-sum',
    arguments: { a: 42, b: 58 },
  });
  log('get-sum', extractText(sum));

  // Get-env
  const env = await client.callTool({ name: 'get-env', arguments: {} });
  log('get-env', extractText(env).substring(0, 80) + '...');

  // Get-resource-links
  const links = await client.callTool({
    name: 'get-resource-links',
    arguments: { count: 3 },
  });
  log('get-resource-links', extractText(links));

  // Get-structured-content
  const structured = await client.callTool({
    name: 'get-structured-content',
    arguments: {},
  });
  log('get-structured-content', `${structured.content.length} content items`);

  // Get-tiny-image
  const image = await client.callTool({ name: 'get-tiny-image', arguments: {} });
  log('get-tiny-image', `${image.content.length} content items (includes image data)`);

  // Get-annotated-message
  const annotated = await client.callTool({
    name: 'get-annotated-message',
    arguments: { messageType: 'success' },
  });
  log('get-annotated-message', extractText(annotated));

  // Toggle-simulated-logging
  const logging = await client.callTool({
    name: 'toggle-simulated-logging',
    arguments: { enabled: true },
  });
  log('toggle-simulated-logging', extractText(logging));

  // Trigger-long-running-operation (duration is in seconds)
  const longOp = await client.callTool({
    name: 'trigger-long-running-operation',
    arguments: { duration: 1, steps: 1 },
    timeout: 30000,
  });
  log('long-running-op', extractText(longOp));

  // Get-roots-list
  const roots = await client.callTool({ name: 'get-roots-list', arguments: {} });
  log('get-roots-list', `${roots.content.length} content items`);
}

// ─── Resources ──────────────────────────────────────────────────────────────

async function testResources(client: MCPClient) {
  console.log('\n=== Resources ===\n');

  const resources = await client.listResources();
  log('list', `Found ${resources.length} resources:`);
  resources.forEach((r) => console.log(`  • ${r.uri} (${r.name})`));

  // Read the first resource
  const uri = resources[0].uri;
  log('read', `Reading ${uri}...`);
  const result = await client.readResource(uri);
  const content = result.contents[0];
  if (content && 'text' in content) {
    console.log(`  ✓ Content: ${content.text.substring(0, 100)}${content.text.length > 100 ? '...' : ''}`);
  }
}

// ─── Prompts ────────────────────────────────────────────────────────────────

async function testPrompts(client: MCPClient) {
  console.log('\n=== Prompts ===\n');

  const prompts = await client.listPrompts();
  log('list', `Found ${prompts.length} prompts:`);
  prompts.forEach((p) => {
    const args = p.arguments?.map((a) => a.name).join(', ') || 'none';
    console.log(`  • ${p.name} (${args})`);
  });

  // Simple prompt (no args)
  const simple = await client.getPrompt('simple-prompt', {});
  log('simple-prompt', simple.messages[0].content.text || '(content)');

  // Args prompt (requires 'city')
  const argsPrompt = await client.getPrompt('args-prompt', { city: 'New York' });
  log('args-prompt', (argsPrompt.messages[0].content as { text: string }).text);
}

// ─── Error Handling ─────────────────────────────────────────────────────────

async function testErrors(client: MCPClient) {
  console.log('\n=== Error Handling ===\n');

  // Unknown tool — server returns error content (doesn't throw)
  const badTool = await client.callTool({
    name: 'nonexistent-tool-xyz',
    arguments: {},
  });
  const isExpectedError = badTool.isError || extractText(badTool).includes('error');
  log('unknown-tool', isExpectedError ? '✓ Server returned error as expected' : 'Unexpected success');

  // Missing resource — throws
  try {
    await client.readResource('nonexistent://resource-xyz');
    log('missing-resource', '✗ Should have thrown');
  } catch {
    log('missing-resource', '✓ Threw error as expected');
  }
}

// ─── Multiple Operations ────────────────────────────────────────────────────

async function testMultipleOperations(client: MCPClient) {
  console.log('\n=== Multiple Operations ===\n');

  // Sequential calls
  const echo = await client.callTool({ name: 'echo', arguments: { message: 'seq-1' } });
  const sum = await client.callTool({ name: 'get-sum', arguments: { a: 10, b: 20 } });
  log('sequential', `echo: "${extractText(echo)}", sum: "${extractText(sum)}"`);

  // Discover then use
  const tools = await client.listTools();
  const result = await client.callTool({ name: 'echo', arguments: { message: 'discovered!' } });
  log('discover-then-use', `Listed ${tools.length} tools, called echo: "${extractText(result)}"`);

  // Concurrent calls
  const [r1, r2, r3] = await Promise.all([
    client.callTool({ name: 'echo', arguments: { message: 'parallel-1' } }),
    client.callTool({ name: 'echo', arguments: { message: 'parallel-2' } }),
    client.callTool({ name: 'get-sum', arguments: { a: 1, b: 2 } }),
  ]);
  log('concurrent', `${extractText(r1)} | ${extractText(r2)} | ${extractText(r3)}`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  MCP Tester — Everything Server Test Example     ║');
  console.log('╚══════════════════════════════════════════════════╝');

  const client = new MCPClient({
    name: 'everything-server-example',
    version: '1.0.0',
    timeout: 15000,
    logLevel: 'error',
  });

  try {
    await testConnection(client);
    await testTools(client);
    await testResources(client);
    await testPrompts(client);
    await testErrors(client);
    await testMultipleOperations(client);

    console.log('\n═══════════════════════════════════════════════════');
    console.log('  All tests completed successfully! ✓');
    console.log('═══════════════════════════════════════════════════\n');
  } catch (error) {
    console.error('\n✗ Test failed:', error);
    process.exit(1);
  } finally {
    if (client.isConnected()) {
      await client.stop();
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as everythingServerTest };

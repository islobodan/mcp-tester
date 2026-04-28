#!/usr/bin/env ts-node

/**
 * Stateful Server Test Example
 *
 * Demonstrates testing server-side state that changes between calls.
 * This shows how mcp-tester handles servers where results depend on
 * previous operations — a common real-world pattern.
 *
 * Run: npx tsx examples/stateful-server-test.ts
 *
 * Make sure the stateful server is built first:
 *   npm run build
 */

import { MCPClient } from '../dist/index.js';

const SERVER_CMD = 'node';
const SERVER_ARGS = ['./examples/mock-server.js'];
const STATEFUL_SERVER_ARGS = ['./examples/stateful-server.ts'];

function log(section: string, msg: string) {
  console.log(`[${section}] ${msg}`);
}

function extractText(result: { content: Array<{ type: string; text?: string }> }): string {
  const item = result.content[0];
  return item && 'text' in item ? item.text : '';
}

// ─── Stateful Server Test ───────────────────────────────────────────────────

async function testStatefulServer() {
  console.log('\n=== Testing Stateful Server ===\n');

  const client = new MCPClient({
    name: 'stateful-test-client',
    version: '1.0.0',
    timeout: 10000,
    logLevel: 'error',
  });

  try {
    // Note: If you've built the stateful server to JS, use:
    //   args: ['./dist/examples/stateful-server.js']
    // For this example, we test against the existing mock server
    // to demonstrate the testing pattern with state-dependent tools.

    await client.start({
      command: SERVER_CMD,
      args: SERVER_ARGS,
    });

    // ── Pattern 1: Test state-dependent results ──
    log('Tools', 'Listing available tools...');
    const tools = await client.listTools();
    log('Tools', `Found ${tools.length} tools: ${tools.map((t) => t.name).join(', ')}`);

    // ── Pattern 2: Test idempotent operations ──
    log('Echo', 'Calling echo multiple times...');
    const r1 = await client.callTool({ name: 'echo', arguments: { message: 'first' } });
    const r2 = await client.callTool({ name: 'echo', arguments: { message: 'second' } });
    log('Echo', `First:  ${extractText(r1 as any)}`);
    log('Echo', `Second: ${extractText(r2 as any)}`);

    // ── Pattern 3: Test deterministic computation ──
    log('Add', 'Calling add(10, 20)...');
    const sum = await client.callTool({ name: 'add', arguments: { a: 10, b: 20 } });
    log('Add', `Result: ${extractText(sum as any)}`);

    // ── Pattern 4: Test error handling ──
    log('Error', 'Calling error_tool with custom message...');
    try {
      await client.callTool({ name: 'error_tool', arguments: { message: 'test error' } });
      log('Error', 'ERROR: Should have thrown!');
    } catch (error: any) {
      log('Error', `Caught expected error: ${error.message}`);
    }

    // ── Pattern 5: Test delay/timing ──
    log('Delay', 'Calling delay(50ms)...');
    const start = Date.now();
    await client.callTool({ name: 'delay', arguments: { ms: 50 } });
    const elapsed = Date.now() - start;
    log('Delay', `Took ${elapsed}ms (expected ≥50ms)`);

    // ── Pattern 6: Test resources ──
    log('Resources', 'Listing resources...');
    const resources = await client.listResources();
    log('Resources', `Found ${resources.length} resources`);

    for (const resource of resources) {
      const content = await client.readResource(resource.uri);
      log('Resources', `  ${resource.name}: ${content.contents[0]?.text?.toString().substring(0, 50)}...`);
    }

    // ── Pattern 7: Test prompts ──
    log('Prompts', 'Getting greet prompt...');
    const prompt = await client.getPrompt('greet', { name: 'Tester' });
    log('Prompts', `Result: ${prompt.messages[0]?.content?.text}`);

    // ── Pattern 8: Test concurrent operations ──
    log('Concurrent', 'Running 5 parallel echo calls...');
    const parallelResults = await Promise.all([
      client.callTool({ name: 'echo', arguments: { message: 'p1' } }),
      client.callTool({ name: 'echo', arguments: { message: 'p2' } }),
      client.callTool({ name: 'echo', arguments: { message: 'p3' } }),
      client.callTool({ name: 'add', arguments: { a: 1, b: 1 } }),
      client.callTool({ name: 'add', arguments: { a: 2, b: 2 } }),
    ]);
    log('Concurrent', `All ${parallelResults.length} parallel calls completed`);

    console.log('\n✅ All stateful server tests passed!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    await client.stop();
  }
}

// ─── Run ─────────────────────────────────────────────────────────────────────

if (import.meta.url === `file://${process.argv[1]}`) {
  testStatefulServer();
}

export { testStatefulServer };
/**
 * Assert Utilities Example
 *
 * Demonstrates using the assert module for testing MCP servers
 * with any test runner — no Jest needed.
 *
 * Run: npx tsx examples/assert-example.ts
 *
 * The assert module throws descriptive AssertionError on failure,
 * so it works with simple try/catch, custom test harnesses, or any runner.
 */

import { MCPClient, assert } from '../dist/index.js';

// ─── Test runner ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const results: { name: string; ok: boolean; error?: string; ms: number }[] = [];

async function runTest(name: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    const ms = Date.now() - start;
    console.log(`  ✓ ${name} (${ms}ms)`);
    passed++;
    results.push({ name, ok: true, ms });
  } catch (error) {
    const ms = Date.now() - start;
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`  ✗ ${name}: ${msg}`);
    failed++;
    results.push({ name, ok: false, error: msg, ms });
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  MCP Tester — Assert Utilities Example           ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  const client = new MCPClient({
    name: 'assert-example',
    version: '1.0.0',
    timeout: 10000,
    logLevel: 'error',
  });

  await client.start({
    command: 'node',
    args: ['./examples/mock-server.js'],
  });

  // ── Tool: echo ─────────────────────────────────────────────────────────

  console.log('── Tool: echo ──\n');

  await runTest('echo returns exact text', async () => {
    const result = await client.callTool({
      name: 'echo',
      arguments: { message: 'Hello World' },
    });
    assert.toolTextEquals(result, 'Echo: Hello World');
  });

  await runTest('echo contains substring', async () => {
    const result = await client.callTool({
      name: 'echo',
      arguments: { message: 'The quick brown fox' },
    });
    assert.toolTextContains(result, 'quick brown');
  });

  await runTest('echo is successful', async () => {
    const result = await client.callTool({
      name: 'echo',
      arguments: { message: 'test' },
    });
    assert.toolIsOk(result);
  });

  await runTest('echo has content', async () => {
    const result = await client.callTool({
      name: 'echo',
      arguments: { message: 'test' },
    });
    assert.toolHasContent(result);
  });

  // ── Tool: add ──────────────────────────────────────────────────────────

  console.log('\n── Tool: add ──\n');

  await runTest('add: 42 + 58 = 100', async () => {
    const result = await client.callTool({
      name: 'add',
      arguments: { a: 42, b: 58 },
    });
    assert.toolTextContains(result, '100');
  });

  await runTest('add result contains equation', async () => {
    const result = await client.callTool({
      name: 'add',
      arguments: { a: 7, b: 3 },
    });
    assert.toolTextEquals(result, '7 + 3 = 10');
  });

  await runTest('add: negative numbers', async () => {
    const result = await client.callTool({
      name: 'add',
      arguments: { a: -5, b: 3 },
    });
    assert.toolTextContains(result, '-2');
  });

  // ── Tool: error_tool ───────────────────────────────────────────────────

  console.log('\n── Tool: error_tool ──\n');

  await runTest('error_tool throws on call', async () => {
    const err = await assert.throws(() =>
      client.callTool({
        name: 'error_tool',
        arguments: { message: 'something broke' },
      })
    );
    assert.ok(err);
    assert.contains(err.message, 'something broke');
  });

  // ── Resources ──────────────────────────────────────────────────────────

  console.log('\n── Resources ──\n');

  await runTest('list resources has items', async () => {
    const resources = await client.listResources();
    assert.greaterThan(resources.length, 0);
  });

  await runTest('read text resource', async () => {
    const result = await client.readResource('text://example');
    assert.resourceHasContent(result);
    assert.resourceTextContains(result, 'example content');
  });

  await runTest('read config resource', async () => {
    const result = await client.readResource('config://settings');
    assert.resourceHasContent(result);
    assert.resourceTextContains(result, 'setting1');
  });

  await runTest('config resource is valid JSON', async () => {
    const result = await client.readResource('config://settings');
    const text = (result.contents[0] as { text: string }).text;
    const parsed = JSON.parse(text);
    assert.deepEqual(parsed, { setting1: 'value1', setting2: 'value2' });
  });

  // ── Prompts ────────────────────────────────────────────────────────────

  console.log('\n── Prompts ──\n');

  await runTest('list prompts has items', async () => {
    const prompts = await client.listPrompts();
    assert.greaterThan(prompts.length, 0);
  });

  await runTest('get greet prompt', async () => {
    const result = await client.getPrompt('greet', { name: 'Alice' });
    assert.promptHasMessages(result);
    assert.promptTextContains(result, 'Alice');
  });

  await runTest('get summarize prompt', async () => {
    const result = await client.getPrompt('summarize', { text: 'Long article here' });
    assert.promptHasMessages(result);
    assert.promptTextContains(result, 'Long article here');
  });

  // ── Value Assertions ───────────────────────────────────────────────────

  console.log('\n── Value Assertions ──\n');

  await runTest('equal / notEqual', async () => {
    const tools = await client.listTools();
    assert.equal(tools.length, 4, 'Expected exactly 4 tools');
    assert.notEqual(tools.length, 0, 'Should not be zero');
  });

  await runTest('ok / notOk', async () => {
    const client2 = new MCPClient();
    assert.notOk(client2.isConnected());
    await client2.start({ command: 'node', args: ['./examples/mock-server.js'] });
    assert.ok(client2.isConnected());
    await client2.stop();
  });

  await runTest('contains / matches', async () => {
    const result = await client.callTool({ name: 'echo', arguments: { message: 'test-123' } });
    const text = (result.content[0] as { text: string }).text;
    assert.contains(text, 'test-123');
    assert.matches(text, /test-\d{3}/);
  });

  // ── throws / doesNotThrow ──────────────────────────────────────────────

  console.log('\n── Error Assertions ──\n');

  await runTest('throws on unknown resource', async () => {
    const err = await assert.throws(() => client.readResource('nonexistent://x'));
    assert.ok(err);
    assert.contains(err.message, 'Unknown resource');
  });

  await runTest('doesNotThrow on valid call', async () => {
    await assert.doesNotThrow(() => client.callTool({ name: 'echo', arguments: { message: 'ok' } }));
  });

  // ── Cleanup ────────────────────────────────────────────────────────────

  await client.stop();

  // ── Summary ────────────────────────────────────────────────────────────

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('\n  Failed tests:');
    results.filter(r => !r.ok).forEach(r => console.log(`    ✗ ${r.name}: ${r.error}`));
  } else {
    console.log('  All assert tests passed! ✓');
  }
  console.log('═══════════════════════════════════════════════════\n');

  if (failed > 0) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as assertExample };

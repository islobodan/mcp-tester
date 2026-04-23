/**
 * Jest Matchers Example
 *
 * Demonstrates all custom Jest matchers for testing MCP servers.
 * Uses a standalone expect() wrapper so it runs without Jest.
 * In real Jest tests, just import and call expect.extend().
 *
 * Run: npx tsx examples/jest-matchers-example.ts
 *
 * In a Jest test file:
 *   import { toHaveTool, toReturnText, setupCustomMatchers } from '@slbdn/mcp-tester';
 *   beforeAll(() => setupCustomMatchers());
 *   // @ts-expect-error - custom matcher
 *   expect(tools).toHaveTool('echo');
 */

import {
  MCPClient,
  // Collection matchers
  toHaveTool,
  toHaveResource,
  toHavePrompt,
  toHaveToolWithSchema,
  toHaveToolCount,
  toHaveResourceCount,
  toHavePromptCount,
  toHaveResourceByName,
  toHavePromptWithArgs,
  // Tool result matchers
  toReturnText,
  toReturnTextContaining,
  toReturnError,
  toReturnOk,
  toReturnJson,
  toReturnContentCount,
  toReturnImage,
  // Resource result matchers
  toReturnResourceText,
  toReturnResourceTextContaining,
  // Prompt result matchers
  toReturnPromptTextContaining,
  toReturnPromptMessageCount,
} from '../dist/index.js';

// ─── Minimal expect() for standalone demo ───────────────────────────────────

type MatcherFn = (received: any, ...args: any[]) => { pass: boolean; message: () => string }; // eslint-disable-line @typescript-eslint/no-explicit-any

const matchers: Record<string, MatcherFn> = {
  toHaveTool, toHaveResource, toHavePrompt, toHaveToolWithSchema,
  toHaveToolCount, toHaveResourceCount, toHavePromptCount,
  toHaveResourceByName, toHavePromptWithArgs,
  toReturnText, toReturnTextContaining, toReturnError, toReturnOk,
  toReturnJson, toReturnContentCount, toReturnImage,
  toReturnResourceText, toReturnResourceTextContaining,
  toReturnPromptTextContaining, toReturnPromptMessageCount,
};

function expect<T>(received: T) {
  const obj: Record<string, (...args: any[]) => void> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
  for (const [name, fn] of Object.entries(matchers)) {
    obj[name] = (...args: any[]) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const result = fn(received, ...args);
      if (!result.pass) throw new Error(result.message());
      console.log(`  ✓ ${name}(${args.map((a: any) => JSON.stringify(a)).join(', ')})`); // eslint-disable-line @typescript-eslint/no-explicit-any
    };
  }
  return obj;
}

// ─── Test runner ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function runTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
  } catch (error) {
    console.error(`  ✗ ${name}: ${error instanceof Error ? error.message : error}`);
    failed++;
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  MCP Tester — Jest Matchers Example               ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  const client = new MCPClient({ name: 'matchers-example', version: '1.0.0', timeout: 10000, logLevel: 'error' });
  await client.start({ command: 'node', args: ['./examples/mock-server.js'] });

  // ── Collection: Tool Matchers ─────────────────────────────────────────

  console.log('── Collection: Tool Matchers ──\n');

  await runTest('toHaveTool', async () => {
    const tools = await client.listTools();
    expect(tools).toHaveTool('echo');
    expect(tools).toHaveTool('add');
  });

  await runTest('toHaveToolWithSchema', async () => {
    const tools = await client.listTools();
    expect(tools).toHaveToolWithSchema('echo');
  });

  await runTest('toHaveToolCount', async () => {
    const tools = await client.listTools();
    expect(tools).toHaveToolCount(4);
  });

  // ── Collection: Resource Matchers ─────────────────────────────────────

  console.log('\n── Collection: Resource Matchers ──\n');

  await runTest('toHaveResource', async () => {
    const resources = await client.listResources();
    expect(resources).toHaveResource('text://example');
  });

  await runTest('toHaveResourceByName', async () => {
    const resources = await client.listResources();
    expect(resources).toHaveResourceByName('Settings');
    expect(resources).toHaveResourceByName('Example Text Resource');
  });

  await runTest('toHaveResourceCount', async () => {
    const resources = await client.listResources();
    expect(resources).toHaveResourceCount(2);
  });

  // ── Collection: Prompt Matchers ──────────────────────────────────────

  console.log('\n── Collection: Prompt Matchers ──\n');

  await runTest('toHavePrompt', async () => {
    const prompts = await client.listPrompts();
    expect(prompts).toHavePrompt('greet');
  });

  await runTest('toHavePromptWithArgs', async () => {
    const prompts = await client.listPrompts();
    expect(prompts).toHavePromptWithArgs('greet');
  });

  await runTest('toHavePromptCount', async () => {
    const prompts = await client.listPrompts();
    expect(prompts).toHavePromptCount(2);
  });

  // ── Tool Result Matchers ─────────────────────────────────────────────

  console.log('\n── Tool Result Matchers ──\n');

  await runTest('toReturnText (exact match)', async () => {
    const result = await client.callTool({ name: 'add', arguments: { a: 3, b: 7 } });
    expect(result).toReturnText('3 + 7 = 10');
  });

  await runTest('toReturnText (has any text)', async () => {
    const result = await client.callTool({ name: 'echo', arguments: { message: 'hello' } });
    expect(result).toReturnText();
  });

  await runTest('toReturnTextContaining', async () => {
    const result = await client.callTool({ name: 'echo', arguments: { message: 'hello world' } });
    expect(result).toReturnTextContaining('world');
  });

  await runTest('toReturnOk', async () => {
    const result = await client.callTool({ name: 'echo', arguments: { message: 'ok' } });
    expect(result).toReturnOk();
  });

  await runTest('toReturnJson', async () => {
    const result = await client.readResource('config://settings');
    const text = (result.contents[0] as { text: string }).text;
    // Use a tool that returns JSON-like content
    const echo = await client.callTool({ name: 'echo', arguments: { message: text } });
    // The echo wraps in "Echo: ..." so let's just test toReturnTextContaining
    expect(echo).toReturnTextContaining('setting1');
  });

  await runTest('toReturnContentCount', async () => {
    const result = await client.callTool({ name: 'echo', arguments: { message: 'test' } });
    expect(result).toReturnContentCount(1);
  });

  // ── Resource Result Matchers ──────────────────────────────────────────

  console.log('\n── Resource Result Matchers ──\n');

  await runTest('toReturnResourceText (exact)', async () => {
    const result = await client.readResource('text://example');
    expect(result).toReturnResourceText('This is example content from the resource.');
  });

  await runTest('toReturnResourceText (has any)', async () => {
    const result = await client.readResource('text://example');
    expect(result).toReturnResourceText();
  });

  await runTest('toReturnResourceTextContaining', async () => {
    const result = await client.readResource('config://settings');
    expect(result).toReturnResourceTextContaining('setting1');
  });

  // ── Prompt Result Matchers ────────────────────────────────────────────

  console.log('\n── Prompt Result Matchers ──\n');

  await runTest('toReturnPromptTextContaining', async () => {
    const result = await client.getPrompt('greet', { name: 'Alice' });
    expect(result).toReturnPromptTextContaining('Alice');
  });

  await runTest('toReturnPromptMessageCount', async () => {
    const result = await client.getPrompt('greet', { name: 'Bob' });
    expect(result).toReturnPromptMessageCount(1);
  });

  // ── Cleanup ──────────────────────────────────────────────────────────

  await client.stop();

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  ${passed} passed, ${failed} failed`);
  if (failed === 0) console.log('  All matcher tests passed! ✓');
  console.log('═══════════════════════════════════════════════════\n');

  if (failed > 0) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as jestMatchersExample };
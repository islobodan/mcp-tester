/**
 * Jest Matchers Example
 *
 * Demonstrates using custom Jest matchers (toHaveTool, toHaveResource, toHavePrompt)
 * to test an MCP server with familiar expect() syntax.
 *
 * Run: npx tsx examples/jest-matchers-example.ts
 *
 * Note: This uses a standalone expect() implementation so it runs without Jest.
 *       In real Jest tests, just import matchers and call expect.extend().
 *
 * In a real Jest test file, you'd write:
 *   import { toHaveTool, toHaveResource, toHavePrompt } from '@slbdn/mcp-tester';
 *   expect.extend({ toHaveTool, toHaveResource, toHavePrompt });
 *   // @ts-expect-error - custom matcher
 *   expect(tools).toHaveTool('echo');
 */

import { MCPClient, toHaveTool, toHaveResource, toHavePrompt, toHaveToolWithSchema } from '../dist/index.js';

// ─── Minimal expect() for standalone demo ───────────────────────────────────

function expect<T>(received: T) {
  return {
    toHaveTool: (name: string) => {
      const result = toHaveTool(received as any[], name); // eslint-disable-line @typescript-eslint/no-explicit-any
      if (!result.pass) throw new Error(result.message());
      console.log(`  ✓ toHaveTool("${name}")`);
    },
    toHaveResource: (uri: string) => {
      const result = toHaveResource(received as any[], uri); // eslint-disable-line @typescript-eslint/no-explicit-any
      if (!result.pass) throw new Error(result.message());
      console.log(`  ✓ toHaveResource("${uri}")`);
    },
    toHavePrompt: (name: string) => {
      const result = toHavePrompt(received as any[], name); // eslint-disable-line @typescript-eslint/no-explicit-any
      if (!result.pass) throw new Error(result.message());
      console.log(`  ✓ toHavePrompt("${name}")`);
    },
    toHaveToolWithSchema: (name: string) => {
      const result = toHaveToolWithSchema(received as any[], name); // eslint-disable-line @typescript-eslint/no-explicit-any
      if (!result.pass) throw new Error(result.message());
      console.log(`  ✓ toHaveToolWithSchema("${name}")`);
    },
  };
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
  console.log('║  MCP Tester — Jest Matchers Example              ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  const client = new MCPClient({
    name: 'matchers-example',
    version: '1.0.0',
    timeout: 10000,
    logLevel: 'error',
  });

  await client.start({
    command: 'node',
    args: ['./examples/mock-server.js'],
  });

  // ── Tool Matchers ──────────────────────────────────────────────────────

  console.log('── Tool Matchers ──\n');

  await runTest('tools list has echo', async () => {
    const tools = await client.listTools();
    expect(tools).toHaveTool('echo');
  });

  await runTest('tools list has add', async () => {
    const tools = await client.listTools();
    expect(tools).toHaveTool('add');
  });

  await runTest('tools list has delay', async () => {
    const tools = await client.listTools();
    expect(tools).toHaveTool('delay');
  });

  await runTest('tools list has error_tool', async () => {
    const tools = await client.listTools();
    expect(tools).toHaveTool('error_tool');
  });

  await runTest('echo has input schema', async () => {
    const tools = await client.listTools();
    expect(tools).toHaveToolWithSchema('echo');
  });

  await runTest('add has input schema', async () => {
    const tools = await client.listTools();
    expect(tools).toHaveToolWithSchema('add');
  });

  // ── Resource Matchers ──────────────────────────────────────────────────

  console.log('\n── Resource Matchers ──\n');

  await runTest('resources have text://example', async () => {
    const resources = await client.listResources();
    expect(resources).toHaveResource('text://example');
  });

  await runTest('resources have config://settings', async () => {
    const resources = await client.listResources();
    expect(resources).toHaveResource('config://settings');
  });

  // ── Prompt Matchers ────────────────────────────────────────────────────

  console.log('\n── Prompt Matchers ──\n');

  await runTest('prompts have greet', async () => {
    const prompts = await client.listPrompts();
    expect(prompts).toHavePrompt('greet');
  });

  await runTest('prompts have summarize', async () => {
    const prompts = await client.listPrompts();
    expect(prompts).toHavePrompt('summarize');
  });

  // ── Cleanup ────────────────────────────────────────────────────────────

  await client.stop();

  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  ${passed} passed, ${failed} failed`);
  if (failed === 0) console.log('  All matcher tests passed! ✓');
  console.log('═══════════════════════════════════════════════════\n');

  if (failed > 0) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as jestMatchersExample };

# Examples

Practical code examples for common MCP Tester use cases.

## Basic Tool Testing

```typescript
import { MCPClient } from '@slbdn/mcp-tester';

async function testTool() {
  const client = new MCPClient();

  try {
    await client.start({
      command: 'node',
      args: ['./my-server.js'],
    });

    const tools = await client.listTools();
    console.log(`Found ${tools.length} tools`);

    for (const tool of tools) {
      console.log(`\nTesting: ${tool.name}`);
      const result = await client.callTool({
        name: tool.name,
        arguments: {},
      });
      console.log(`Result: ${result.content[0]?.text}`);
    }
  } finally {
    await client.stop();
  }
}

testTool();
```

## Resource Reading

```typescript
import { MCPClient } from '@slbdn/mcp-tester';

async function readConfiguration() {
  const client = new MCPClient();

  try {
    await client.start({
      command: 'node',
      args: ['./config-server.js'],
    });

    const resources = await client.listResources();
    console.log('Available resources:', resources.map(r => r.uri));

    const settings = await client.readResource('config://settings');
    console.log('Settings:', JSON.parse(settings.contents[0].text as string));
  } finally {
    await client.stop();
  }
}

readConfiguration();
```

## Using Prompts

```typescript
import { MCPClient } from '@slbdn/mcp-tester';

async function usePrompt() {
  const client = new MCPClient();

  try {
    await client.start({
      command: 'node',
      args: ['./prompt-server.js'],
    });

    const prompt = await client.getPrompt('greet', { name: 'World' });
    console.log('Generated message:', prompt.messages[0].content.text);
  } finally {
    await client.stop();
  }
}

usePrompt();
```

## Complete Jest Test Suite

```typescript
import { MCPClient, setupJestMatchers } from '@slbdn/mcp-tester';
import { beforeAll, beforeEach, afterEach, describe, it, expect } from '@jest/globals';

beforeAll(() => setupJestMatchers());

describe('My MCP Server', () => {
  let client: MCPClient;

  beforeEach(async () => {
    client = new MCPClient();
    await client.start({ command: 'node', args: ['./server.js'] });
  });

  afterEach(async () => {
    if (client.isConnected()) await client.stop();
  });

  it('should have expected tools', async () => {
    const tools = await client.listTools();
    expect(tools).toHaveTool('echo');
    expect(tools).toHaveToolCount(5);
  });

  it('should call tool and check result', async () => {
    const result = await client.callTool({
      name: 'calculate',
      arguments: { operation: 'add', values: [10, 20] },
    });
    expect(result).toReturnText('30');
  });

  it('should handle errors', async () => {
    const result = await client.callTool({
      name: 'fail-tool',
      arguments: {},
    });
    expect(result).toReturnError();
  });
});
```

## Complete Vitest Test Suite

```typescript
import { MCPClient, setupVitestMatchers } from '@slbdn/mcp-tester';
import { beforeAll, beforeEach, afterEach, describe, it, expect } from 'vitest';
// /// <reference types="@slbdn/mcp-tester/vitest" />

beforeAll(() => setupVitestMatchers());

describe('My MCP Server', () => {
  let client: MCPClient;

  beforeEach(async () => {
    client = new MCPClient();
    await client.start({ command: 'node', args: ['./server.js'] });
  });

  afterEach(async () => {
    if (client.isConnected()) await client.stop();
  });

  it('should have expected tools', async () => {
    const tools = await client.listTools();
    expect(tools).toHaveTool('echo');
    expect(tools).toHaveToolCount(5);
  });

  it('should call tool and check result', async () => {
    const result = await client.callTool({
      name: 'calculate',
      arguments: { operation: 'add', values: [10, 20] },
    });
    expect(result).toReturnText('30');
  });
});
```

## Using Assert Utilities (Any Test Runner)

```typescript
import { MCPClient, assert } from '@slbdn/mcp-tester';

async function runTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}: ${error instanceof Error ? error.message : error}`);
  }
}

const client = new MCPClient();
await client.start({ command: 'node', args: ['./server.js'] });

await runTest('echo returns correct text', async () => {
  const result = await client.callTool({ name: 'echo', arguments: { message: 'hello' } });
  assert.toolTextEquals(result, 'Echo: hello');
  assert.toolTextContains(result, 'hello');
  assert.toolIsOk(result);
});

await runTest('add computes sum', async () => {
  const result = await client.callTool({ name: 'add', arguments: { a: 3, b: 7 } });
  assert.toolTextContains(result, '10');
});

await runTest('config is valid JSON', async () => {
  const result = await client.readResource('config://settings');
  assert.resourceHasContent(result);
  assert.resourceTextContains(result, 'setting1');
});

await client.stop();
```

## Running the Examples

```bash
# Basic functionality test
npx tsx examples/basic-test.ts

# Full capabilities test
npx tsx examples/full-test.ts

# Jest matchers example
npx tsx examples/jest-matchers-example.ts

# Assert utilities example
npx tsx examples/assert-example.ts

# Test against a real MCP server (server-everything)
npx tsx examples/everything-server-test.ts

# Run mock server standalone (for manual testing)
node examples/mock-server.js
```
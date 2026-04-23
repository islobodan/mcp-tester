# Testing

Guide to writing and running tests with MCP Tester.

## Running Tests

```bash
npm test                # Run all tests
npm run test:watch      # Watch mode (auto-rerun on changes)
npm run test:coverage   # Run with coverage report
npm run lint            # Lint code
```

## Test Structure

```
src/__tests__/
├── client.test.ts               # Basic client operations
├── resources-prompts.test.ts    # Resources and prompts
├── advanced.test.ts             # Sampling, elicitation
├── real-server.test.ts          # Integration tests (stdio transport)
├── everything-server.test.ts    # Full integration (server-everything)
├── cli.test.ts                  # CLI tool tests
└── fixtures/
    └── mock-server.ts           # In-memory mock MCP server
```

## Writing Tests

### Basic Test Template

```typescript
import { MCPClient } from '@slbdn/mcp-tester';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('My MCP Server', () => {
  let client: MCPClient;

  beforeEach(async () => {
    client = new MCPClient({
      name: 'test-client',
      version: '1.0.0',
    });
    await client.start({
      command: 'node',
      args: ['./my-server.js'],
    });
  });

  afterEach(async () => {
    if (client.isConnected()) {
      await client.stop();
    }
  });

  it('should list tools', async () => {
    const tools = await client.listTools();
    expect(tools.length).toBeGreaterThan(0);
  });
});
```

### Testing Patterns

**Always use async/await:**

```typescript
const result = await client.listTools();   // ✓ Correct
const result = client.listTools();         // ✗ Returns Promise
```

**Always clean up in afterEach:**

```typescript
afterEach(async () => {
  if (client.isConnected()) {
    await client.stop();
  }
});
```

**Test errors with rejects.toThrow():**

```typescript
it('should handle invalid tool', async () => {
  await expect(
    client.callTool({ name: 'non-existent', arguments: {} })
  ).rejects.toThrow();
});
```

**Test specific error types:**

```typescript
import { MCPTimeoutError, MCPServerError } from '@slbdn/mcp-tester';

it('should throw timeout error', async () => {
  try {
    await client.callTool({ name: 'slow-tool', arguments: {}, timeout: 1 });
  } catch (error) {
    expect(error).toBeInstanceOf(MCPTimeoutError);
  }
});
```

### Using the Assert Module

For custom test runners (not Jest), use the `assert` module:

```typescript
import { MCPClient, assert } from '@slbdn/mcp-tester';

const client = new MCPClient();
await client.start({ command: 'node', args: ['./server.js'] });

const result = await client.callTool({ name: 'echo', arguments: { message: 'hello' } });
assert.toolTextContains(result, 'hello');
assert.toolNumEquals(yourResult, 42);
assert.toolIsOk(result);

// Value assertions
assert.equal(tools.length, 4);
assert.greaterThan(resources.length, 0);
```

See [Examples](./examples.md) for full assert usage examples.

## Custom Matchers

```typescript
import { toHaveTool, toHaveResource, toHavePrompt } from '@slbdn/mcp-tester';

expect.extend({ toHaveTool, toHaveResource, toHavePrompt });
```

| Matcher | Description |
|---------|-------------|
| `toHaveTool(name)` | Checks if tool exists |
| `toHaveResource(uri)` | Checks if resource exists |
| `toHavePrompt(name)` | Checks if prompt exists |
| `toHaveToolWithSchema(name)` | Checks if tool has input schema |

**Example:**

```typescript
it('should have expected tools', async () => {
  const tools = await client.listTools();
  // @ts-expect-error - Custom matcher
  expect(tools).toHaveTool('echo');
  // @ts-expect-error - Custom matcher
  expect(tools).toHaveToolWithSchema('echo');
});

it('should have expected resources', async () => {
  const resources = await client.listResources();
  // @ts-expect-error - Custom matcher
  expect(resources).toHaveResource('text://example');
});
```

## Mock Server

Use the in-memory mock server for fast unit tests without a real server process:

```typescript
import { MockMCPServer } from './fixtures/mock-server.js';

describe('Unit Test', () => {
  let mockServer: MockMCPServer;

  beforeEach(() => {
    mockServer = new MockMCPServer();
  });

  it('should echo messages', async () => {
    const result = await mockServer.handleToolCall('echo', { message: 'test' });
    expect(result.content[0].text).toBe('Echo: test');
  });

  it('should read resources', async () => {
    const result = await mockServer.handleResourceRead('config://settings');
    expect(result.contents[0].text).toContain('setting1');
  });

  it('should get prompts', async () => {
    const result = await mockServer.handlePromptGet('greet', { name: 'Alice' });
    expect(result.messages[0].content.text).toContain('Alice');
  });

  it('should support custom tools', () => {
    mockServer.addTool({
      name: 'custom',
      description: 'A custom tool',
      inputSchema: { type: 'object', properties: {} },
    });
  });
});
```

**Built-in mock tools:** `echo`, `add`, `delay`, `error_tool`
**Built-in mock resources:** `text://example`, `config://settings`
**Built-in mock prompts:** `greet`, `summarize`

## Test Coverage

```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

Coverage thresholds: **80%** for branches, functions, lines, and statements.
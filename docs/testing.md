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
├── helpers-example.test.ts      # Test helpers usage examples
├── helpers.ts                   # Test utility functions
├── matchers.ts                  # Custom Jest matchers
└── fixtures/
    └── mock-server.ts           # In-memory mock MCP server
```

## Writing Tests

### Basic Test Template

```typescript
import { MCPClient } from '../client/MCPClient.js';
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

## Test Helpers

Import helpers to reduce boilerplate:

```typescript
import { createTestClient, createTestSuite, createMockServerConfig } from './helpers.js';
```

| Helper | Description |
|--------|-------------|
| `createTestClient(options?)` | Creates client with sensible test defaults |
| `createTestSuite(serverConfig, options?)` | Creates suite with auto setup/teardown |
| `setupTestServer(config, options?)` | Manual server setup, returns client |
| `teardownTestServer(client)` | Manual server cleanup |
| `createMockServerConfig(args?)` | Creates config pointing to mock server |
| `waitForClientState(client, state, timeout?)` | Waits for connection state change |
| `runWithTimeout(fn, timeout?)` | Runs function with timeout |
| `retryUntil(fn, attempts?, delay?)` | Retries until success |
| `callTool(client, name, args?)` | Quick tool call helper |
| `validateToolResult(result)` | Validates tool result shape |

### Using createTestSuite

```typescript
const testSuite = createTestSuite(createMockServerConfig());

beforeEach(async () => await testSuite.setup());
afterEach(async () => await testSuite.teardown());

it('should list tools', async () => {
  const tools = await testSuite.client.listTools();
  expect(tools.length).toBeGreaterThan(0);
});
```

## Custom Matchers

```typescript
import { toHaveTool, toHaveResource, toHavePrompt } from './matchers.js';

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

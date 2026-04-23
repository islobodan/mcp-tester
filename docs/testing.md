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

### Jest

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

### Vitest

```typescript
import { MCPClient, setupVitestMatchers } from '@slbdn/mcp-tester';
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
// /// <reference types="@slbdn/mcp-tester/vitest" />

beforeAll(() => setupVitestMatchers());

describe('My MCP Server', () => {
  let client: MCPClient;

  beforeEach(async () => {
    client = new MCPClient({ name: 'test-client', version: '1.0.0' });
    await client.start({ command: 'node', args: ['./my-server.js'] });
  });

  afterEach(async () => {
    if (client.isConnected()) await client.stop();
  });

  it('should list tools', async () => {
    const tools = await client.listTools();
    expect(tools).toHaveTool('echo');
  });
});
```

### Custom Test Runner (assert module)

For any test runner — no framework dependency:

```typescript
import { MCPClient, assert } from '@slbdn/mcp-tester';

const client = new MCPClient();
await client.start({ command: 'node', args: ['./server.js'] });

const result = await client.callTool({ name: 'echo', arguments: { message: 'hello' } });
assert.toolTextContains(result, 'hello');
assert.equal(tools.length, 4);
```

See [Examples](./examples.md) for full assert usage.

## Testing Patterns

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

## Custom Matchers

### Jest Setup

```typescript
import { setupJestMatchers } from '@slbdn/mcp-tester';
beforeAll(() => setupJestMatchers());
```

### Vitest Setup

```typescript
import { setupVitestMatchers } from '@slbdn/mcp-tester';
import { beforeAll } from 'vitest';
// /// <reference types="@slbdn/mcp-tester/vitest" />
beforeAll(() => setupVitestMatchers());
```

### All Matchers

| Matcher | Description |
|---------|-------------|
| **Collection** | |
| `toHaveTool(name)` | Assert a tool exists by name |
| `toHaveToolWithSchema(name)` | Assert a tool exists and has an input schema |
| `toHaveToolCount(n)` | Assert exact number of tools |
| `toHaveResource(uri)` | Assert a resource exists by URI |
| `toHaveResourceByName(name)` | Assert a resource exists by display name |
| `toHaveResourceCount(n)` | Assert exact number of resources |
| `toHavePrompt(name)` | Assert a prompt exists by name |
| `toHavePromptWithArgs(name)` | Assert a prompt exists and has arguments |
| `toHavePromptCount(n)` | Assert exact number of prompts |
| **Tool Results** | |
| `toReturnText(expected?)` | Tool text exact match (or just has text) |
| `toReturnTextContaining(sub)` | Tool text contains substring |
| `toReturnError()` | Tool result is an error |
| `toReturnOk()` | Tool result is successful |
| `toReturnJson(obj)` | Parse tool text as JSON, deep compare |
| `toReturnContentCount(n)` | Tool has N content items |
| `toReturnImage()` | Tool result contains an image |
| **Resource Results** | |
| `toReturnResourceText(expected?)` | Resource text exact match (or just has text) |
| `toReturnResourceTextContaining(sub)` | Resource text contains substring |
| **Prompt Results** | |
| `toReturnPromptTextContaining(sub)` | Prompt message text contains substring |
| `toReturnPromptMessageCount(n)` | Prompt has N messages |

All matchers support `.not` negation and work identically in Jest and Vitest.

## Assertion Module (Framework-Agnostic)

For custom test runners or simple scripts — throws `AssertionError` on failure:

| Assertion | Description |
|-----------|-------------|
| **Value** | |
| `equal(a, b)` / `notEqual(a, b)` | Strict equality |
| `deepEqual(a, b)` | JSON deep equality |
| `ok(val)` / `notOk(val)` | Truthy / falsy |
| `throws(fn)` / `doesNotThrow(fn)` | Async error checks |
| **Numeric** | |
| `equalNum(a, b)` | Number equality |
| `greaterThan(a, b)` / `atLeast(a, b)` / `lessThan(a, b)` | Comparisons |
| `closeTo(a, b, eps?)` | Approximate equality |
| **String** | |
| `contains(str, sub)` / `notContains(str, sub)` | Substring checks |
| `matches(str, regex)` | Regex match |
| **Tool Results** | |
| `toolTextEquals(r, str)` | Tool text exact match |
| `toolTextContains(r, str)` | Tool text contains substring |
| `toolNumEquals(r, num)` | Parse tool text as number, compare |
| `toolNumCloseTo(r, num, eps?)` | Numeric approximate match |
| `toolJsonEquals(r, obj)` | Parse tool text as JSON, deep compare |
| `toolIsError(r)` / `toolIsOk(r)` | Error/success check |
| `toolHasContent(r, n?)` | Has N content items |
| `toolHasImage(r)` | Contains image content |
| **Resources** | |
| `resourceHasContent(r, n?)` | Has N resource contents |
| `resourceTextContains(r, str)` | Resource text contains |
| **Prompts** | |
| `promptHasMessages(r, n?)` | Has N messages |
| `promptTextContains(r, str)` | Prompt text contains |

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
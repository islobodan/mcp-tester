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
});
```

### Built-in Tools

| Tool | Description |
|------|-------------|
| `echo` | Echo back the input message |
| `add` | Add two numbers |
| `delay` | Delay for specified milliseconds |
| `error_tool` | Always throws an error |
| `counter` | Stateful counter: increment, get, reset |
| `items` | Stateful item list: add, list, remove, clear |
| `transform` | Transform text: upper, lower, reverse, length |

### Configurable Behavior

```typescript
// Simulate slow responses
const server = new MockMCPServer({ defaultDelay: 100 });

// Simulate random failures (30% chance)
const server = new MockMCPServer({ failureRate: 0.3, failureMessage: 'Network error' });

// Enable input schema validation
const server = new MockMCPServer({ validateSchemas: true });

// Update config at runtime
server.setConfig({ failureRate: 1.0 }); // always fail
```

### Custom Handlers

```typescript
// Custom tool handler
server.registerToolHandler('echo', (args) => [
  { type: 'text', text: `Custom: ${args.message}` },
]);

// Custom resource handler
server.registerResourceHandler('text://example', (uri) => [
  { uri, mimeType: 'text/plain', text: 'Custom content' },
]);

// Custom prompt handler
server.registerPromptHandler('greet', (args) => [
  { role: 'assistant', content: { type: 'text', text: `Hi ${args.name}!` } },
]);
```

### Stateful Testing

```typescript
// Counter tool
await server.handleToolCall('counter', { action: 'increment', by: 5 });
const result = await server.handleToolCall('counter', { action: 'get' });
// result.content[0].text === 'Counter: 5'

// Items tool
await server.handleToolCall('items', { action: 'add', value: 'apple' });
await server.handleToolCall('items', { action: 'add', value: 'banana' });
const list = await server.handleToolCall('items', { action: 'list' });
// list.content[0].text === '["apple","banana"]'
```

### Call History & Assertions

```typescript
await server.handleToolCall('echo', { message: 'a' });
await server.handleToolCall('echo', { message: 'b' });

server.getCallCount('echo'); // 2
server.getCallHistory();     // [{ tool: 'echo', args: {...}, timestamp: ... }, ...]
```

### Dynamic Registration

```typescript
// Add new tools/resources/prompts at runtime
server.addTool({ name: 'myTool', description: '...', inputSchema: { ... } });
server.addResource({ uri: 'custom://data', name: 'Data', description: '...', mimeType: 'text/plain' });
server.addPrompt({ name: 'myPrompt', description: '...', arguments: [] });

// Remove them
server.removeTool('echo');
server.removeResource('text://example');
server.removePrompt('greet');

// Reset all stateful data
server.resetState();
```
**Built-in mock resources:** `text://example`, `config://settings`
**Built-in mock prompts:** `greet`, `summarize`

## Test Coverage

```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

Coverage thresholds are configured in `jest.config.js` with per-file floors to catch regressions. Run `npm run test:coverage` to see the full breakdown by file.

| File | Stmts | Branch | Func | Lines |
|------|-------|--------|------|-------|
| Global | 67% | 61% | 60% | 67% |
| `assert.ts` | 96% | 87% | 100% | 96% |
| `matchers.ts` | 68% | 28% | 42% | 64% |
| `MCPClient.ts` | 68% | 54% | 75% | 68% |
| `logger.ts` | 84% | 82% | 94% | 83% |
| `masking.ts` | 100% | 88% | 100% | 100% |
| `errors.ts` | 100% | 100% | 100% | 100% |
| `env.ts` | 80% | 100% | 60% | 87% |

If coverage drops below these thresholds, the test command will exit with an error. PRs automatically receive a coverage comment via GitHub Actions (see [CI/CD Integration](./cicd.md)).

## Test Reports

Every test run auto-generates an HTML report with collapsible test trees, timing, and failure details:

```bash
npm test                         # generates reports/test-report.html
open reports/test-report.html    # macOS
```

The report is generated by `jest-html-reporters` (configured in `jest.config.js`). CI uploads reports as downloadable artifacts with 14-day retention.

## Property-Based Testing

Property-based tests use [fast-check](https://github.com/dubzzz/fast-check) to generate random inputs for pure utility functions. 73 tests across 3 modules:

| Module | Tests | What's tested |
|--------|-------|---------------|
| `validation.ts` | 44 | Reject/accept all input types, error code invariants |
| `masking.ts` | 17 | Idempotency, completeness, secret detection, length bounds |
| `generate-tests.ts` | 12 | No-throw on any schema, JSON serializability, priority order |

Property tests run with 25 iterations per property (configured via `fc.configureGlobal({ numRuns: 25 })`). They're fast (~1s for all 73 tests) and integrated into the normal test suite — no separate command needed.

## TypeScript Type Generation

Generate typed `.d.ts` declarations from your server's tool schemas for type-safe testing:

```bash
npx @slbdn/mcp-tester generate-types node ./server.js -o server.d.ts
```

Then use the types in your tests:

```typescript
import type { ToolArgsMap, ToolName } from './server.d.ts';

it('should add numbers correctly', async () => {
  const result = await client.callTool({
    name: 'add',
    arguments: { a: 3, b: 4 } as ToolArgsMap['add'], // ← type-checked!
  });
  expect(result).toReturnText('7');
});
```

See [Advanced Usage](./advanced.md#typescript-type-generation) for full documentation.

## Server Health Checks

Use health checks to ensure your server is alive during long test suites:

```typescript
const health = await client.isHealthy();
expect(health.healthy).toBe(true);
expect(health.latencyMs).toBeLessThan(1000);
expect(health.pid).not.toBeNull();
```

For long-running test suites, use periodic monitoring to fail fast when the server crashes:

```typescript
describe('Long test suite', () => {
  beforeAll(() => {
    client.startHealthMonitor({
      interval: 5000,
      onUnhealthy: (status) => {
        throw new Error(`Server died: ${status.message}`);
      },
    });
  });

  afterAll(() => client.stopHealthMonitor());
});
```

See [Advanced Usage](./advanced.md#server-health-checks) for full documentation.
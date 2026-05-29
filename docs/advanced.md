# Advanced Usage

Advanced patterns and features of MCP Tester.

## Concurrent Operations

Run multiple tool calls in parallel:

```typescript
const results = await Promise.all([
  client.callTool({ name: 'tool1', arguments: {} }),
  client.callTool({ name: 'tool2', arguments: {} }),
  client.callTool({ name: 'tool3', arguments: {} }),
]);

results.forEach((result, index) => {
  console.log(`Tool ${index + 1}:`, result.content[0]?.text);
});
```

## Timeout Handling

Customize timeouts at two levels:

**Global timeout** — applies to all requests:

```typescript
const client = new MCPClient({ timeout: 60000 });
```

**Per-call timeout** — overrides the global default:

```typescript
const result = await client.callTool({
  name: 'slow-operation',
  arguments: { duration: 5000 },
  timeout: 10000,
});
```

## Retry Logic

Configure automatic retries with exponential backoff:

```typescript
const client = new MCPClient({
  retries: 3,
  retryDelay: 1000, // base delay in ms
});
```

Per-call override:

```typescript
await client.callTool({
  name: 'flaky-tool',
  arguments: {},
  retries: 5,
});
```

Retry behavior:
- Exponential backoff: `delay * backoffMultiplier^(attempt - 1)`
- Default multiplier: 2
- Max delay cap: 10,000ms
- Retries only on thrown errors (not on successful responses with error content)

## Environment Variables

Pass environment variables to the MCP server process:

```typescript
await client.start({
  command: 'node',
  args: ['./server.js'],
  env: {
    NODE_ENV: 'test',
    API_ENDPOINT: process.env.API_ENDPOINT || 'http://localhost:3000',
    LOG_LEVEL: 'debug',
  },
});
```

`undefined` values are automatically filtered out, so conditional env vars work cleanly:

```typescript
env: {
  NODE_ENV: 'production',
  API_KEY: process.env.API_KEY, // won't be passed if undefined
}
```

## Notification Handling

Monitor server-initiated notifications:

```typescript
client.setNotificationHandlers({
  onLoggingMessage: (level, data) => {
    console.log(`[${level}] ${data}`);
  },
  onResourceListChanged: async () => {
    console.log('Resources changed, refreshing...');
    const resources = await client.listResources();
    console.log(`Now have ${resources.length} resources`);
  },
});
```

## Elicitation Handling

Respond to server requests for user input:

```typescript
await client.setElicitationHandler(async (request) => {
  console.log('Elicitation request:', request.params.mode);

  if (request.params.mode === 'form') {
    return {
      action: 'accept',
      content: {
        username: 'test-user',
        email: 'test@example.com',
      },
    };
  }

  return { action: 'decline' };
});
```

Handler return values:
- `action: 'accept'` — provide `content` with the collected input
- `action: 'decline'` — user declined the request
- `action: 'cancel'` — user cancelled the operation

## Logging

Configure logging at construction or dynamically:

```typescript
const client = new MCPClient({
  logLevel: 'debug', // 'debug' | 'info' | 'warn' | 'error' | 'none'
});

// Change at runtime
client.setLogLevel('warn');
```

Enable protocol-level logging to see raw JSON messages:

```typescript
const client = new MCPClient({
  enableProtocolLogging: true,
  logLevel: 'debug',
});
```

All log output goes to stderr so it doesn't interfere with stdout.

## Mock Server for Unit Testing

Use the in-memory mock server for tests that don't need a real server process:

```typescript
import { MockMCPServer } from './fixtures/mock-server.js';

describe('My Feature', () => {
  let mockServer: MockMCPServer;

  beforeEach(() => {
    mockServer = new MockMCPServer();
  });

  it('should handle tool call', async () => {
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

### Built-in Resources: `text://example`, `config://settings`
### Built-in Prompts: `greet`, `summarize`

### Testing Retry Logic

```typescript
const server = new MockMCPServer({ failureRate: 0.5 });
// 50% of tool calls will throw randomly
// Great for testing retry logic
```

### Testing with Delays

```typescript
const server = new MockMCPServer({ defaultDelay: 100 });
// All tool calls take ≥100ms — test timeout handling
```

### Input Validation Testing

```typescript
const server = new MockMCPServer({ validateSchemas: true });
await expect(
  server.handleToolCall('echo', {})
).rejects.toThrow('Missing required field');
```

### Stateful Testing

```typescript
await server.handleToolCall('counter', { action: 'increment', by: 5 });
await server.handleToolCall('counter', { action: 'increment', by: 3 });
const result = await server.handleToolCall('counter', { action: 'get' });
// result.content[0].text === 'Counter: 8'

server.resetState(); // clears counters, items, call history
```

### Custom Handlers

```typescript
server.registerToolHandler('echo', (args) => [
  { type: 'text', text: `Override: ${args.message}` },
]);
server.registerResourceHandler('text://example', (uri) => [
  { uri, mimeType: 'text/plain', text: 'Custom content' },
]);
server.registerPromptHandler('greet', (args) => [
  { role: 'assistant', content: { type: 'text', text: `Hi ${args.name}!` } },
]);
```

### Call History Assertions

```typescript
await server.handleToolCall('echo', { message: 'test' });
server.getCallCount('echo');    // 1
server.getCallHistory()[0].args; // { message: 'test' }
```

See [Testing Guide](./testing.md#mock-server) for the full mock server API reference.

## TypeScript Type Generation

Generate typed `.d.ts` declarations from any MCP server's tool schemas:

```bash
npx mcp-tester generate-types node ./server.js -o server.d.ts
```

Or use the API:

```typescript
import { generateTypes } from '@slbdn/mcp-tester';
import { writeFileSync } from 'fs';

const types = await generateTypes({
  command: 'node',
  args: ['./server.js'],
});

writeFileSync('server.d.ts', types);
```

### Generated Output

```typescript
/** Echo back the input */
export interface EchoArgs {
  /** Message to echo */
  message: string;
}

/** Add two numbers */
export interface AddArgs {
  a: number;
  b: number;
}

/** Union of all tool names */
export type ToolName = 'echo' | 'add' | 'delay' | 'error_tool';

/** Look up the argument type for a tool by name */
export interface ToolArgsMap {
  'echo': EchoArgs;
  'add': AddArgs;
}

/** Discriminated union for typed callTool() */
export type ToolCall =
  | { name: 'echo'; arguments: EchoArgs }
  | { name: 'add'; arguments: AddArgs };
```

### Using Generated Types

```typescript
import type { ToolArgsMap, ToolName } from './server.d.ts';

// Type-safe arguments
const result = await client.callTool({
  name: 'add',
  arguments: { a: 1, b: 2 } as ToolArgsMap['add'],
});
```

### Supported JSON Schema Features

| Feature | TypeScript Output |
|---------|------------------|
| `{ type: 'string' }` | `string` |
| `{ type: 'number' }` | `number` |
| `{ type: 'boolean' }` | `boolean` |
| `{ enum: ['a', 'b'] }` | `'a' \| 'b'` |
| `{ const: 'fixed' }` | `'fixed'` |
| `{ type: 'array', items: ... }` | `T[]` or `Array<T>` |
| `{ type: 'object', properties: ... }` | `{ prop: Type }` |
| `{ oneOf: [...] }` | Union type |
| `{ anyOf: [...] }` | Union type |
| `{ allOf: [...] }` | Intersection type |
| `{ $ref: '#/definitions/X' }` | `X` |
| Optional fields (not in `required`) | `field?: Type` |
| `description` | JSDoc comments |

## Performance Benchmarks

Run the benchmark suite to measure MCP Tester's performance characteristics:

```bash
npm run benchmark
```

This runs 19 benchmarks against the mock server (50 runs each, 3 warmup), measuring:

| Category | Benchmarks |
|----------|------------|
| **Connection** | Reconnect, disconnect |
| **Tool calls** | Echo, add, delay (10ms simulated) |
| **Sequential** | 5 and 10 tools in a row |
| **Parallel** | 5, 10, and 20 tools concurrently |
| **Payloads** | 10KB, 100KB, 1MB echo payloads |
| **Metadata** | List tools, resources, prompts; get prompt with args |
| **Lifecycle** | Full start → list → call → stop patterns |

### Reference Numbers (Node.js 24, Apple Silicon)

| Operation | Mean Latency | Throughput |
|----------|-------------|------------|
| Single tool call (echo) | **0.19 ms** | ~5,130 ops/s |
| Add tool (numbers) | **0.19 ms** | ~5,360 ops/s |
| 10 parallel tool calls | **0.55 ms total** | ~18,200 ops/s |
| 20 parallel tool calls | **0.86 ms total** | ~23,300 ops/s |
| List tools / resources / prompts | **0.15 ms** | ~6,700 ops/s |
| 1MB payload echo | **7.79 ms** | ~1,080 Mbps |
| Server reconnect | **165 ms** | ~6 ops/s |
| Full lifecycle (start+call+stop) | **167 ms** | ~6 ops/s |

### Key Takeaways

- **Parallelization wins** — 10 parallel calls take the same time as 1 (~0.5ms total), giving ~18x throughput vs sequential
- **Connection overhead dominates single-call cost** — once connected, tool calls are sub-millisecond
- **Payload size has minimal impact** — going from 10KB to 1MB adds only ~7ms of overhead
- **Metadata listings are cheap** — listing tools, resources, or prompts costs ~0.15ms
- **The stdio transport is fast** — most latency comes from process spawn, not the protocol itself

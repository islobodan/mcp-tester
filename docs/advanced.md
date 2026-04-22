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

  it('should add custom tools', () => {
    mockServer.addTool({
      name: 'custom',
      description: 'Custom tool',
      inputSchema: { type: 'object', properties: {} },
    });

    const result = await mockServer.handleToolCall('custom', {});
    // ...
  });
});
```

**Built-in mock tools:** `echo`, `add`, `delay`, `error_tool`
**Built-in mock resources:** `text://example`, `config://settings`
**Built-in mock prompts:** `greet`, `summarize`

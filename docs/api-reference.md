# API Reference

Complete API documentation for `MCPClient` and related types.

## MCPClient

The main class for interacting with MCP servers.

### Constructor

```typescript
new MCPClient(options?: MCPClientOptions)
```

**Parameters:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | `string` | `'mcp-test-client'` | Client identifier sent to the server |
| `version` | `string` | `'1.0.0'` | Client version sent to the server |
| `timeout` | `number` | `30000` | Default request timeout (ms) |
| `logLevel` | `LogLevel` | `'info'` | Log level: `debug`, `info`, `warn`, `error`, `none` |
| `enableProtocolLogging` | `boolean` | `false` | Log raw JSON protocol messages |
| `retries` | `number` | `0` | Number of retry attempts for failed requests |
| `retryDelay` | `number` | `1000` | Base delay (ms) between retries |
| `startupDelay` | `number` | `500` | Delay after server start (ms) |

**Example:**

```typescript
const client = new MCPClient({
  name: 'production-test-client',
  version: '2.1.0',
  timeout: 60000,
  logLevel: 'debug',
  retries: 3,
  retryDelay: 1000,
});
```

---

### `start(config: MCPServerConfig): Promise<void>`

Start the client and connect to an MCP server via stdio.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `config.command` | `string` | ✅ | Command to execute (e.g., `'node'`, `'python3'`) |
| `config.args` | `string[]` | | Arguments to pass to the command |
| `config.env` | `Record<string, string \| undefined>` | | Environment variables for the server process |
| `config.startupDelay` | `number` | | Override startup delay (ms) |

**Throws:**
- `MCPAlreadyStartedError` — if the client is already connected
- `MCPConnectionError` — if the server fails to start

```typescript
await client.start({
  command: 'node',
  args: ['./server.js', '--production'],
  env: {
    NODE_ENV: 'production',
    API_KEY: process.env.API_KEY,
  },
});
```

---

### `stop(): Promise<void>`

Stop the client and disconnect. Safe to call multiple times.

```typescript
await client.stop();
```

---

### `isConnected(): boolean`

Check if the client is connected.

```typescript
if (client.isConnected()) {
  console.log('Client is active');
}
```

---

### `listTools(): Promise<Tool[]>`

List all available tools from the server.

**Returns:** Array of `Tool` objects, each with:
- `name` — unique identifier
- `description` — human-readable description
- `inputSchema` — JSON Schema for parameters

**Throws:** `MCPNotStartedError` if client not started, `MCPServerError` on failure

```typescript
const tools = await client.listTools();
tools.forEach(tool => {
  console.log(`- ${tool.name}: ${tool.description}`);
});
```

---

### `callTool(options: ToolCallOptions): Promise<CallToolResult>`

Call a tool on the server.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `options.name` | `string` | ✅ | Tool name |
| `options.arguments` | `Record<string, unknown>` | | Tool arguments |
| `options.timeout` | `number` | | Override default timeout (ms) |
| `options.retries` | `number` | | Override default retry count |

**Returns:** `CallToolResult` with a `content` array of text/image items

**Throws:** `MCPNotStartedError`, `MCPTimeoutError`, `MCPServerError`

```typescript
const result = await client.callTool({
  name: 'calculator-add',
  arguments: { a: 5, b: 3 },
  timeout: 10000,
});
console.log('Result:', result.content[0].text);
```

---

### `listResources(): Promise<Resource[]>`

List all available resources.

**Returns:** Array of `Resource` objects with `uri`, `name`, `description`, `mimeType`

```typescript
const resources = await client.listResources();
resources.forEach(r => console.log(`- ${r.uri}: ${r.mimeType}`));
```

---

### `readResource(uri: string): Promise<ReadResourceResult>`

Read a resource by URI.

```typescript
const result = await client.readResource('config://settings');
console.log('Settings:', result.contents[0].text);
```

---

### `listPrompts(): Promise<Prompt[]>`

List all available prompts.

**Returns:** Array of `Prompt` objects with `name`, `description`, `arguments`

```typescript
const prompts = await client.listPrompts();
prompts.forEach(p => console.log(`- ${p.name}: ${p.description}`));
```

---

### `getPrompt(name: string, args?: Record<string, string>): Promise<GetPromptResult>`

Get a prompt template with optional argument values.

```typescript
const result = await client.getPrompt('greet', { name: 'Alice' });
console.log('Prompt:', result.messages[0].content.text);
```

---

### `requestSampling(request: CreateMessageRequestParams): Promise<CreateMessageResult>`

Request LLM sampling from the server.

```typescript
const result = await client.requestSampling({
  messages: [
    {
      role: 'user',
      content: { type: 'text', text: 'Explain quantum computing' },
    },
  ],
  maxTokens: 500,
});
console.log(result.content.text);
```

---

### `setElicitationHandler(handler): Promise<void>`

Configure a handler for server elicitation requests (user input).

```typescript
await client.setElicitationHandler(async (request) => {
  if (request.params.mode === 'form') {
    return {
      action: 'accept',
      content: { userInput: 'User provided data' },
    };
  }
  return { action: 'decline' };
});
```

**Handler return values:**
- `action`: `'accept' | 'decline' | 'cancel'`
- `content` (optional): collected input data

---

### `setNotificationHandlers(handlers: NotificationHandler): void`

Configure handlers for server-initiated notifications.

```typescript
client.setNotificationHandlers({
  onLoggingMessage: (level, data) => {
    console.log(`[${level}] ${data}`);
  },
  onResourceListChanged: () => {
    console.log('Resources updated, refreshing...');
  },
});
```

---

### `setLogLevel(level: LogLevel): void`

Change the log level at runtime.

```typescript
client.setLogLevel('debug');
```

---

## Error Classes

All errors extend `MCPClientError` and include a `code` property.

| Error | Code | When |
|-------|------|------|
| `MCPClientError` | `MCP_CLIENT_ERROR` | Base error class |
| `MCPTimeoutError` | `MCP_TIMEOUT_ERROR` | Request exceeds timeout (has `.timeout` property) |
| `MCPConnectionError` | `MCP_CONNECTION_ERROR` | Server fails to start or connect |
| `MCPNotStartedError` | `MCP_NOT_STARTED` | Method called before `start()` |
| `MCPAlreadyStartedError` | `MCP_ALREADY_STARTED` | `start()` called on running client |
| `MCPServerError` | `MCP_SERVER_ERROR` | Server returns an error response |

**Usage:**

```typescript
import {
  MCPClientError,
  MCPTimeoutError,
  MCPConnectionError,
  MCPServerError,
} from '@slbdn/mcp-tester';

try {
  await client.callTool({ name: 'tool', arguments: {} });
} catch (error) {
  if (error instanceof MCPTimeoutError) {
    console.error(`Timeout after ${error.timeout}ms`);
  } else if (error instanceof MCPConnectionError) {
    console.error('Connection failed');
  } else if (error instanceof MCPServerError) {
    console.error('Server error:', error.message);
  }
}
```

---

## Assertion Module

Framework-agnostic assertions that throw `AssertionError` on failure. Works with any test runner.

```typescript
import { assert, AssertionError } from '@slbdn/mcp-tester';

const result = await client.callTool({ name: 'echo', arguments: { message: 'hello' } });
assert.toolTextContains(result, 'hello');
assert.toolNumEquals(result, 42);
assert.equal(tools.length, 4);
```

Full list in the [Testing Guide](./testing.md#assertion-module-framework-agnostic).

---

## Custom Matchers

Jest and Vitest matchers for MCP-specific assertions.

```typescript
import { setupJestMatchers, setupVitestMatchers } from '@slbdn/mcp-tester';

// Jest
import { beforeAll } from '@jest/globals';
beforeAll(() => setupJestMatchers());

// Vitest
import { beforeAll } from 'vitest';
beforeAll(() => setupVitestMatchers());
```

Full list in the [Testing Guide](./testing.md#all-matchers).

---

## Types

### MCPServerConfig

```typescript
interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string | undefined>;
  startupDelay?: number;
}
```

### MCPClientOptions

```typescript
interface MCPClientOptions {
  name?: string;
  version?: string;
  timeout?: number;
  logLevel?: LogLevel;
  enableProtocolLogging?: boolean;
  retries?: number;
  retryDelay?: number;
  startupDelay?: number;
}
```

### ToolCallOptions

```typescript
interface ToolCallOptions {
  name: string;
  arguments?: Record<string, unknown>;
  timeout?: number;
  retries?: number;
}
```

### NotificationHandler

```typescript
interface NotificationHandler {
  onLoggingMessage?: (level: string, data: string) => void;
  onResourceListChanged?: () => void;
}
```

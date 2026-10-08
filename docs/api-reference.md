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
| `startupDelay` | `number` | `0` | Delay after server start (ms). Opt-in; `0` disables |

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

### `start(config: ServerConfig): Promise<void>`

Start the client and connect to an MCP server. Supports three transport types:

#### Stdio (default)

Spawns a local server process and communicates via stdin/stdout.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `config.transport` | `'stdio'` | | Omit for default (stdio) |
| `config.command` | `string` | ✅ | Command to execute (e.g., `'node'`) |
| `config.args` | `string[]` | | Arguments to pass to the command |
| `config.env` | `Record<string, string \| undefined>` | | Environment variables |
| `config.startupDelay` | `number` | | Per-connection startup delay (ms), overrides the client option |

```typescript
await client.start({
  command: 'node',
  args: ['./server.js'],
});
```

#### Streamable HTTP

Connects to a remote server via the MCP Streamable HTTP transport (POST + SSE GET).

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `config.transport` | `'http'` | ✅ | Must be `'http'` |
| `config.url` | `string` | ✅ | Server endpoint URL |
| `config.headers` | `Record<string, string>` | | Custom HTTP headers |
| `config.sessionId` | `string` | | Resume existing session |

```typescript
await client.start({
  transport: 'http',
  url: 'https://api.example.com/mcp',
  headers: { Authorization: 'Bearer token' },
});
```

#### SSE (legacy)

Connects to a server using the deprecated SSE transport.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `config.transport` | `'sse'` | ✅ | Must be `'sse'` |
| `config.url` | `string` | ✅ | SSE endpoint URL |
| `config.headers` | `Record<string, string>` | | Custom HTTP headers |

```typescript
await client.start({
  transport: 'sse',
  url: 'http://localhost:3000/sse',
});
```

**Throws:**
- `MCPAlreadyStartedError` — if the client is already connected
- `MCPConnectionError` — if the connection fails

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

### `getTransportType(): TransportType | null`

Get the active transport type. Returns `'stdio'`, `'http'`, `'sse'`, or `null`.

```typescript
const type = client.getTransportType();
if (type === 'http') {
  console.log('Connected via HTTP');
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

## Secret Masking

All log output is automatically masked to prevent accidental secret leakage. API keys, tokens, passwords, and other sensitive values are replaced with `***` or `sk-ab...789`-style masks.

```typescript
import { maskSecrets, maskValue, addSecretPattern } from '@slbdn/mcp-tester';

// Built-in patterns are applied automatically
maskSecrets('API key: sk-proj-abcdefghijklmnopqrstuvwxyz');
// → 'API key: sk-pr...xyz'

// Mask environment variables with sensitive keys
maskSecrets('PASSWORD=mysecretpassword123');
// → 'PASSWORD=***'
maskSecrets('OPENAI_API_KEY=sk-abc...');
// → 'OPENAI_API_KEY=***'

// Add custom patterns
addSecretPattern(/my-org-key-[a-zA-Z0-9]{20,}/g, 'MyOrg key');
```

### Built-in Patterns

| Pattern | Description |
|---------|-------------|
| `sk-proj-...`, `sk-ant-...` | OpenAI/Anthropic API keys |
| `sk-...` (20+ chars) | Generic API keys |
| `AKIA...` | AWS access keys |
| `Bearer ...` | Bearer tokens |
| `eyJ...` | JWT tokens |
| 40+ hex chars | Long hex tokens |
| `:password@host` | URL credentials |
| `password=...`, `token=...` | Key-value secrets |

### Sensitive Environment Variables

Values for these keys are automatically masked: `API_KEY`, `SECRET`, `PASSWORD`, `TOKEN`, `DATABASE_URL`, `AWS_SECRET_ACCESS_KEY`, `OPENAI_API_KEY`, and 30+ more.

### Exports

| Function | Description |
|----------|-------------|
| `maskSecrets(input)` | Mask all secrets in a string |
| `maskValue(value, chars?)` | Mask a single value (show first/last `chars`) |
| `addSecretPattern(regex, name)` | Add a custom pattern |
| `resetSecretPatterns()` | Reset to built-in defaults |
| `getSecretPatterns()` | Get active pattern list |
| `getSensitiveEnvKeys()` | Get set of sensitive env var names |

### ConsoleLogger Integration

`ConsoleLogger` automatically masks all log output. To disable:

```typescript
const client = new MCPClient({
  logLevel: 'debug',
  // maskSecrets is true by default
  // maskSecrets: false,  // disable masking (not recommended)
});
```

---

## Error Classes

All errors extend `MCPClientError` and include a `code` property. Errors provide
contextual information and actionable suggestions for debugging.

| Error | Code | Properties | When |
|-------|------|------------|------|
| `MCPClientError` | `MCP_CLIENT_ERROR` | `code` | Base error class |
| `MCPTimeoutError` | `MCP_TIMEOUT_ERROR` | `code`, `.timeout`, `.operation`, `.suggestions` | Request exceeds timeout |
| `MCPConnectionError` | `MCP_CONNECTION_ERROR` | `code`, `.command`, `.suggestions` | Server fails to start or connect |
| `MCPNotStartedError` | `MCP_NOT_STARTED` | `code`, `.method` | Method called before `start()` |
| `MCPAlreadyStartedError` | `MCP_ALREADY_STARTED` | `code` | `start()` called on running client |
| `MCPServerError` | `MCP_SERVER_ERROR` | `code`, `.operation`, `.serverCode` | Server returns an error response |

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
    console.error(`Timeout on ${error.operation} after ${error.timeout}ms`);
    console.error('Suggestions:', error.suggestions);
  } else if (error instanceof MCPConnectionError) {
    console.error(`Connection failed, command: ${error.command}`);
    console.error('Suggestions:', error.suggestions);
  } else if (error instanceof MCPServerError) {
    console.error(`Server error in ${error.operation}: ${error.message}`);
    if (error.serverCode) console.error(`Server code: ${error.serverCode}`);
  } else if (error instanceof MCPClientError) {
    console.error('Client error:', error.message);
  }
}
```

---

## Assertion Module

Framework-agnostic assertions that throw `AssertionError` on failure. Works with any test runner — Jest, Vitest, Node.js `assert`, or custom harnesses.

```typescript
import { assert, AssertionError } from '@slbdn/mcp-tester';

const result = await client.callTool({ name: 'echo', arguments: { message: 'hello' } });
assert.toolTextContains(result, 'hello');
assert.equal(tools.length, 4);
```

### Value Assertions

| Assertion | Description |
|-----------|------------|
| `equal(a, b)` | Strict equality (`===`) |
| `notEqual(a, b)` | Strict inequality (`!==`) |
| `deepEqual(a, b)` | JSON deep equality |
| `ok(val)` | Value is truthy |
| `notOk(val)` | Value is falsy |
| `throws(fn)` | Async function throws (returns the error) |
| `doesNotThrow(fn)` | Async function does not throw |

### Numeric Assertions

| Assertion | Description |
|-----------|------------|
| `equalNum(a, b)` | Number equality |
| `greaterThan(a, b)` | `a > b` |
| `atLeast(a, b)` | `a >= b` |
| `lessThan(a, b)` | `a < b` |
| `closeTo(a, b, eps?)` | `|a - b| <= eps` (default epsilon 0.001) |

### String Assertions

| Assertion | Description |
|-----------|------------|
| `contains(str, sub)` | String contains substring |
| `notContains(str, sub)` | String does not contain substring |
| `matches(str, regex)` | String matches regex |

### Tool Result Assertions

| Assertion | Description |
|-----------|------------|
| `toolTextEquals(r, str)` | Tool text equals string exactly |
| `toolTextContains(r, str)` | Tool text contains substring |
| `toolNumEquals(r, num)` | Parse tool text as number, exact compare |
| `toolNumCloseTo(r, num, eps?)` | Parse tool text as number, approximate compare |
| `toolJsonEquals(r, obj)` | Parse tool text as JSON, deep compare |
| `toolIsError(r)` | Tool result `isError === true` or text contains "error" |
| `toolIsOk(r)` | Tool result is successful (not error) |
| `toolHasContent(r, n?)` | Tool result has at least `n` content items (default 1) |
| `toolHasImage(r)` | Tool result contains an image content item |

### Resource Result Assertions

| Assertion | Description |
|-----------|------------|
| `resourceHasContent(r, n?)` | Resource result has at least `n` contents (default 1) |
| `resourceTextContains(r, str)` | First resource text contains substring |

### Prompt Result Assertions

| Assertion | Description |
|-----------|------------|
| `promptHasMessages(r, n?)` | Prompt result has at least `n` messages (default 1) |
| `promptTextContains(r, str)` | First prompt message text contains substring |

---

## Custom Matchers (Jest & Vitest)

Register all matchers with one call:

```typescript
// Jest
import { setupJestMatchers } from '@slbdn/mcp-tester';
beforeAll(() => setupJestMatchers());

// Vitest
import { setupVitestMatchers } from '@slbdn/mcp-tester';
import { beforeAll } from 'vitest';
/// <reference types="@slbdn/mcp-tester/vitest" />
beforeAll(() => setupVitestMatchers());
`` `

`setupCustomMatchers()` is available as a backward-compatible alias for `setupJestMatchers()`.

### Collection Matchers

Apply to arrays returned by `listTools()`, `listResources()`, `listPrompts()`.

| Matcher | Description |
|---------|-------------|
| `toHaveTool(name)` | Assert a tool exists by name |
| `toHaveToolWithSchema(name)` | Assert a tool has an `inputSchema` |
| `toHaveToolCount(n)` | Assert exact number of tools |
| `toHaveResource(uri)` | Assert a resource exists by URI |
| `toHaveResourceByName(name)` | Assert a resource exists by display name |
| `toHaveResourceCount(n)` | Assert exact number of resources |
| `toHavePrompt(name)` | Assert a prompt exists by name |
| `toHavePromptWithArgs(name)` | Assert a prompt has defined arguments |
| `toHavePromptCount(n)` | Assert exact number of prompts |

### Tool Result Matchers

Apply to `CallToolResult` returned by `callTool()`.

| Matcher | Description |
|---------|-------------|
| `toReturnText(expected?)` | Tool text equals string (or just has text if omitted) |
| `toReturnTextContaining(sub)` | Tool text contains substring |
| `toReturnError()` | Tool result is an error |
| `toReturnOk()` | Tool result is successful |
| `toReturnJson(obj)` | Parse tool text as JSON, deep compare |
| `toReturnContentCount(n)` | Tool has exactly `n` content items |
| `toReturnImage()` | Tool result contains an image |

### Resource Result Matchers

Apply to `ReadResourceResult` returned by `readResource()`.

| Matcher | Description |
|---------|-------------|
| `toReturnResourceText(expected?)` | Resource text equals string (or just has text) |
| `toReturnResourceTextContaining(sub)` | Resource text contains substring |

### Prompt Result Matchers

Apply to `GetPromptResult` returned by `getPrompt()`.

| Matcher | Description |
|---------|-------------|
| `toReturnPromptTextContaining(sub)` | First prompt message text contains substring |
| `toReturnPromptMessageCount(n)` | Prompt has exactly `n` messages |

All matchers support `.not` negation and work identically in Jest and Vitest.

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

---

## Server Health Checks

Detect zombie processes and monitor server health.

```typescript
import { MCPClient } from '@slbdn/mcp-tester';

const client = new MCPClient();
await client.start({ command: 'node', args: ['./server.js'] });

// One-time health check
const health = await client.isHealthy();
if (!health.healthy) {
  console.error(`Server unhealthy: ${health.message}`);
}
console.log(`PID: ${health.pid}, latency: ${health.latencyMs}ms`);
```

### Periodic Monitoring

```typescript
client.startHealthMonitor({
  interval: 3000,  // check every 3 seconds
  onUnhealthy: (status) => console.error('Server down:', status.message),
  onRecovery: (status) => console.log('Server recovered!'),
  onCheck: (status) => console.log(`Health: ${status.healthy} (${status.latencyMs}ms)`),
});

// Stop monitoring
client.stopHealthMonitor();
// Also stopped automatically by client.stop()
```

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `isHealthy()` | `Promise<HealthStatus>` | Check server health and responsiveness |
| `getLastHealthStatus()` | `HealthStatus \| null` | Get last check result (no new request) |
| `getServerPid()` | `number \| null` | Get server process PID |
| `startHealthMonitor(opts)` | `void` | Start periodic health monitoring |
| `stopHealthMonitor()` | `void` | Stop periodic monitoring |

### HealthStatus

```typescript
interface HealthStatus {
  healthy: boolean;       // Is the server responsive?
  checkedAt: number;     // Timestamp of the check
  latencyMs: number;     // Round-trip latency, or -1 if failed
  pid: number | null;    // Server process PID
  message: string;       // Human-readable status
}
```

### HealthMonitorOptions

```typescript
interface HealthMonitorOptions {
  interval?: number;                          // Check interval in ms (default 5000)
  onUnhealthy?: (status: HealthStatus) => void;  // Called when server goes down
  onRecovery?: (status: HealthStatus) => void;   // Called when server recovers
  onCheck?: (status: HealthStatus) => void;      // Called on every check
}
```

### Zombie Process Detection

Health checks detect dead server processes using `process.kill(pid, 0)` (signal 0 — existence check only). If the PID is no longer alive, `isHealthy()` returns `{ healthy: false, message: 'Server process (PID 12345) is no longer running' }`.

---

## Test Generation (Edge Cases & AI)

Beyond `generateTests` / `generateTestsFromClient`, the generator can derive
boundary and invalid-input test cases from each tool's JSON Schema — either
deterministically (`mode: 'edge'`) or augmented by an LLM (`mode: 'ai'`).
See [AI-Assisted Test Generation](./ai-generation.md) for the CLI workflow.

### `GeneratedCase`

```typescript
interface GeneratedCase {
  tool: string;                                // tool name
  title: string;                               // human-readable test title
  args: Record<string, unknown>;               // arguments to send
  expectation: 'success' | 'error' | 'observe';
  rationale: string;                           // why this case exists
  source: `rule:${string}` | `ai:${string}`;   // provenance, e.g. 'rule:required'
}
```

### `suggestEdgeCasesForTools(tools)`

Derive deterministic edge cases from tool schemas (offline, no AI):

```typescript
import { suggestEdgeCasesForTools } from '@slbdn/mcp-tester';

const cases = suggestEdgeCasesForTools(tools);
// Rules: required, enum, min-length, max-length, bounds, type,
//        min-items, additional-properties
```

### `validateArgsAgainstSchema(args, schema)`

Shallow schema validation used as the AI gate. Returns `null` when acceptable,
otherwise a human-readable reason:

```typescript
import { validateArgsAgainstSchema } from '@slbdn/mcp-tester';

validateArgsAgainstSchema({}, echoTool.inputSchema);
// → 'missing required property "message"'
```

### `mergeAndValidateCases(groups, schemas)`

Merge case groups (rules + AI), dedupe, drop hallucinated cases:

```typescript
import { mergeAndValidateCases, suggestEdgeCasesForTools } from '@slbdn/mcp-tester';

const { cases, rejected } = mergeAndValidateCases(
  [suggestEdgeCasesForTools(tools), aiCases],
  new Map(tools.map((t) => [t.name, t]))
);
// rejected: Array<{ c: GeneratedCase; reason: string }>
```

Error-expectation cases skip schema validation by design (they intentionally
violate the schema).

### `OpenAICompatProvider`

AI case suggestions via any OpenAI-compatible `/chat/completions` endpoint:

```typescript
import { OpenAICompatProvider } from '@slbdn/mcp-tester';

const provider = new OpenAICompatProvider({
  baseUrl: 'http://localhost:11434/v1',  // default: https://api.openai.com/v1
  model: 'llama3',                       // default: gpt-4o-mini
  apiKey: undefined,                     // optional (localhost needs none)
  timeout: 60_000,                       // request timeout (ms)
  cacheDir: '.mcp-tester-cache',         // null disables caching
  // fetchImpl: myFetch,                 // injectable for tests
});

await provider.suggestCases({ serverLabel: 'my-server', tools });
// → GeneratedCase[] (source: 'ai:<model>')
```

`createProviderFromEnv()` builds a provider from `MCP_TESTER_AI_API_KEY`,
`MCP_TESTER_AI_BASE_URL`, and `MCP_TESTER_AI_MODEL`; a localhost base URL
counts as configured without a key.

### `generateTests` generation options

| Option | Type | Description |
|--------|------|-------------|
| `mode` | `'edge' \| 'ai'` | `undefined` = static (happy path only) |
| `provider` | `AIProvider` | Explicit provider (skips env lookup) |
| `ai` | `{ requireAi?: boolean }` | `requireAi` fails instead of falling back |
| `verify` | `boolean` | Dry-run cases against the live server; mismatches become `it.skip` |

---

Generate TypeScript type declarations from an MCP server's tool schemas.

```typescript
import { generateTypes } from '@slbdn/mcp-tester';

const types = await generateTypes({
  command: 'node',
  args: ['./server.js'],
});
```

### Parameters: `GenerateTypesOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `command` | `string` | **required** | Command to run the MCP server |
| `args` | `string[]` | `[]` | Arguments for the server command |
| `timeout` | `number` | `30000` | Connection timeout (ms) |
| `includeResources` | `boolean` | `true` | Include resource URI types |
| `includePrompts` | `boolean` | `true` | Include prompt argument types |
| `moduleName` | `string` | `'@slbdn/mcp-tester'` | Module name for import hints |

**Returns:** `Promise<string>` — the generated `.d.ts` file content

### Generated Types

| Type | Description |
|------|-------------|
| `{ToolName}Args` | Typed interface per tool's input schema |
| `ToolName` | Union of all tool names |
| `ToolArgsMap` | Lookup map: `ToolArgsMap['add']` → `AddArgs` |
| `ToolCall` | Discriminated union for typed `callTool()` |
| `ResourceUri` | Union of all resource URIs |
| `{PromptName}Args` | Typed interface per prompt's arguments |
| `PromptName` | Union of all prompt names |
| `PromptArgsMap` | Lookup map for prompt arguments |
| `PromptCall` | Discriminated union for typed `getPrompt()` |
| `ServerCapabilities` | Overview interface with typed arrays |

### Schema Conversion Functions

These exported functions handle JSON Schema → TypeScript conversion:

| Function | Description |
|----------|-------------|
| `schemaToType(schema, indent?)` | Convert a JSON Schema to a TypeScript type string |
| `toTypeName(name)` | Sanitize a tool/prompt name into a valid TypeScript identifier |
| `escapePropertyName(name)` | Escape a property name for TypeScript (quote if needed) |

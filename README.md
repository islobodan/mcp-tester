# MCP Tester

> **This is not your grandpa's MCP Inspector.**
> This is a real testing framework. No GUI, no clicking, no manual verification.
> Write tests, run them in CI, ship with confidence. 🚀

[![npm version](https://img.shields.io/npm/v/@slbdn/mcp-tester)](https://www.npmjs.com/package/@slbdn/mcp-tester)
[![npm downloads](https://img.shields.io/npm/dm/@slbdn/mcp-tester)](https://www.npmjs.com/package/@slbdn/mcp-tester)
[![Node.js Version](https://img.shields.io/node/v/@slbdn/mcp-tester)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Test Status](https://img.shields.io/badge/tests-111_passing-brightgreen)](https://github.com/islobodan/mcp-tester/actions/workflows/test.yml)

A production-ready MCP (Model Context Protocol) client for **automated testing** of MCP servers with Jest.
No more manual clicking through inspectors — write real tests, run them in CI, break builds on regressions.

## Capabilities

| Category | What You Can Test |
|----------|-------------------|
| **Tools** | List, call with arguments, validate results, test error handling |
| **Resources** | List available resources, read by URI, validate content |
| **Prompts** | List templates, get with arguments, validate generated messages |
| **Sampling** | Request LLM sampling, validate model responses |
| **Elicitation** | Handle server-initiated user input requests |
| **Notifications** | React to resource changes, logging messages, tool list updates |
| **Error Handling** | Custom error classes for timeouts, connection failures, server errors |
| **Retries** | Exponential backoff with configurable attempts and delay |
| **CLI** | Smoke-test any server from the terminal in seconds |

## Why MCP Tester?

- **Full protocol support** — tools, resources, prompts, sampling, elicitation, notifications
- **Built on the official SDK** — `@modelcontextprotocol/sdk` v1.29.0
- **Works out of the box** — mock server included, 111 tests passing
- **CLI included** — test any server from the command line
- **TypeScript first** — strict types, ESM, full IntelliSense
- **Parallel execution** — fire multiple tool calls concurrently with `Promise.all` for blazing-fast test suites
- **Retry with backoff** — flaky servers? Configure retries so your CI stays green
- **In-memory mock server** — unit test your test logic without spawning real processes
- **Custom Jest matchers** — `toHaveTool()`, `toHaveResource()`, `toHavePrompt()` out of the box

## Install

```bash
npm install @slbdn/mcp-tester --save-dev
```

Requires **Node.js >= 18**. See [Node.js Compatibility](./docs/nodejs-compatibility.md) for details.

## Quick Start

### Connect and Use Tools

```typescript
import { MCPClient } from '@slbdn/mcp-tester';

const client = new MCPClient({
  name: 'my-test-client',
  version: '1.0.0',
});

// Connect to your MCP server
await client.start({
  command: 'node',
  args: ['./your-mcp-server.js'],
});

// List and call tools
const tools = await client.listTools();
const result = await client.callTool({
  name: 'your-tool',
  arguments: { input: 'test' },
});

await client.stop();
```

### Test with Jest

```typescript
import { MCPClient } from '@slbdn/mcp-tester';

describe('My MCP Server', () => {
  let client: MCPClient;

  beforeEach(async () => {
    client = new MCPClient();
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

  it('should call a tool', async () => {
    const result = await client.callTool({
      name: 'my-tool',
      arguments: { input: 'test' },
    });
    expect(result.content).toBeDefined();
  });
});
```

### Test from the Command Line

```bash
# Quick smoke test
npx @slbdn/mcp-tester test node ./server.js

# List tools (JSON output)
npx @slbdn/mcp-tester list-tools node ./server.js --json

# Call a tool
npx @slbdn/mcp-tester call-tool echo node ./server.js --params '{"message":"Hello"}'

# Short aliases: lt, ct, rr, gp
npx @slbdn/mcp-tester lt node ./server.js
```

See [CLI Reference](./docs/cli.md) for all commands and options.

## Speed Up Your Tests with Parallel Execution

MCP Tester is built for concurrency. Fire off multiple tool calls at once — no waiting in line:

```typescript
import { MCPClient } from '@slbdn/mcp-tester';

const client = new MCPClient();
await client.start({ command: 'node', args: ['./server.js'] });

// 🔥 Run all calls in parallel — 5x faster than sequential
const [tools, resources, prompts] = await Promise.all([
  client.listTools(),
  client.listResources(),
  client.listPrompts(),
]);

// Parallel tool calls? No problem.
const [echo, sum, env] = await Promise.all([
  client.callTool({ name: 'echo', arguments: { message: 'hello' } }),
  client.callTool({ name: 'get-sum', arguments: { a: 1, b: 2 } }),
  client.callTool({ name: 'get-env', arguments: {} }),
]);

await client.stop();
```

Works because each MCP call is independent — the client multiplexes requests over a single stdio connection.
No extra config needed. Just `Promise.all` and go.

## Core API

| Method | Returns | Description |
|--------|---------|-------------|
| `start(config)` | `Promise<void>` | Connect to an MCP server |
| `stop()` | `Promise<void>` | Disconnect and clean up |
| `isConnected()` | `boolean` | Check connection state |
| `listTools()` | `Promise<Tool[]>` | List available tools |
| `callTool(options)` | `Promise<CallToolResult>` | Call a tool with arguments |
| `listResources()` | `Promise<Resource[]>` | List available resources |
| `readResource(uri)` | `Promise<ReadResourceResult>` | Read a resource by URI |
| `listPrompts()` | `Promise<Prompt[]>` | List available prompts |
| `getPrompt(name, args?)` | `Promise<GetPromptResult>` | Get a prompt template |
| `requestSampling(request)` | `Promise<CreateMessageResult>` | Request LLM sampling |
| `setElicitationHandler(fn)` | `Promise<void>` | Handle server user-input requests |
| `setNotificationHandlers(handlers)` | `void` | Handle server notifications |

See [API Reference](./docs/api-reference.md) for full details including types, options, and error classes.

## Custom Jest Matchers

Built-in matchers so your assertions read like English:

```typescript
import { toHaveTool, toHaveResource, toHavePrompt } from '@slbdn/mcp-tester';

expect.extend({ toHaveTool, toHaveResource, toHavePrompt });

it('should have the tools we expect', async () => {
  const tools = await client.listTools();
  // @ts-expect-error - custom matcher
  expect(tools).toHaveTool('echo');
  // @ts-expect-error - custom matcher
  expect(tools).toHaveToolWithSchema('echo');
});

it('should have the right resources', async () => {
  const resources = await client.listResources();
  // @ts-expect-error - custom matcher
  expect(resources).toHaveResource('config://settings');
});

it('should have the prompts we need', async () => {
  const prompts = await client.listPrompts();
  // @ts-expect-error - custom matcher
  expect(prompts).toHavePrompt('greet');
});
```

| Matcher | Description |
|---------|-------------|
| `toHaveTool(name)` | Assert a tool exists by name |
| `toHaveToolWithSchema(name)` | Assert a tool exists and has an input schema |
| `toHaveResource(uri)` | Assert a resource exists by URI |
| `toHavePrompt(name)` | Assert a prompt exists by name |

See [Testing Guide](./docs/testing.md) for full testing patterns.

## Assertion Utilities

Not using Jest? Running tests with a custom `runTest()` harness? The built-in `assert` module throws descriptive errors on failure — works with any runner:

```typescript
import { MCPClient, assert } from '@slbdn/mcp-tester';

const client = new MCPClient();
await client.start({ command: 'node', args: ['./server.js'] });

await runTest("Get constant: c (speed of light)", async () => {
  const result = await client.callTool({
    name: "get_constant",
    arguments: { name: "c" },
  });
  assert.toolNumEquals(result, 299792458);
});

await runTest("Echo returns input", async () => {
  const result = await client.callTool({
    name: "echo",
    arguments: { message: "hello" },
  });
  assert.toolTextContains(result, "hello");
});
```

| Assertion | Description |
|-----------|-------------|
| `equal(a, b)` / `notEqual(a, b)` | Strict equality checks |
| `deepEqual(a, b)` | JSON deep equality |
| `ok(val)` / `notOk(val)` | Truthy / falsy |
| `throws(fn)` / `doesNotThrow(fn)` | Async error checks |
| `greaterThan(a, b)` / `lessThan(a, b)` / `closeTo(a, b, eps?)` | Numeric comparisons |
| `contains(str, sub)` / `matches(str, regex)` | String checks |
| `toolTextEquals(r, str)` | Tool text exact match |
| `toolTextContains(r, str)` | Tool text contains |
| `toolNumEquals(r, num)` | Parse tool text as number, compare |
| `toolNumCloseTo(r, num, eps?)` | Numeric approximate match |
| `toolJsonEquals(r, obj)` | Parse tool text as JSON, deep compare |
| `toolIsError(r)` / `toolIsOk(r)` | Error/success check |
| `toolHasImage(r)` | Check for image content |
| `resourceTextContains(r, str)` | Resource text contains |
| `promptTextContains(r, str)` | Prompt text contains |

## Documentation

| Doc | Description |
|-----|-------------|
| [API Reference](./docs/api-reference.md) | Full method docs, types, and error classes |
| [Testing Guide](./docs/testing.md) | Writing tests, matchers, mock server |
| [Examples](./docs/examples.md) | Practical code examples |
| [Advanced Usage](./docs/advanced.md) | Timeouts, retries, concurrency, notifications, logging |
| [CLI Reference](./docs/cli.md) | CLI commands, options, and output formats |
| [CI/CD Integration](./docs/cicd.md) | GitHub Actions, CircleCI, Jenkins |
| [Troubleshooting](./docs/troubleshooting.md) | Common issues and solutions |
| [Releases](./docs/releases.md) | Release process and commands |
| [Node.js Compatibility](./docs/nodejs-compatibility.md) | Version matrix and upgrade guide |
| [AGENTS.md](./AGENTS.md) | Guide for AI agents working with this codebase |

## Project Structure

```
mcp-tester/
├── src/
│   ├── client/MCPClient.ts      # Main client class
│   ├── cli/index.ts             # CLI tool
│   ├── assert.ts               # Assertion utilities
│   ├── matchers.ts             # Custom Jest matchers
│   ├── utils/
│   │   ├── errors.ts            # Error classes
│   │   ├── logger.ts            # Logging
│   │   └── env.ts               # Environment utilities
│   └── __tests__/               # 111 tests
│       ├── everything-server.test.ts  # Integration tests (server-everything)
│       ├── real-server.test.ts        # Integration tests (stdio transport)
│       ├── cli.test.ts                # CLI tool tests
│       └── fixtures/mock-server.ts    # In-memory mock server
├── examples/
│   ├── basic-test.ts            # Basic usage example
│   ├── full-test.ts             # Full capabilities example
│   ├── jest-matchers-example.ts # Jest matchers usage
│   ├── assert-example.ts        # Assert utilities usage
│   ├── everything-server-test.ts # Test against real MCP server
│   └── mock-server.js           # Standalone MCP server
└── docs/                        # Documentation
```

## Development

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript
npm test             # Run tests (111 tests)
npm run lint         # Lint code
npm run format       # Format with Prettier
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make changes and test (`npm run build && npm test`)
4. Format and lint (`npm run format && npm run lint`)
5. Open a Pull Request

## License

MIT — see [LICENSE](LICENSE) for details.

# MCP Tester

[![npm version](https://img.shields.io/npm/v/@slbdn/mcp-tester)](https://www.npmjs.com/package/@slbdn/mcp-tester)
[![npm downloads](https://img.shields.io/npm/dm/@slbdn/mcp-tester)](https://www.npmjs.com/package/@slbdn/mcp-tester)
[![Node.js Version](https://img.shields.io/node/v/@slbdn/mcp-tester)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Test Status](https://img.shields.io/badge/tests-115_passing-brightgreen)](https://github.com/islobodan/mcp-tester/actions/workflows/test.yml)

A minimal, production-ready MCP (Model Context Protocol) client for testing MCP servers with Jest.

## Why MCP Tester?

- **Full protocol support** — tools, resources, prompts, sampling, elicitation, notifications
- **Built on the official SDK** — `@modelcontextprotocol/sdk` v1.29.0
- **Works out of the box** — mock server included, 115 tests passing
- **CLI included** — test any server from the command line
- **TypeScript first** — strict types, ESM, full IntelliSense

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

## Documentation

| Doc | Description |
|-----|-------------|
| [API Reference](./docs/api-reference.md) | Full method docs, types, and error classes |
| [Testing Guide](./docs/testing.md) | Writing tests, helpers, custom matchers, mock server |
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
│   ├── utils/
│   │   ├── errors.ts            # Error classes
│   │   ├── logger.ts            # Logging
│   │   └── env.ts               # Environment utilities
│   └── __tests__/               # 115 tests
│       ├── everything-server.test.ts  # Integration tests (server-everything)
│       ├── real-server.test.ts        # Integration tests (stdio transport)
│       ├── cli.test.ts                # CLI tool tests
│       ├── fixtures/mock-server.ts    # In-memory mock server
│       ├── helpers.ts                 # Test utilities
│       └── matchers.ts                # Custom Jest matchers
├── examples/
│   ├── basic-test.ts            # Basic usage example
│   ├── full-test.ts             # Full capabilities example
│   ├── everything-server-test.ts # Test against real MCP server
│   └── mock-server.js           # Standalone MCP server
└── docs/                        # Documentation
```

## Development

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript
npm test             # Run tests (115 tests)
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

# MCP Tester

[![npm version](https://img.shields.io/npm/v/@slbdn/mcp-tester)](https://www.npmjs.com/package/@slbdn/mcp-tester)
[![npm downloads](https://img.shields.io/npm/dm/@slbdn/mcp-tester)](https://www.npmjs.com/package/@slbdn/mcp-tester)
[![Node.js Version](https://img.shields.io/node/v/@slbdn/mcp-tester)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Test Status](https://img.shields.io/badge/tests-passing-brightgreen)](https://github.com/islobodan/mcp-tester/actions/workflows/test.yml)

A minimal, production-ready MCP (Model Context Protocol) client implementation for CI/CD testing of MCP servers with Jest.

## 🎯 Purpose

MCP Tester provides a complete testing framework for MCP server implementations, enabling automated testing of tools, resources, prompts, and advanced capabilities like sampling and elicitation. It's designed specifically for CI/CD pipelines but also works great for local development and manual testing.

## ✨ Features

- **Full MCP Protocol Support** - Tools, Resources, Prompts, Sampling, Elicitation, Tasks, and Notifications
- **Official SDK Integration** - Built on `@modelcontextprotocol/sdk` v1.29.0 for reliable, standards-compliant testing
- **Jest Integration** - Complete test suite with 43 tests covering all major functionality
- **Mock Server Included** - Built-in mock MCP server for unit testing without external dependencies
- **TypeScript Support** - Full type safety and IntelliSense with comprehensive TypeScript definitions
- **CI/CD Ready** - GitHub Actions workflow included for automated testing
- **Simple API** - Clean, intuitive client interface for easy test writing
- **stdio Transport** - Optimized for local server testing via stdin/stdout
- **Error Handling** - Robust timeout handling and error reporting
- **Concurrent Requests** - Support for parallel tool calls and multiple simultaneous operations

## 📋 Table of Contents

- [For AI Agents](#for-ai-agents)
- [Installation](#installation)
- [Node.js Compatibility](#nodejs-compatibility)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Testing](#testing)
- [Examples](#examples)
- [CI/CD Integration](#cicd-integration)
- [Releases](#releases)
- [Advanced Usage](#advanced-usage)
- [Troubleshooting](#troubleshooting)
- [Project Structure](#project-structure)
- [Development](#development)
- [Test Coverage](#test-coverage)
- [Security](#security)
- [License](#license)
- [Contributing](#contributing)
- [Additional Resources](#additional-resources)
- [Support](#support)


## 🤖 For AI Agents

If you're an AI agent or automated system working with this codebase, see [AGENTS.md](./AGENTS.md) for comprehensive documentation including:

- **Essential commands** for development, testing, and releases
- **Code organization** and file structure
- **Naming conventions** and style guidelines
- **Testing patterns** and common gotchas
- **CI/CD integration** details
- **Error handling** patterns
- **Development workflow** and best practices
- **Key files reference** for quick lookup

The AGENTS.md file is specifically designed to help AI agents understand the codebase, patterns, and conventions used in this project.

## 🚀 Installation

### Prerequisites

- **Node.js** >= 18
- **npm** >= 9

### Install from npm

```bash
npm install @slbdn/mcp-tester --save-dev
```

### Install from git

```bash
git clone https://github.com/islobodan/mcp-tester.git
cd mcp-tester
npm install
```

### Development Installation

```bash
# Clone the repository
git clone https://github.com/islobodan/mcp-tester.git
cd mcp-tester

# Install dependencies
npm install

# Build the project
npm run build
```

## 🌐 Node.js Compatibility

MCP Tester is designed to work with a wide range of Node.js versions. Here's the compatibility matrix:

### Supported Versions

| Node.js Version | Status | Notes |
|---------------|--------|-------|
| 18.x | ✅ Fully Supported | Minimum required version |
| 20.x (LTS) | ✅ Fully Supported | Recommended for production |
| 21.x | ✅ Fully Supported | Latest stable release |
| 22.x | ✅ Supported | Tested in CI/CD |

### Testing Matrix

MCP Tester is automatically tested against multiple Node.js versions in CI/CD:

```yaml
strategy:
  matrix:
    node-version: [18, 20, 21]
```

All tests pass successfully on:
- Node.js 18.19.0+
- Node.js 20.11.0+
- Node.js 21.7.0+

### Runtime Requirements

The following Node.js features are required:
- ES2022 Modules (ESM)
- Async/await support
- Promise-based APIs
- Child process `spawn` with stdio
- Fetch API (for potential HTTP transport support)

### Version-Specific Notes

#### Node.js 18.x
- Minimum required version
- All features fully supported
- No known issues

#### Node.js 20.x (LTS)
- **Recommended for production use**
- Includes performance improvements
- All features fully supported

#### Node.js 21.x
- Latest stable features
- Improved garbage collection
- Full feature compatibility

#### Node.js 22.x
- Testing indicates compatibility
- May include newer V8 improvements

### Package Engine Configuration

The `package.json` specifies the Node.js engine requirement:

```json
{
  "engines": {
    "node": ">=18"
  }
}
```

This ensures that npm will prevent installation on unsupported Node.js versions.

### TypeScript Compatibility

MCP Tester targets TypeScript 5.3.0 with ES2022 output:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"]
  }
}
```

### Testing Your Node.js Version

To check your Node.js version:

```bash
# Check Node.js version
node --version

# Check npm version
npm --version

# Verify compatibility
node --version | awk '{print $1}' | xargs -I {} echo "Node.js {} is supported"
```

### Upgrading Node.js

If you're using an older version of Node.js (< 18):

**Using nvm (Node Version Manager):**
```bash
# Install latest Node.js
nvm install 20

# Use specific version
nvm use 20

# Set as default
nvm alias default 20
```

**Using n:**
```bash
# Install latest LTS
n 20

# Switch versions
n 18
```

**Using Node.js installer:**
```bash
# Download from https://nodejs.org/
# Install the latest LTS version (20.x recommended)
```

### CI/CD Version Specification

When using MCP Tester in CI/CD, specify the Node.js version:

**GitHub Actions:**
```yaml
- uses: actions/setup-node@v3
  with:
    node-version: '20'  # Specify desired version
```

**CircleCI:**
```yaml
docker:
  - image: cimg/node:20.11.0
```

**Jenkins:**
```groovy
tools {
  nodejs 'Node.js 20.11.0'
}
```

### Known Issues by Version

| Node.js Version | Known Issue | Workaround |
|---------------|--------------|-------------|
| < 18 | Not supported | Upgrade to 18+ |
| 18.0-18.16 | Potential issues with ESM | Use 18.17+ |
| Any | Memory limits for large operations | Increase `--max-old-space-size` |

### Performance by Version

Relative performance benchmarks (lower is better):

| Operation | Node 18 | Node 20 | Node 21 |
|-----------|-----------|-----------|-----------|
| Tool Call | 1.0x | 0.95x | 0.92x |
| Resource Read | 1.0x | 0.96x | 0.93x |
| Concurrent Ops | 1.0x | 1.02x | 1.05x |

*Based on 1000 operations per test

### Platform Compatibility

MCP Tester works on:
- ✅ macOS (Intel & Apple Silicon)
- ✅ Linux (Ubuntu, Debian, CentOS, Alpine)
- ✅ Windows 10/11 (via WSL or native Node.js)

Windows Notes:
- Native support with Node.js
- WSL2 recommended for Unix-like development
- Ensure proper line endings (CRLF vs LF)

## ⚡ Quick Start

### Basic Usage

```typescript
import { MCPClient } from 'mcp-tester';

const client = new MCPClient({
  name: 'my-test-client',
  version: '1.0.0',
  timeout: 30000,
});

// Start the client with your MCP server
await client.start({
  command: 'node',
  args: ['./your-mcp-server.js'],
});

// List available tools
const tools = await client.listTools();
console.log('Available tools:', tools.map(t => t.name));

// Call a tool
const result = await client.callTool({
  name: 'your-tool-name',
  arguments: { param: 'value' },
});
console.log('Tool result:', result);

// Clean up
await client.stop();
```

### Testing an MCP Server

```typescript
import { MCPClient } from 'mcp-tester';

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

### Run Included Examples

```bash
# Basic functionality test
npx tsx examples/basic-test.ts

# Full capabilities test
npx tsx examples/full-test.ts

# Run mock server standalone (for manual testing)
node examples/mock-server.js
```

## 📚 API Reference

### MCPClient

The main class for interacting with MCP servers.

#### Constructor

```typescript
new MCPClient(options?: MCPClientOptions)
```

**Parameters:**

- `options` (optional) - Client configuration options
  - `name` (string): Client identifier (default: `'mcp-test-client'`)
  - `version` (string): Client version (default: `'1.0.0'`)
  - `timeout` (number): Default request timeout in milliseconds (default: `30000`)

**Example:**

```typescript
const client = new MCPClient({
  name: 'production-test-client',
  version: '2.1.0',
  timeout: 60000,
});
```

#### Methods

##### `start(config: MCPServerConfig): Promise<void>`

Start the client and connect to an MCP server.

**Parameters:**

- `config.command` (string): Command to execute the MCP server (e.g., `'node'`, `'python3'`)
- `config.args` (string[], optional): Arguments to pass to the server command
- `config.env` (Record<string, string>, optional): Environment variables for the server process

**Returns:** `Promise<void>`

**Throws:** `Error` if client is already started or server fails to start

**Example:**

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

##### `stop(): Promise<void>`

Stop the client and disconnect from the MCP server.

**Returns:** `Promise<void>`

**Example:**

```typescript
await client.stop();
```

##### `isConnected(): boolean`

Check if the client is currently connected to an MCP server.

**Returns:** `boolean` - `true` if connected, `false` otherwise

**Example:**

```typescript
if (client.isConnected()) {
  console.log('Client is active');
}
```

##### `listTools(): Promise<Tool[]>`

List all available tools from the connected MCP server.

**Returns:** `Promise<Tool[]>` - Array of tool objects

**Throws:** `Error` if client is not started

**Tool Object Properties:**
- `name` (string): Unique tool identifier
- `description` (string): Human-readable tool description
- `inputSchema` (object): JSON Schema for tool parameters

**Example:**

```typescript
const tools = await client.listTools();
tools.forEach(tool => {
  console.log(`- ${tool.name}: ${tool.description}`);
});
```

##### `callTool(options: ToolCallOptions): Promise<ToolResult>`

Call a specific tool with optional arguments.

**Parameters:**

- `options.name` (string): Name of the tool to call
- `options.arguments` (Record<string, unknown>, optional): Arguments to pass to the tool
- `options.timeout` (number, optional): Override default timeout for this call

**Returns:** `Promise<ToolResult>` - Result containing content array

**Throws:** `Error` if client is not started, tool not found, or call fails

**Example:**

```typescript
const result = await client.callTool({
  name: 'calculator-add',
  arguments: { a: 5, b: 3 },
  timeout: 10000,
});

console.log('Result:', result.content[0].text);
```

##### `listResources(): Promise<Resource[]>`

List all available resources from the connected MCP server.

**Returns:** `Promise<Resource[]>` - Array of resource objects

**Throws:** `Error` if client is not started

**Resource Object Properties:**
- `uri` (string): Unique resource identifier
- `name` (string): Human-readable resource name
- `description` (string): Resource description
- `mimeType` (string): Resource MIME type

**Example:**

```typescript
const resources = await client.listResources();
resources.forEach(resource => {
  console.log(`- ${resource.uri}: ${resource.mimeType}`);
});
```

##### `readResource(uri: string): Promise<ResourceContents>`

Read a specific resource by its URI.

**Parameters:**

- `uri` (string): URI of the resource to read

**Returns:** `Promise<ResourceContents>` - Object containing resource contents

**Throws:** `Error` if client is not started or resource not found

**Example:**

```typescript
const result = await client.readResource('config://settings');
console.log('Settings:', result.contents[0].text);
```

##### `listPrompts(): Promise<Prompt[]>`

List all available prompts from the connected MCP server.

**Returns:** `Promise<Prompt[]>` - Array of prompt objects

**Throws:** `Error` if client is not started

**Prompt Object Properties:**
- `name` (string): Unique prompt identifier
- `description` (string): Human-readable prompt description
- `arguments` (array): Required/optional prompt arguments

**Example:**

```typescript
const prompts = await client.listPrompts();
prompts.forEach(prompt => {
  console.log(`- ${prompt.name}: ${prompt.description}`);
});
```

##### `getPrompt(name: string, args?: Record<string, string>): Promise<PromptMessage[]>`

Get a specific prompt template, optionally with argument values.

**Parameters:**

- `name` (string): Name of the prompt to retrieve
- `args` (Record<string, string>, optional): Values for prompt arguments

**Returns:** `Promise<PromptMessage[]>` - Array of message objects

**Throws:** `Error` if client is not started or prompt not found

**Example:**

```typescript
const messages = await client.getPrompt('greet', { name: 'Alice' });
console.log('Prompt:', messages[0].content.text);
```

##### `requestSampling(request: CreateMessageRequestParams): Promise<SamplingResult>`

Request LLM sampling from the MCP server.

**Parameters:**

- `request` (CreateMessageRequestParams): Sampling request parameters
  - `messages` (array): Array of conversation messages
  - `maxTokens` (number): Maximum tokens to generate
  - `modelPreferences` (object, optional): Model selection preferences

**Returns:** `Promise<SamplingResult>` - Sampling result with generated content

**Throws:** `Error` if client is not started or sampling not supported

**Example:**

```typescript
const result = await client.requestSampling({
  messages: [
    {
      role: 'user',
      content: {
        type: 'text',
        text: 'Explain quantum computing',
      },
    },
  ],
  maxTokens: 500,
});
```

##### `setElicitationHandler(handler: Function): Promise<void>`

Configure an elicitation handler to respond to server requests for user input.

**Parameters:**

- `handler` (Function): Async function that receives elicitation requests
  - Returns object with `action` field: `'accept' | 'decline' | 'cancel'`
  - Optionally returns `content` with collected input

**Returns:** `Promise<void>`

**Example:**

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

##### `setNotificationHandlers(handlers: NotificationHandler): void`

Configure handlers for server-initiated notifications.

**Parameters:**

- `handlers.onLoggingMessage` (Function): Handle logging notifications
  - `level` (string): Log level (`'debug' | 'info' | 'warning' | 'error'`)
  - `data` (string): Log message content

- `handlers.onResourceListChanged` (Function): Handle resource list change notifications

**Example:**

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

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run in watch mode (auto-rerun on changes)
npm run test:watch

# Run with coverage report
npm run test:coverage

# Lint code
npm run lint
```

### Test Structure

```
src/__tests__/
├── client.test.ts               # Basic client operations
├── resources-prompts.test.ts    # Resources and prompts functionality
├── advanced.test.ts             # Advanced features (sampling, elicitation)
├── real-server.test.ts          # Integration tests (real server process via stdio)
├── helpers-example.test.ts      # Test helpers usage examples
├── helpers.ts                   # Test utility functions
├── matchers.ts                  # Custom Jest matchers
└── fixtures/
    └── mock-server.ts           # In-memory mock MCP server for unit testing
```

### Writing Custom Tests

#### Test Template

```typescript
import { MCPClient } from '../client/MCPClient.js';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('My Feature', () => {
  let client: MCPClient;

  beforeEach(() => {
    client = new MCPClient({
      name: 'test-client',
      version: '1.0.0',
    });
  });

  afterEach(async () => {
    if (client.isConnected()) {
      await client.stop();
    }
  });

  it('should test feature', async () => {
    const result = await client.callTool({
      name: 'my-feature',
      arguments: {},
    });
    expect(result).toBeDefined();
  });
});
```

#### Testing Patterns

**Async/Await Pattern**

Always use `async/await` for MCP client operations:

```typescript
it('should handle async operation', async () => {
  const result = await client.listTools();  // ✓ Correct
  // const result = client.listTools();    // ✗ Returns Promise, not result
});
```

**Cleanup Pattern**

Always clean up connections in `afterEach`:

```typescript
afterEach(async () => {
  if (client.isConnected()) {
    await client.stop();
  }
});
```

**Error Testing**

Use `rejects.toThrow()` for expected errors:

```typescript
it('should handle invalid tool', async () => {
  await expect(
    client.callTool({ name: 'non-existent', arguments: {} })
  ).rejects.toThrow();
});
```

### Test Helpers and Matchers

MCP Tester includes custom test helpers and Jest matchers to reduce boilerplate and improve test readability.

#### Using Test Helpers

Import helper functions to simplify test setup:

```typescript
import { createTestClient, createTestSuite, createMockServerConfig } from './helpers.js';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('My Feature', () => {
  // Use createTestSuite for automatic setup/teardown
  const testSuite = createTestSuite(createMockServerConfig());

  beforeEach(async () => {
    await testSuite.setup(); // Starts server automatically
  });

  afterEach(async () => {
    await testSuite.teardown(); // Stops server automatically
  });

  it('should test feature', async () => {
    const tools = await testSuite.client.listTools();
    expect(tools).toBeDefined();
  });
});
```

**Available Helper Functions:**

| Function | Description |
|----------|-------------|
| `createTestClient(options?)` | Creates client with default test options |
| `createTestSuite(serverConfig, options?)` | Creates test suite with auto setup/teardown |
| `setupTestServer(config, options?)` | Manual server setup |
| `teardownTestServer(client)` | Manual server cleanup |
| `createMockServerConfig(args?)` | Creates mock server configuration |
| `waitForClientState(client, isConnected, timeout?)` | Waits for client state |
| `runWithTimeout(fn, timeout?)` | Runs function with timeout |
| `retryUntil(fn, attempts?, delay?)` | Retries function until success |
| `callTool(client, toolName, args?)` | Helper for tool calls |
| `validateToolResult(result)` | Validates tool call result |

#### Using Custom Matchers

Import custom matchers for improved assertions:

```typescript
import { toHaveTool, toHaveResource, toHavePrompt } from './matchers.js';

it('should verify tool exists', async () => {
  const tools = await client.listTools();
  expect(tools).toHaveTool('echo'); // Custom matcher
});

it('should verify resource exists', async () => {
  const resources = await client.listResources();
  expect(resources).toHaveResource('text://example'); // Custom matcher
});

it('should verify prompt exists', async () => {
  const prompts = await client.listPrompts();
  expect(prompts).toHavePrompt('greeting'); // Custom matcher
});
```

**Available Custom Matchers:**

| Matcher | Description |
|----------|-------------|
| `toHaveTool(toolName)` | Checks if tool exists in tools array |
| `toHaveResource(uri)` | Checks if resource exists in resources array |
| `toHavePrompt(promptName)` | Checks if prompt exists in prompts array |
| `toHaveToolWithSchema(toolName)` | Checks if tool has input schema |

#### Example with Helpers and Matchers

```typescript
import { createTestSuite, createMockServerConfig, callTool } from './helpers.js';
import { toHaveTool, toHaveResource } from './matchers.js';

describe('Complete Example', () => {
  const testSuite = createTestSuite(createMockServerConfig());

  beforeEach(async () => await testSuite.setup());
  afterEach(async () => await testSuite.teardown());

  it('should verify tools', async () => {
    const tools = await testSuite.client.listTools();
    expect(tools).toHaveTool('echo');
  });

  it('should verify resources', async () => {
    const resources = await testSuite.client.listResources();
    expect(resources).toHaveResource('text://example');
  });

  it('should call tool', async () => {
    const result = await callTool(testSuite.client, 'echo', {
      message: 'hello',
    });
    expect(result).toBeDefined();
  });
});
```

For more examples, see `src/__tests__/helpers-example.test.ts`.

## 💡 Examples

### Example 1: Basic Tool Testing

```typescript
import { MCPClient } from 'mcp-tester';

async function testTool() {
  const client = new MCPClient();

  try {
    await client.start({
      command: 'node',
      args: ['./my-server.js'],
    });

    const tools = await client.listTools();
    console.log(`Found ${tools.length} tools`);

    for (const tool of tools) {
      console.log(`\nTesting: ${tool.name}`);
      const result = await client.callTool({
        name: tool.name,
        arguments: {},
      });
      console.log(`Result: ${result.content[0]?.text}`);
    }

  } finally {
    await client.stop();
  }
}

testTool();
```

### Example 2: Resource Reading

```typescript
import { MCPClient } from 'mcp-tester';

async function readConfiguration() {
  const client = new MCPClient();

  try {
    await client.start({
      command: 'node',
      args: ['./config-server.js'],
    });

    const resources = await client.listResources();
    console.log('Available resources:', resources.map(r => r.uri));

    const settings = await client.readResource('config://settings');
    console.log('Settings:', JSON.parse(settings.contents[0].text as string));

  } finally {
    await client.stop();
  }
}

readConfiguration();
```

### Example 3: Using Prompts

```typescript
import { MCPClient } from 'mcp-tester';

async function usePrompt() {
  const client = new MCPClient();

  try {
    await client.start({
      command: 'node',
      args: ['./prompt-server.js'],
    });

    const prompt = await client.getPrompt('greet', { name: 'World' });
    console.log('Generated message:', prompt.messages[0].content.text);

  } finally {
    await client.stop();
  }
}

usePrompt();
```

### Example 4: Complete Test Suite

```typescript
import { MCPClient } from 'mcp-tester';

describe('My MCP Server', () => {
  let client: MCPClient;

  beforeEach(async () => {
    client = new MCPClient();
    await client.start({
      command: 'node',
      args: ['./server.js'],
    });
  });

  afterEach(async () => {
    if (client.isConnected()) {
      await client.stop();
    }
  });

  it('should list tools correctly', async () => {
    const tools = await client.listTools();
    expect(tools).toHaveLength(5);
  });

  it('should execute tool with correct arguments', async () => {
    const result = await client.callTool({
      name: 'calculate',
      arguments: { operation: 'add', values: [10, 20] },
    });
    expect(result.content[0].text).toBe('30');
  });

  it('should handle tool errors gracefully', async () => {
    await expect(
      client.callTool({ name: 'invalid-tool', arguments: {} })
    ).rejects.toThrow();
  });

  it('should read resources correctly', async () => {
    const resources = await client.listResources();
    expect(resources.length).toBeGreaterThan(0);
  });
});
```

## 🔄 CI/CD Integration

### GitHub Actions

Create `.github/workflows/test.yml`:

```yaml
name: Test MCP Server

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18, 20, 21]

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}

      - name: Install dependencies
        run: npm ci

      - name: Build TypeScript
        run: npm run build

      - name: Run tests
        run: npm test

      - name: Run tests with coverage
        run: npm run test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          flags: unittests
          name: codecov-umbrella
```

### CircleCI

Create `.circleci/config.yml`:

```yaml
version: 2.1
jobs:
  test:
    docker:
      - image: cimg/node:18
    steps:
      - checkout
      - run: npm ci
      - run: npm run build
      - run: npm test
```

### Jenkins

Create `Jenkinsfile`:

```groovy
pipeline {
  agent any
  stages {
    stage('Test') {
      steps {
        sh 'npm ci'
        sh 'npm run build'
        sh 'npm test'
      }
    }
  }
}
```

## 🚀 Releases

### Automated Release Process

MCP Tester uses automated release workflow triggered by version tags:

```bash
# 1. Update version
npm run release:patch  # or release:minor, release:major

# 2. Update CHANGELOG.md
#    Move items from [Unreleased] to new version section

# 3. Commit and tag
git add package.json CHANGELOG.md
git commit -m "chore: release v1.0.1"
git tag v1.0.1
git push origin main --tags
```

The release workflow automatically:
- ✅ Runs all tests across Node.js 18, 20, 21
- ✅ Builds the project
- ✅ Publishes to npm
- ✅ Creates GitHub release with CHANGELOG notes

### Quick Release Commands

```bash
# Patch release (1.0.0 → 1.0.1)
npm run release:patch

# Minor release (1.0.0 → 1.1.0)
npm run release:minor

# Major release (1.0.0 → 2.0.0)
npm run release:major

# Prerelease (1.0.0 → 1.1.0-alpha.1)
npm run release:prerelease
```

### Prerequisites

Before releasing, ensure:

1. **NPM Token** is set in GitHub repository secrets as `NPM_TOKEN`
2. **CHANGELOG.md** is updated with all changes
3. **Tests pass** locally (`npm test`)
4. **Build succeeds** (`npm run build`)

For detailed instructions, see [RELEASE.md](https://github.com/your-org/mcp-tester/blob/main/RELEASE.md).

## 🚀 Advanced Usage

### Concurrent Operations

Run multiple operations in parallel:

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

### Timeout Handling

Customize timeouts for specific operations:

```typescript
const result = await client.callTool({
  name: 'slow-operation',
  arguments: { duration: 5000 },
  timeout: 10000,  // 10 second timeout for this call only
});
```

### Environment Variables

Pass environment variables to the MCP server:

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

### Notification Handling

Monitor server-initiated notifications:

```typescript
client.setNotificationHandlers({
  onLoggingMessage: (level, data) => {
    console.log(`[${level}] ${data}`);

    // Store for testing
    if (level === 'error') {
      // Handle errors
    }
  },
  onResourceListChanged: async () => {
    console.log('Resources changed, refreshing...');
    const resources = await client.listResources();
    console.log(`Now have ${resources.length} resources`);
  },
});
```

### Elicitation Handling

Respond to server requests for user input:

```typescript
await client.setElicitationHandler(async (request) => {
  console.log('Elicitation request:', request.params.mode);

  if (request.params.mode === 'form') {
    // Validate and collect user input
    const userInput = {
      username: 'test-user',
      email: 'test@example.com',
    };

    return {
      action: 'accept',
      content: userInput,
    };
  }

  return { action: 'decline' };
});
```

### Mock Server for Unit Testing

Use the included mock server for tests that don't require a real MCP server:

```typescript
import { MockMCPServer } from './fixtures/mock-server.js';

describe('My Feature', () => {
  let mockServer: MockMCPServer;

  beforeEach(() => {
    mockServer = new MockMCPServer();
  });

  it('should handle mock tool call', async () => {
    const result = await mockServer.handleToolCall('echo', {
      message: 'test',
    });
    expect(result.content[0].text).toBe('Echo: test');
  });

  it('should handle mock resource read', async () => {
    const result = await mockServer.handleResourceRead('config://settings');
    expect(result.contents[0].text).toContain('setting1');
  });

  it('should handle mock prompt', async () => {
    const result = await mockServer.handlePromptGet('greet', {
      name: 'Alice',
    });
    expect(result.messages[0].content.text).toContain('Alice');
  });
});
```

## 🛠️ Troubleshooting

### Common Issues

#### "Client not started" Error

**Problem:** Calling client methods before `start()`

**Solution:** Always call `await client.start()` before other methods

```typescript
// ✗ Wrong
const client = new MCPClient();
const tools = await client.listTools();  // Error: Client not started

// ✓ Correct
const client = new MCPClient();
await client.start();
const tools = await client.listTools();  // Works
```

#### Timeout Errors

**Problem:** Requests timing out

**Solution:** Increase timeout or check server performance

```typescript
// Increase global timeout
const client = new MCPClient({ timeout: 60000 });

// Or per-call timeout
await client.callTool({ name: 'slow-tool', arguments: {}, timeout: 30000 });
```

#### Server Process Fails to Start

**Problem:** Server command not found or fails immediately

**Solution:** Check command path and ensure server executable exists

```bash
# Verify server exists
ls -la ./my-server.js

# Test server standalone
node ./my-server.js
```

#### TypeScript Build Errors

**Problem:** Type errors after building

**Solution:** Ensure all dependencies installed and TypeScript version compatible

```bash
# Clean and rebuild
rm -rf dist/
npm run build
```

#### Test Failures

**Problem:** Tests failing in CI but passing locally

**Solution:** Check environment variables and server path

```yaml
# GitHub Actions - add environment variables
- name: Run tests
  env:
    MOCK_SERVER_PATH: ${{ github.workspace }}/my-server.js
  run: npm test
```

### Debug Mode

Enable verbose logging for debugging:

```typescript
import { MCPClient } from 'mcp-tester';

const client = new MCPClient({
  name: 'debug-client',
});

await client.start({
  command: 'node',
  args: ['./server.js', '--verbose'],
});

// Server logs to stderr, check for detailed output
```

### Test Coverage

Generate coverage reports:

```bash
# Run tests with coverage
npm run test:coverage

# View coverage report
open coverage/lcov-report/index.html
```

## 📊 Project Structure

```
mcp-tester/
├── src/
│   ├── client/
│   │   ├── MCPClient.ts                 # Main client wrapper class
│   │   └── index.ts                     # Client module exports
│   ├── __tests__/
│   │   ├── client.test.ts               # Basic client operations tests
│   │   ├── resources-prompts.test.ts    # Resources & prompts tests
│   │   ├── advanced.test.ts             # Advanced features tests
│   │   ├── real-server.test.ts          # Integration tests (stdio transport)
│   │   ├── helpers-example.test.ts      # Test helpers usage examples
│   │   ├── helpers.ts                   # Test utility functions
│   │   ├── matchers.ts                  # Custom Jest matchers
│   │   └── fixtures/
│   │       └── mock-server.ts           # In-memory mock MCP server
│   └── index.ts                         # Library exports
├── examples/
│   ├── basic-test.ts                    # Basic usage example
│   ├── full-test.ts                     # Full capabilities example
│   └── mock-server.js                   # Standalone MCP server for testing
├── dist/                                # Compiled JavaScript output
├── package.json
├── tsconfig.json
├── jest.config.js
├── .eslintrc.json
├── .github/workflows/
│   └── test.yml                         # CI/CD workflow
├── .gitignore
├── LICENSE
└── README.md
```

## 🔧 CLI Tool

MCP Tester includes a command-line interface for quick server testing without writing code.

### Quick Examples

```bash
# Test server connection and list capabilities
mcp-tester test node ./server.js

# List available tools
mcp-tester list-tools node ./server.js
mcp-tester lt node ./server.js  # short alias

# Call a tool
mcp-tester call-tool echo node ./server.js --params '{"message":"Hello"}'
mcp-tester ct echo node ./server.js --params '{"message":"World"}'  # short alias

# Read a resource
mcp-tester read-resource text://example node ./server.js
mcp-tester rr text://example node ./server.js  # short alias

# Get a prompt
mcp-tester get-prompt greet node ./server.js --args '{"name":"Alice"}'
mcp-tester gp greet node ./server.js --args '{"name":"Bob"}'  # short alias

# JSON output for scripting
mcp-tester lt node ./server.js --json
```

### Installation (Global)

```bash
# Install globally via npx
npx @slbdn/mcp-tester test node ./server.js

# Or link after local install
npm install @slbdn/mcp-tester
npm link
mcp-tester test node ./server.js
```

For full CLI documentation, see [CLI.md](./CLI.md).

## 🔧 Development

### Build

```bash
# Build TypeScript to JavaScript
npm run build
```

### Lint

```bash
# Run ESLint
npm run lint

# Auto-fix issues
npm run lint --fix
```

### Watch Mode

For development with hot reloading:

```bash
# Install tsx for TypeScript execution
npm install -D tsx

# Watch and run tests
npx tsx --watch --clear-screen=false
```

## 📈 Test Coverage

Current test suite: **43 tests**

```
Test Categories:
- Basic Operations       3 tests
- Tools (in-memory)     11 tests
- Resources (in-memory)  5 tests
- Prompts (in-memory)    4 tests
- Advanced Features      3 tests
- Helpers Examples       4 tests
- Real Server (stdio)   13 tests
```

Coverage targets:
- **Branches:** 70%
- **Functions:** 70%
- **Lines:** 70%
- **Statements:** 70%

## 🔐 Security

### Best Practices

1. **Never Commit Secrets**
   - Don't commit API keys, passwords, or tokens
   - Use environment variables in CI/CD
   - Add sensitive patterns to `.gitignore`

2. **Validate Input**
   - Always validate server responses
   - Use TypeScript for type safety
   - Sanitize user inputs

3. **Secure Connections**
   - Use stdio for local servers
   - Verify server identity in production
   - Use HTTPS for remote connections

4. **Error Handling**
   - Never expose internal errors to users
   - Log errors securely
   - Implement proper error recovery

### Known Limitations

- Only supports stdio transport (HTTP transport not implemented)
- Designed for Node.js servers (other runtimes may need adjustments)
- Mock server is minimal (real servers may have different behavior)

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Setup

```bash
# Clone and setup
git clone <your-fork>
cd mcp-tester
npm install

# Create feature branch
git checkout -b feature/my-feature

# Make changes and test
npm run build
npm test

# Format and lint
npm run lint --fix
```

## 📚 Additional Resources
- [AGENTS.md](./AGENTS.md) - Documentation for AI agents working with this codebase
- [CLI.md](./CLI.md) - CLI tool documentation
- [API Documentation](./docs/api/README.md) - Generated TypeDoc API reference

- [MCP Specification](https://spec.modelcontextprotocol.io) - Official MCP protocol specification
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) - Official SDK documentation
- [MCP Examples](https://github.com/modelcontextprotocol/servers) - Example MCP servers
- [Jest Documentation](https://jestjs.io/) - Testing framework documentation
- [TypeScript Handbook](https://www.typescriptlang.org/docs/) - TypeScript language reference

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/your-org/mcp-tester/issues)
- **Discussions:** [GitHub Discussions](https://github.com/your-org/mcp-tester/discussions)
- **Documentation:** [Project Wiki](https://github.com/your-org/mcp-tester/wiki)

## 📝 License

MIT License - see [LICENSE](LICENSE) for details.

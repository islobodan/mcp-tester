# CLI Tool

MCP Tester includes a CLI for quick server testing without writing code.

Install globally or use via npx:

```bash
npx @slbdn/mcp-tester test node ./server.js
```

## Transports

The CLI supports three transport types:

### Stdio (default)

Pass the command and arguments as positional args:

```bash
mcp-tester test node ./server.js
mcp-tester list-tools node ./server.js --json
```

### HTTP (Streamable HTTP)

Pass the URL as the first argument (auto-detected), or use `--transport http --url`:

```bash
# Auto-detect: URL as first arg
mcp-tester test http://localhost:3000/mcp
mcp-tester list-tools http://localhost:3000/mcp --json

# Explicit
mcp-tester test --transport http --url http://localhost:3000/mcp

# With headers
mcp-tester test --transport http --url https://api.example.com/mcp --headers '{"Authorization":"Bearer token"}'
```

### SSE (legacy)

```bash
mcp-tester test --transport sse --url http://localhost:3000/sse
```

## Commands

### `test` — Test Server Connection

Connects to the server and lists all capabilities.

```bash
mcp-tester test node ./server.js
```

### `list-tools` (alias: `lt`)

List all available tools.

```bash
mcp-tester list-tools node ./server.js
mcp-tester lt node ./server.js --json
```

### `call-tool` (alias: `ct`)

Call a tool with optional JSON parameters.

```bash
mcp-tester call-tool echo node ./server.js --params '{"message":"Hello"}'
mcp-tester ct echo node ./server.js --params '{"message":"World"}' --json
```

### `read-resource` (alias: `rr`)

Read a resource by URI.

```bash
mcp-tester read-resource text://example node ./server.js
mcp-tester rr text://example node ./server.js --json
```

### `get-prompt` (alias: `gp`)

Get a prompt with optional JSON arguments.

```bash
mcp-tester get-prompt greet node ./server.js --args '{"name":"Alice"}'
mcp-tester gp greet node ./server.js --args '{"name":"Bob"}' --json
```

## Global Options

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `--timeout <ms>` | `-t` | 30000 | Request timeout |
| `--verbose` | `-v` | off | Enable debug output |
| `--log-level <level>` | `-l` | info | Log level (debug/info/warn/error) |
| `--json` | | off | Output as JSON (commands that support it) |

### `generate` (alias: `gen`) — Generate Test Files

Connect to a server, inspect all capabilities, and generate a ready-to-run test file.

```bash
# Generate Jest test file
mcp-tester generate node ./server.js -o server.test.ts

# Generate Vitest test file
mcp-tester gen node ./server.js --framework vitest -o server.test.ts

# Skip specific sections
mcp-tester generate node ./server.js --no-resources --no-prompts -o tools-only.test.ts

# Print to stdout (no file)
mcp-tester generate node ./server.js
```

**Options:**

| Option | Default | Description |
|--------|---------|-------------|
| `-o, --output <file>` | stdout | Output file path |
| `--framework <fw>` | `jest` | Test framework (`jest` or `vitest`) |
| `--description <desc>` | auto | Test suite description |
| `--no-tools` | | Skip tool tests |
| `--no-resources` | | Skip resource tests |
| `--no-prompts` | | Skip prompt tests |
| `--no-matchers` | | Skip custom matchers import |

### `generate-types` (alias: `gen-types`) — Generate TypeScript Types

Connect to a server, read tool schemas, and generate typed `.d.ts` declarations.

```bash
# Generate and save to file
mcp-tester generate-types node ./server.js -o server.d.ts

# Print to stdout
mcp-tester generate-types node ./server.js

# Skip resource/prompt types
mcp-tester generate-types node ./server.js --no-resources --no-prompts -o types.d.ts
```

**Options:**

| Option | Default | Description |
|--------|---------|-------------|
| `-o, --output <file>` | stdout | Output file path |
| `--module-name <name>` | `@slbdn/mcp-tester` | Module name for import hints |
| `--no-resources` | | Skip resource URI types |
| `--no-prompts` | | Skip prompt argument types |

**Generated types:**

| Type | Description |
|------|-------------|
| `{ToolName}Args` | Typed interface per tool (e.g., `EchoArgs`, `AddArgs`) |
| `ToolName` | Union of all tool names (e.g., `'echo' \| 'add'`) |
| `ToolArgsMap` | Lookup map: `ToolArgsMap['add']` → `AddArgs` |
| `ToolCall` | Discriminated union: `{ name: 'add'; arguments: AddArgs }` |
| `ResourceUri` | Union of all resource URIs |
| `{PromptName}Args` | Typed interface per prompt |
| `PromptName` | Union of all prompt names |
| `PromptArgsMap` | Lookup map for prompt arguments |
| `ServerCapabilities` | Overview interface with typed arrays |

**Usage with generated types:**

```typescript
import type { ToolArgsMap, ToolName } from './server.d.ts';

const result = await client.callTool({
  name: 'add',
  arguments: { a: 1, b: 2 } as ToolArgsMap['add'],
});
```

## Global Options

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `--timeout <ms>` | `-t` | 30000 | Request timeout |
| `--verbose` | `-v` | off | Enable debug output |
| `--log-level <level>` | `-l` | info | Log level (debug/info/warn/error) |
| `--json` | | off | Output as JSON (commands that support it) |

## Output Format

Default output is human-readable with emojis. Use `--json` for machine-readable output:

```bash
mcp-tester lt node ./server.js --json
```

```json
{
  "tools": [
    {
      "name": "echo",
      "description": "Echo back the input",
      "inputSchema": { ... }
    }
  ]
}
```

# CLI Tool

MCP Tester includes a CLI for quick server testing without writing code.

Install globally or use via npx:

```bash
npx @slbdn/mcp-tester test node ./server.js
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

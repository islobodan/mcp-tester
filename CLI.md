# MCP Tester CLI Documentation

A comprehensive guide to the `mcp-tester` command-line tool for testing MCP servers.

## Overview

The CLI provides a fast way to test MCP servers without writing test files. It connects to any MCP server via stdio transport, tests basic connectivity, and allows inspection and interaction with tools, resources, and prompts.

**Requires:** Node.js >= 18, MCP server with stdio transport

---

## Installation

### Option 1: Via npx (No Install)

```bash
npx @slbdn/mcp-tester test node ./server.js
```

### Option 2: Local Install (Recommended)

```bash
npm install @slbdn/mcp-tester --save-dev
```

### Option 3: Global Link

```bash
npm install @slbdn/mcp-tester -g
# or
npm install @slbdn/mcp-tester
npm link
```

---

## Usage

```
mcp-tester [global-options] <command> [command-options]
```

### Global Options

| Option | Alias | Default | Description |
|--------|-------|---------|-------------|
| `--timeout <ms>` | `-t` | `30000` | Request timeout in milliseconds |
| `--verbose` | `-v` | `false` | Enable verbose output (sets log-level to debug) |
| `--log-level <level>` | `-l` | `info` | Log level: `debug`, `info`, `warn`, `error` |

### Commands

| Command | Alias | Description |
|---------|-------|-------------|
| `test` | — | Test server connection and list all capabilities |
| `list-tools` | `lt` | List all available tools |
| `call-tool` | `ct` | Call a specific tool |
| `read-resource` | `rr` | Read a resource by URI |
| `get-prompt` | `gp` | Get a prompt by name |

---

## Commands Reference

### `test` — Test Server Connection

Tests server connectivity and displays all available capabilities (tools, resources, prompts).

**Usage:**
```
mcp-tester test <command> [args...]
```

**Example:**
```bash
# Test with Node.js
mcp-tester test node ./examples/mock-server.js

# Test with Python
mcp-tester test python ./mcp_server.py

# With custom timeout
mcp-tester test node ./server.js --timeout 60000

# Verbose mode
mcp-tester test node ./server.js --verbose
```

**Output:**
```
🔌 Connecting to MCP server...
   Command: node ./examples/mock-server.js
✅ Connected successfully

🛠️  Tools:
   • echo: Echo back the input
   • add: Add two numbers

📄 Resources:
   • text://example: A simple text resource

💬 Prompts:
   • greet: Greet someone

✅ Server test completed successfully!
   Tools: 2 | Resources: 1 | Prompts: 1
```

---

### `list-tools` — List Available Tools

Lists all tools available on the MCP server with their descriptions and parameters.

**Usage:**
```
mcp-tester list-tools <command> [args...]
mcp-tester lt <command> [args...]  # short alias
```

**Options:**
| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

**Example:**
```bash
# List all tools
mcp-tester list-tools node ./server.js

# Short alias
mcp-tester lt node ./server.js

# JSON output
mcp-tester list-tools node ./server.js --json

# Combine with global options
mcp-tester lt node ./server.js --verbose --timeout 20000
```

**Text Output:**
```
🛠️  Available tools (4):

  echo
    Description: Echo back the input
    Parameters: message

  add
    Description: Add two numbers
    Parameters: a, b

  delay
    Description: Delay for specified milliseconds
    Parameters: ms

  error_tool
    Description: Always returns an error
    Parameters: message
```

**JSON Output:**
```json
{
  "tools": [
    {
      "name": "echo",
      "description": "Echo back the input",
      "inputSchema": {
        "type": "object",
        "properties": {
          "message": {
            "type": "string",
            "description": "Message to echo"
          }
        },
        "required": ["message"]
      }
    }
  ]
}
```

---

### `call-tool` — Call a Tool

Calls a specific tool on the MCP server with optional parameters.

**Usage:**
```
mcp-tester call-tool <tool-name> <command> [args...]
mcp-tester ct <tool-name> <command> [args...]  # short alias
```

**Options:**
| Option | Description |
|--------|-------------|
| `--params <json>` | Tool parameters as JSON string |
| `--json` | Output result as JSON |

**Example:**
```bash
# Call echo tool with parameter
mcp-tester call-tool echo node ./server.js --params '{"message":"Hello World"}'

# Short alias
mcp-tester ct add node ./server.js --params '{"a":5,"b":3}'

# JSON output
mcp-tester call-tool echo node ./server.js --params '{"message":"test"}' --json

# With global options
mcp-tester ct echo node ./server.js --params '{"message":"slow"}' --timeout 60000 --verbose
```

**Text Output:**
```
🔧 Calling tool: echo
   Parameters: {"message":"Hello World"}

✅ Result:
   Echo: Hello World
```

**JSON Output:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "Echo: Hello World"
    }
  ]
}
```

**Error Handling:**
```bash
# Calling non-existent tool
mcp-tester ct nonexistent node ./server.js --params '{}'
# Output: ❌ Error: MCP error -32603: Unknown tool: nonexistent

# Calling tool with wrong parameters
mcp-tester ct add node ./server.js --params '{"a":"not-a-number"}'
# Output: ❌ Error: Invalid parameters
```

---

### `read-resource` — Read a Resource

Reads a resource by its URI from the MCP server.

**Usage:**
```
mcp-tester read-resource <uri> <command> [args...]
mcp-tester rr <uri> <command> [args...]  # short alias
```

**Options:**
| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

**Example:**
```bash
# Read a text resource
mcp-tester read-resource text://example node ./server.js

# Short alias
mcp-tester rr config://settings node ./server.js

# JSON output
mcp-tester rr text://example node ./server.js --json

# With verbose logging
mcp-tester rr text://example node ./server.js --verbose
```

**Text Output:**
```
📖 Reading resource: text://example

📄 Content:
   This is example text content stored on the server.
```

**JSON Output:**
```json
{
  "contents": [
    {
      "type": "text",
      "text": "This is example text content stored on the server."
    }
  ]
}
```

---

### `get-prompt` — Get a Prompt

Gets a prompt template by name from the MCP server with optional arguments.

**Usage:**
```
mcp-tester get-prompt <name> <command> [args...]
mcp-tester gp <name> <command> [args...]  # short alias
```

**Options:**
| Option | Description |
|--------|-------------|
| `--args <json>` | Prompt arguments as JSON string |
| `--json` | Output as JSON |

**Example:**
```bash
# Get greet prompt with name argument
mcp-tester get-prompt greet node ./server.js --args '{"name":"Alice"}'

# Short alias
mcp-tester gp summarize node ./server.js --args '{"text":"Hello world"}'

# Without arguments
mcp-tester gp greet node ./server.js

# JSON output
mcp-tester gp greet node ./server.js --args '{"name":"Bob"}' --json
```

**Text Output:**
```
💬 Getting prompt: greet

📝 Messages:
   [user]
   Hello Alice! How can I help you today?
```

**JSON Output:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": {
        "type": "text",
        "text": "Hello Alice! How can I help you today?"
      }
    }
  ]
}
```

---

## Global Options In Depth

### `--timeout` / `-t`

Sets the request timeout in milliseconds for all operations.

```bash
# 60 second timeout
mcp-tester test node ./server.js --timeout 60000

# 10 second timeout
mcp-tester call-tool echo node ./server.js --params '{}' --timeout 10000

# Short form
mcp-tester lt node ./server.js -t 5000
```

**Default:** `30000` (30 seconds)

**Use cases:**
- Slow servers: increase to `60000` or higher
- Fast tests: decrease to `5000` for quicker feedback
- CI/CD: consider network latency

### `--verbose` / `-v`

Enables verbose output with debug-level logging showing all MCPClient activity.

```bash
# Enable verbose
mcp-tester test node ./server.js --verbose

# Combine with commands
mcp-tester lt node ./server.js -v

# With other options
mcp-tester ct echo node ./server.js --params '{}' --verbose --timeout 30000
```

**Output includes:**
- Client initialization logs
- Connection status messages
- Request/response details
- Error stack traces

### `--log-level` / `-l`

Sets the log level for the MCPClient.

```bash
# Debug level (most verbose)
mcp-tester test node ./server.js --log-level debug

# Error only (least verbose)
mcp-tester test node ./server.js --log-level error

# Info (default)
mcp-tester test node ./server.js --log-level info

# Warn
mcp-tester lt node ./server.js --log-level warn
```

**Levels:**
- `debug` — Most verbose, shows all messages
- `info` — Default, shows important events
- `warn` — Shows warnings and errors only
- `error` — Shows errors only

---

## Extended Examples

### 1. Quick Server Discovery

Discover what a server offers quickly:

```bash
# Test connection and see everything
mcp-tester test node ./server.js

# List only tools
mcp-tester lt node ./server.js --json | jq '.tools[].name'

# Check if specific tool exists
mcp-tester lt node ./server.js | grep -q "calculator" && echo "Found!"
```

### 2. Scripted Tool Calling

Use in shell scripts for automation:

```bash
#!/bin/bash

SERVER="./my-server.js"
TOOL="process-data"
PARAMS='{"input":"test.txt","format":"json"}'

# Call tool and extract result
RESULT=$(mcp-tester call-tool $TOOL node $SERVER --params "$PARAMS" --json | jq -r '.content[0].text')

echo "Result: $RESULT"
```

### 3. CI/CD Integration

Use in GitHub Actions or other CI systems:

```yaml
# .github/workflows/cli-test.yml
- name: Test MCP Server
  run: |
    # Test server connectivity
    mcp-tester test node ./dist/server.js || exit 1

    # Verify required tools exist
    mcp-tester lt node ./dist/server.js --json | jq -e '.tools[] | select(.name == "process")' || exit 1

    # Run smoke test
    mcp-tester call-tool health node ./dist/server.js --json | jq -e '.content[0].text == "OK"' || exit 1
```

### 4. Batch Testing

Test multiple tools in sequence:

```bash
# Test each tool from a JSON file
TOOLS=$(mcp-tester lt node ./server.js --json | jq -r '.tools[].name')

for tool in $TOOLS; do
  echo "Testing: $tool"
  mcp-tester call-tool $tool node ./server.js --params '{}' --timeout 5000 && echo "✓" || echo "✗"
done
```

### 5. Resource Verification

Verify server resources:

```bash
# List all resources
mcp-tester rr list node ./server.js  # if server has listResources tool

# Read each resource
RESOURCES=$(mcp-tester lt node ./server.js --json | jq -r '.resources[].uri')

for uri in $RESOURCES; do
  echo "Reading: $uri"
  mcp-tester rr "$uri" node ./server.js --json
done
```

### 6. Prompt Testing

Test prompt templates:

```bash
# Test greet prompt
mcp-tester gp greet node ./server.js --args '{"name":"Developer"}' --json | jq '.messages[0].content.text'

# Test summarize with long text
mcp-tester gp summarize node ./server.js --args '{"text":"Lorem ipsum..."}' --json | jq '.messages[].content.text'

# Validate prompt arguments
mcp-tester gp complex-prompt node ./server.js --args '{"required1":"value1","optional2":"value2"}' --json
```

### 7. Debugging Server Issues

Debug connection and runtime problems:

```bash
# Full debug output
mcp-tester test node ./server.js --verbose --log-level debug

# Capture to file
mcp-tester test node ./server.js --verbose 2>&1 | tee debug.log

# Check specific tool with debug
mcp-tester ct problematic-tool node ./server.js --params '{}' --verbose --timeout 60000 2>&1 | tee tool-debug.log

# Monitor over time
while true; do
  clear
  echo "=== $(date) ==="
  mcp-tester test node ./server.js --timeout 5000
  sleep 10
done
```

### 8. Timeout Testing

Test server behavior under timeout conditions:

```bash
# Very short timeout (expect failure)
mcp-tester call-tool slow-operation node ./server.js --params '{}' --timeout 1000

# Normal timeout
mcp-tester call-tool slow-operation node ./server.js --params '{"duration":5000}' --timeout 10000

# Long timeout for slow operations
mcp-tester call-tool batch-process node ./server.js --params '{"items":100}' --timeout 120000
```

---

## Error Messages

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `❌ Server failed to start` | Server process exited immediately | Check server path, dependencies |
| `❌ Request timed out` | Server didn't respond in time | Increase `--timeout` or check server |
| `❌ Unknown tool: <name>` | Tool not registered on server | Run `list-tools` to see available |
| `❌ Resource not found: <uri>` | Resource URI not registered | Run `test` to see available resources |
| `❌ Invalid JSON for --params` | Malformed JSON passed | Use valid JSON: `'{"key":"value"}'` |
| `❌ Invalid JSON for --args` | Malformed JSON passed | Use valid JSON: `'{"arg":"value"}'` |

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Error (connection, tool failure, etc.) |

---

## Tips & Tricks

### Use Short Aliases in Scripts

```bash
# Full names (more readable)
mcp-tester list-tools node ./server.js
mcp-tester call-tool echo node ./server.js --params '{}'

# Short aliases (faster typing)
mcp-tester lt node ./server.js
mcp-tester ct echo node ./server.js --params '{}'
```

### Parse JSON Output

```bash
# Extract tool names
mcp-tester lt node ./server.js --json | jq -r '.tools[].name'

# Check tool exists
mcp-tester lt node ./server.js --json | jq -e '.tools[] | select(.name == "my-tool")' > /dev/null && echo "Found"

# Extract result text
mcp-tester ct echo node ./server.js --params '{"message":"hi"}' --json | jq -r '.content[0].text'
```

### Combine with jq for Data Processing

```bash
# Count tools
mcp-tester lt node ./server.js --json | jq '.tools | length'

# List tool names and descriptions
mcp-tester lt node ./server.js --json | jq '.tools[] | "\(.name): \(.description)"'

# Get parameter names for a tool
mcp-tester lt node ./server.js --json | jq '.tools[] | select(.name == "my-tool") | .inputSchema.properties | keys[]'
```

### Environment Variables in Server Command

```bash
# Pass env vars to server
API_KEY=secret mcp-tester test node ./server.js

# Or use env section
mcp-tester test node ./server.js --timeout 30000
```

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `--help` / `-h` | Show help |
| `--version` / `-V` | Show version |

---

## See Also

- [README.md](./README.md) — Project overview and library documentation
- [AGENTS.md](./AGENTS.md) — Documentation for AI agents
- [MCP Specification](https://spec.modelcontextprotocol.io) — Official MCP protocol
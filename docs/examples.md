# Examples

Practical code examples for common MCP Tester use cases.

## Basic Tool Testing

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

## Resource Reading

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

## Using Prompts

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

## Complete Jest Test Suite

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

  it('should handle timeouts', async () => {
    await expect(
      client.callTool({ name: 'slow-tool', arguments: {}, timeout: 1 })
    ).rejects.toThrow();
  });
});
```

## Running the Examples

```bash
# Basic functionality test
npx tsx examples/basic-test.ts

# Full capabilities test
npx tsx examples/full-test.ts

# Test against a real MCP server (server-everything)
npx tsx examples/everything-server-test.ts

# Run mock server standalone (for manual testing)
node examples/mock-server.js
```

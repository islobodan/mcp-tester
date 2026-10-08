/**
 * Minimal MCP server test scaffold.
 *
 * Demonstrates:
 *   - Starting a stdio MCP server
 *   - Listing tools
 *   - Calling a tool
 *   - Cleanup
 */

import { MCPClient, setupJestMatchers } from '@slbdn/mcp-tester';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const serverPath = join(here, '..', 'examples', 'mock-server.js');

describe('Mock MCP server', () => {
  let client: MCPClient;

  beforeAll(async () => {
    setupJestMatchers();
    client = new MCPClient({
      name: 'minimal-test',
      version: '0.1.0',
      timeout: 10000,
    });
    await client.start({
      command: 'node',
      args: [serverPath],
    });
  });

  afterAll(async () => {
    if (client?.isConnected()) {
      await client.stop();
    }
  });

  it('should connect to the server', () => {
    expect(client.isConnected()).toBe(true);
  });

  it('should list at least one tool', async () => {
    const tools = await client.listTools();
    expect(tools.length).toBeGreaterThan(0);
  });

  it('should echo a message', async () => {
    const result = await client.callTool({
      name: 'echo',
      arguments: { message: 'hello' },
    });
    expect(result).toReturnText('hello');
  });

  it('should add two numbers', async () => {
    const result = await client.callTool({
      name: 'add',
      arguments: { a: 2, b: 3 },
    });
    expect(result).toReturnText('5');
  });
});
/**
 * Sample TypeScript MCP server — the one we test in this template.
 *
 * Tools:
 *   - greet(name): returns a greeting
 *   - sum(numbers): returns the sum of an array of numbers
 *   - uppercase(text): returns uppercase version of the input
 *
 * Run with: `npm run server` (for manual experimentation via an inspector)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  { name: 'full-stack-server', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'greet',
      description: 'Greet someone by name',
      inputSchema: {
        type: 'object',
        properties: { name: { type: 'string', description: 'Person to greet' } },
        required: ['name'],
      },
    },
    {
      name: 'sum',
      description: 'Sum an array of numbers',
      inputSchema: {
        type: 'object',
        properties: {
          numbers: {
            type: 'array',
            items: { type: 'number' },
            description: 'Numbers to add',
          },
        },
        required: ['numbers'],
      },
    },
    {
      name: 'uppercase',
      description: 'Convert text to uppercase',
      inputSchema: {
        type: 'object',
        properties: { text: { type: 'string' } },
        required: ['text'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  switch (name) {
    case 'greet':
      return { content: [{ type: 'text', text: `Hello, ${args.name}!` }] };
    case 'sum': {
      const numbers = (args.numbers as number[]) ?? [];
      const total = numbers.reduce((a, b) => a + b, 0);
      return { content: [{ type: 'text', text: String(total) }] };
    }
    case 'uppercase':
      return { content: [{ type: 'text', text: String(args.text).toUpperCase() }] };
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
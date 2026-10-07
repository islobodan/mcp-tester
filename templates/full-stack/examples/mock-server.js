#!/usr/bin/env node

/**
 * Plain-JS entry point for the server — used by tests that spawn via stdio.
 * Mirrors src/server.ts so tests can run without tsx in the spawn path.
 *
 * If you change src/server.ts, mirror it here.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  { name: 'full-stack-server', version: '1.0.0' },
  { capabilities: { tools: {}, resources: {}, prompts: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'greet',
      description: 'Greet someone by name',
      inputSchema: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      },
    },
    {
      name: 'sum',
      description: 'Sum an array of numbers',
      inputSchema: {
        type: 'object',
        properties: { numbers: { type: 'array', items: { type: 'number' } } },
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
      const numbers = args.numbers ?? [];
      const total = numbers.reduce((a, b) => a + b, 0);
      return { content: [{ type: 'text', text: String(total) }] };
    }
    case 'uppercase':
      return { content: [{ type: 'text', text: String(args.text).toUpperCase() }] };
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: 'config://version',
      name: 'version',
      description: 'Server version',
      mimeType: 'text/plain',
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  if (request.params.uri === 'config://version') {
    return {
      contents: [{ uri: 'config://version', mimeType: 'text/plain', text: '1.0.0' }],
    };
  }
  throw new Error(`Unknown resource: ${request.params.uri}`);
});

server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: [
    {
      name: 'welcome',
      description: 'A welcome prompt',
      arguments: [],
    },
  ],
}));

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  if (request.params.name === 'welcome') {
    return {
      messages: [{ role: 'assistant', content: { type: 'text', text: 'Welcome!' } }],
    };
  }
  throw new Error(`Unknown prompt: ${request.params.name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
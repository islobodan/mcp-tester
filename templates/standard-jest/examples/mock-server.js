#!/usr/bin/env node

/**
 * Standard mock MCP server — used by all test files in this template.
 *
 * Tools:
 *   - echo(message): returns the input message
 *   - add(a, b): returns the sum
 *   - slow(ms): waits N ms then returns (good for timeout tests)
 *
 * Resources:
 *   - config://version: returns "1.0.0"
 *
 * Prompts:
 *   - greet(user): returns a greeting
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
  { name: 'standard-mock-server', version: '1.0.0' },
  { capabilities: { tools: {}, resources: {}, prompts: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'echo',
      description: 'Echo back the input message',
      inputSchema: {
        type: 'object',
        properties: { message: { type: 'string' } },
        required: ['message'],
      },
    },
    {
      name: 'add',
      description: 'Add two numbers',
      inputSchema: {
        type: 'object',
        properties: {
          a: { type: 'number' },
          b: { type: 'number' },
        },
        required: ['a', 'b'],
      },
    },
    {
      name: 'slow',
      description: 'A slow tool for testing timeouts',
      inputSchema: {
        type: 'object',
        properties: { ms: { type: 'number', default: 100 } },
      },
    },
  ],
}));

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
    return { contents: [{ uri: 'config://version', mimeType: 'text/plain', text: '1.0.0' }] };
  }
  throw new Error(`Unknown resource: ${request.params.uri}`);
});

server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: [
    {
      name: 'greet',
      description: 'Greet a user by name',
      arguments: [{ name: 'user', description: 'Name', required: true }],
    },
  ],
}));

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  if (request.params.name === 'greet') {
    const user = String(request.params.arguments?.user ?? 'world');
    return {
      messages: [{ role: 'assistant', content: { type: 'text', text: `Hello, ${user}!` } }],
    };
  }
  throw new Error(`Unknown prompt: ${request.params.name}`);
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  switch (name) {
    case 'echo':
      return { content: [{ type: 'text', text: String(args.message) }] };
    case 'add':
      return { content: [{ type: 'text', text: String(Number(args.a) + Number(args.b)) }] };
    case 'slow':
      await new Promise((r) => setTimeout(r, Number(args.ms ?? 100)));
      return { content: [{ type: 'text', text: `waited ${args.ms ?? 100}ms` }] };
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
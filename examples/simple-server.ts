#!/usr/bin/env node

/**
 * Simple TypeScript MCP Server
 *
 * A minimal MCP server implementation in TypeScript showing:
 * - Single tool with typed input schema
 * - One resource
 * - One prompt
 * - Clean error handling
 *
 * Run: npx tsx examples/simple-server.ts
 * Test: npx @slbdn/mcp-tester -- node --loader tsx examples/simple-server.ts
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
  { name: 'simple-server', version: '1.0.0' },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

// ── Tools ──────────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'greet',
      description: 'Greet someone by name',
      inputSchema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string' as const, description: 'Name to greet' },
        },
        required: ['name'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'greet') {
    const name = String(request.params.arguments?.name ?? 'World');
    return {
      content: [{ type: 'text' as const, text: `Hello, ${name}!` }],
    };
  }
  throw new Error(`Unknown tool: ${request.params.name}`);
});

// ── Resources ──────────────────────────────────────────────────────────────

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: 'app://version',
      name: 'Version',
      description: 'Server version info',
      mimeType: 'application/json',
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  if (request.params.uri === 'app://version') {
    return {
      contents: [
        {
          uri: 'app://version',
          mimeType: 'application/json',
          text: JSON.stringify({ name: 'simple-server', version: '1.0.0' }, null, 2),
        },
      ],
    };
  }
  throw new Error(`Unknown resource: ${request.params.uri}`);
});

// ── Prompts ────────────────────────────────────────────────────────────────

server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: [
    {
      name: 'welcome',
      description: 'Generate a welcome message',
      arguments: [
        { name: 'name', description: 'Person to welcome', required: true },
      ],
    },
  ],
}));

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  if (request.params.name === 'welcome') {
    const name = String(request.params.arguments?.name ?? 'Friend');
    return {
      messages: [
        {
          role: 'user' as const,
          content: { type: 'text' as const, text: `Welcome, ${name}! How can I help you today?` },
        },
      ],
    };
  }
  throw new Error(`Unknown prompt: ${request.params.name}`);
});

// ── Start ───────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Simple MCP server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
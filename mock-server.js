#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const server = new McpServer(
  {
    name: 'mock-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
      logging: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'echo',
        description: 'Echo back the input',
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Message to echo',
            },
          },
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
        name: 'delay',
        description: 'Delay for specified milliseconds',
        inputSchema: {
          type: 'object',
          properties: {
            ms: { type: 'number' },
          },
          required: ['ms'],
        },
      },
      {
        name: 'error_tool',
        description: 'Always returns an error',
        inputSchema: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
          required: ['message'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'echo') {
    return {
      content: [{ type: 'text', text: `Echo: ${args?.message}` }],
    };
  }

  if (name === 'add') {
    const a = args?.a as number;
    const b = args?.b as number;
    return {
      content: [{ type: 'text', text: `${a} + ${b} = ${a + b}` }],
    };
  }

  if (name === 'delay') {
    const ms = args?.ms as number;
    await new Promise((resolve) => setTimeout(resolve, ms));
    return {
      content: [{ type: 'text', text: `Delayed for ${ms}ms` }],
    };
  }

  if (name === 'error_tool') {
    throw new Error(args?.message || 'Tool error');
  }

  throw new Error(`Unknown tool: ${name}`);
});

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'text://example',
        name: 'Example Text Resource',
        description: 'A simple text resource',
        mimeType: 'text/plain',
      },
      {
        uri: 'config://settings',
        name: 'Settings',
        description: 'Configuration settings',
        mimeType: 'application/json',
      },
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  if (uri === 'text://example') {
    return {
      contents: [
        {
          uri,
          mimeType: 'text/plain',
          text: 'This is example content from the resource.',
        },
      ],
    };
  }

  if (uri === 'config://settings') {
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({ setting1: 'value1', setting2: 'value2' }, null, 2),
        },
      ],
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
});

server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: 'greet',
        description: 'Greet someone',
        arguments: [
          {
            name: 'name',
            description: 'Name to greet',
            required: true,
          },
        ],
      },
      {
        name: 'summarize',
        description: 'Summarize text',
        arguments: [
          {
            name: 'text',
            description: 'Text to summarize',
            required: true,
          },
        ],
      },
    ],
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'greet') {
    const userName = args?.name || 'World';
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Hello, ${userName}! How are you today?`,
          },
        },
      ],
    };
  }

  if (name === 'summarize') {
    const text = args?.text || '';
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Please summarize: ${text}`,
          },
        },
      ],
    };
  }

  throw new Error(`Unknown prompt: ${name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Mock MCP server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});

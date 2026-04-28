#!/usr/bin/env node

/**
 * Stateful MCP Server — demonstrates server-side state that changes between calls.
 *
 * Features:
 * - Counter tool (increment/get/reset)
 * - Todo list tool (add/list/complete)
 * - Stats resource (live counter and task stats)
 * - Each call modifies server state → results change across calls
 *
 * Run: npx tsx examples/stateful-server.ts
 * Test with mcp-tester:
 *   const client = new MCPClient();
 *   await client.start({ command: 'node', args: ['--loader', 'tsx', 'examples/stateful-server.ts'] });
 *   // or after building: node dist/examples/stateful-server.js
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// ── Server state ───────────────────────────────────────────────────────────

let counter = 0;

interface Todo {
  id: number;
  text: string;
  done: boolean;
}

const todos: Todo[] = [];
let nextTodoId = 1;

// ── Server setup ────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'stateful-server', version: '1.0.0' },
  {
    capabilities: {
      tools: {},
      resources: {},
      logging: {},
    },
  }
);

// ── Tools ───────────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'counter_increment',
      description: 'Increment the server-side counter by a value (default 1)',
      inputSchema: {
        type: 'object' as const,
        properties: {
          amount: { type: 'number' as const, description: 'Amount to add (default 1)' },
        },
      },
    },
    {
      name: 'counter_get',
      description: 'Get the current counter value',
      inputSchema: { type: 'object' as const, properties: {} },
    },
    {
      name: 'counter_reset',
      description: 'Reset the counter to zero',
      inputSchema: { type: 'object' as const, properties: {} },
    },
    {
      name: 'todo_add',
      description: 'Add a new todo item',
      inputSchema: {
        type: 'object' as const,
        properties: {
          text: { type: 'string' as const, description: 'Todo text' },
        },
        required: ['text'],
      },
    },
    {
      name: 'todo_list',
      description: 'List all todo items',
      inputSchema: { type: 'object' as const, properties: {} },
    },
    {
      name: 'todo_complete',
      description: 'Mark a todo item as completed',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'number' as const, description: 'Todo ID to complete' },
        },
        required: ['id'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'counter_increment': {
      const amount = Number(args?.amount ?? 1);
      counter += amount;
      await server.notification({ method: 'notifications/message', params: { level: 'info', data: `Counter incremented by ${amount}` } });
      return {
        content: [{ type: 'text' as const, text: `Counter: ${counter} (incremented by ${amount})` }],
      };
    }

    case 'counter_get':
      return {
        content: [{ type: 'text' as const, text: `Counter: ${counter}` }],
      };

    case 'counter_reset':
      counter = 0;
      return {
        content: [{ type: 'text' as const, text: 'Counter reset to 0' }],
      };

    case 'todo_add': {
      const text = String(args?.text ?? '');
      const todo: Todo = { id: nextTodoId++, text, done: false };
      todos.push(todo);
      return {
        content: [{ type: 'text' as const, text: `Added todo #${todo.id}: ${text}` }],
      };
    }

    case 'todo_list': {
      const lines = todos.map((t) => `${t.done ? '✓' : '○'} #${t.id}: ${t.text}`);
      return {
        content: [{ type: 'text' as const, text: lines.length ? lines.join('\n') : 'No todos yet' }],
      };
    }

    case 'todo_complete': {
      const id = Number(args?.id);
      const todo = todos.find((t) => t.id === id);
      if (!todo) {
        return {
          content: [{ type: 'text' as const, text: `Todo #${id} not found` }],
          isError: true,
        };
      }
      todo.done = true;
      return {
        content: [{ type: 'text' as const, text: `Completed todo #${todo.id}: ${todo.text}` }],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// ── Resources ──────────────────────────────────────────────────────────────

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: 'stats://server',
      name: 'Server Stats',
      description: 'Live server statistics (counter + todos)',
      mimeType: 'application/json',
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  if (request.params.uri === 'stats://server') {
    return {
      contents: [
        {
          uri: 'stats://server',
          mimeType: 'application/json',
          text: JSON.stringify({
            counter,
            totalTodos: todos.length,
            completedTodos: todos.filter((t) => t.done).length,
            pendingTodos: todos.filter((t) => !t.done).length,
          }, null, 2),
        },
      ],
    };
  }
  throw new Error(`Unknown resource: ${request.params.uri}`);
});

// ── Start ───────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Stateful MCP server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
#!/usr/bin/env node
/**
 * Deterministic E2E fixture MCP server (TODO #27).
 *
 * Plain `.mjs`, plain Node, high-level `Server` + `StdioServerTransport` from
 * the SDK (same surface as `examples/mock-server.js`).
 *
 * Chaos is **env-selected and deterministic** — no randomness:
 *   E2E_CRASH_ON_TOOL  — tool name; when that tool is called, process.exit(70).
 *   E2E_HANG_ON_TOOL   — tool name; when that tool is called, never respond.
 *   E2E_FAIL_ONCE      — tool name; first call fails, later calls succeed.
 *   E2E_PID_FILE       — path; write process.pid at startup.
 *   E2E_TOKEN          — secret; returned by `env_dump`.
 *
 * Tool inventory (all validated server-side):
 *   echo, echo_large, sum_large, deep_nest, unicode_echo,
 *   counter_increment, counter_get, counter_reset,
 *   todo_add, todo_list, todo_complete,
 *   env_dump, call_stats, pid_dump,
 *   crash_now, hang_now, fail_once_tool
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

const env = process.env;

const state = { counter: 0, todos: [] };
const callCounts = new Map();
let failOnceUsed = false;

const DETERMINISTIC_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

function deterministicString(size) {
  let out = '';
  for (let i = 0; i < size; i += 1) {
    out += DETERMINISTIC_ALPHABET[i % DETERMINISTIC_ALPHABET.length];
  }
  return out;
}

function makeNested(depth) {
  let node = { leaf: true };
  for (let i = 0; i < depth; i += 1) {
    node = { level: i, child: node };
  }
  return node;
}

const server = new Server(
  { name: 'e2e-server', version: '1.0.0' },
  { capabilities: { tools: {}, resources: {}, prompts: {}, logging: {} } }
);

function recordCall(name) {
  callCounts.set(name, (callCounts.get(name) ?? 0) + 1);
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const base = [
    {
      name: 'echo',
      description: 'Echo back the input message',
      inputSchema: {
        type: 'object',
        properties: { message: { type: 'string', description: 'Message to echo' } },
        required: ['message'],
      },
    },
    {
      name: 'echo_large',
      description: 'Echo back a deterministic string of the requested size (chars)',
      inputSchema: {
        type: 'object',
        properties: { size: { type: 'number', description: 'Character count of the output string' } },
        required: ['size'],
      },
    },
    {
      name: 'sum_large',
      description: 'Sum an array of numbers',
      inputSchema: {
        type: 'object',
        properties: { numbers: { type: 'array', items: { type: 'number' } } },
        required: ['numbers'],
      },
    },
    {
      name: 'deep_nest',
      description: 'Return a nested structure depth levels deep',
      inputSchema: {
        type: 'object',
        properties: { depth: { type: 'number', description: 'Nesting depth (0 = flat object)' } },
        required: ['depth'],
      },
    },
    {
      name: 'unicode_echo',
      description: 'Echo back a unicode message',
      inputSchema: {
        type: 'object',
        properties: { message: { type: 'string', description: 'Unicode message' } },
        required: ['message'],
      },
    },
    {
      name: 'counter_increment',
      description: 'Increment the counter (positive or negative)',
      inputSchema: {
        type: 'object',
        properties: { amount: { type: 'number', description: 'Amount to add (default 1)' } },
      },
    },
    {
      name: 'counter_get',
      description: 'Read the counter',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'counter_reset',
      description: 'Reset the counter to zero',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'todo_add',
      description: 'Add a todo',
      inputSchema: {
        type: 'object',
        properties: { text: { type: 'string', description: 'Todo text' }, done: { type: 'boolean', description: 'Mark done immediately' } },
      },
      required: ['text'],
    },
    {
      name: 'todo_list',
      description: 'List todos',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'todo_complete',
      description: 'Mark a todo complete by index',
      inputSchema: {
        type: 'object',
        properties: { index: { type: 'number', description: 'Todo index' } },
        required: ['index'],
      },
    },
    {
      name: 'env_dump',
      description: 'Dump the E2E_TOKEN env var',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'call_stats',
      description: 'Return per-tool call counts',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'pid_dump',
      description: 'Return this server process pid',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'crash_now',
      description: 'Crash the server now (env: E2E_CRASH_ON_TOOL)',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'hang_now',
      description: 'Hang forever (env: E2E_HANG_ON_TOOL)',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'fail_once_tool',
      description: 'Fail once (env: E2E_FAIL_ONCE)',
      inputSchema: { type: 'object', properties: {} },
    },
  ];

  return { tools: base };
});

async function sendLog(level, data) {
  try {
    await server.sendLoggingMessage({ level, logger: 'e2e', data });
  } catch {
    // Notifications are best-effort; ignore if the client has no logger handler yet.
  }
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (env.E2E_CRASH_ON_TOOL && name === env.E2E_CRASH_ON_TOOL) {
    process.exit(70);
  }
  if (env.E2E_HANG_ON_TOOL && name === env.E2E_HANG_ON_TOOL) {
    await new Promise(() => {});
  }
  if (env.E2E_FAIL_ONCE && name === env.E2E_FAIL_ONCE && !failOnceUsed) {
    failOnceUsed = true;
    throw new Error('E2E_FAIL_ONCE simulated failure');
  }

  switch (name) {
    case 'echo': {
      recordCall(name);
      return { content: [{ type: 'text', text: `Echo: ${args?.message ?? ''}` }] };
    }
    case 'echo_large': {
      recordCall(name);
      const size = Math.max(0, Math.min(Number(args?.size) || 0, 2_000_000));
      return { content: [{ type: 'text', text: deterministicString(size) }] };
    }
    case 'sum_large': {
      recordCall(name);
      const nums = Array.isArray(args?.numbers) ? args.numbers.map(Number) : [];
      const sum = nums.reduce((acc, n) => acc + (Number.isFinite(n) ? n : 0), 0);
      return { content: [{ type: 'text', text: `Sum: ${sum}` }] };
    }
    case 'deep_nest': {
      recordCall(name);
      const depth = Math.max(0, Math.min(Number(args?.depth) || 0, 500));
      return { content: [{ type: 'text', text: JSON.stringify(makeNested(depth)) }] };
    }
    case 'unicode_echo': {
      recordCall(name);
      return { content: [{ type: 'text', text: `Echo: ${args?.message ?? ''}` }] };
    }
    case 'counter_increment': {
      recordCall(name);
      const amount = Number(args?.amount ?? 1);
      state.counter += amount;
      await sendLog('info', `Counter incremented by ${amount} → now ${state.counter}`);
      return { content: [{ type: 'text', text: `Counter: ${state.counter}` }] };
    }
    case 'counter_get': {
      recordCall(name);
      return { content: [{ type: 'text', text: `Counter: ${state.counter}` }] };
    }
    case 'counter_reset': {
      recordCall(name);
      state.counter = 0;
      return { content: [{ type: 'text', text: 'Counter: 0' }] };
    }
    case 'todo_add': {
      recordCall(name);
      const todo = { text: String(args?.text ?? ''), done: Boolean(args?.done) };
      state.todos.push(todo);
      return { content: [{ type: 'text', text: `Added todo ${state.todos.length}` }] };
    }
    case 'todo_list': {
      recordCall(name);
      const items = state.todos.map((t, i) => `${i}: ${t.text}${t.done ? ' ✓' : ''}`).join('\n');
      return { content: [{ type: 'text', text: items || '(no todos)' }] };
    }
    case 'todo_complete': {
      recordCall(name);
      const idx = Number(args?.index);
      if (Number.isInteger(idx) && idx >= 0 && idx < state.todos.length) {
        state.todos[idx].done = true;
      }
      return { content: [{ type: 'text', text: 'completed' }] };
    }
    case 'env_dump': {
      recordCall(name);
      return { content: [{ type: 'text', text: `E2E_TOKEN=${env.E2E_TOKEN ?? ''}` }] };
    }
    case 'call_stats': {
      recordCall(name);
      const obj = {};
      for (const [k, v] of callCounts) obj[k] = v;
      return { content: [{ type: 'text', text: JSON.stringify(obj) }] };
    }
    case 'pid_dump': {
      recordCall(name);
      return { content: [{ type: 'text', text: String(process.pid) }] };
    }
    case 'fail_once_tool': {
      // The fail-once chaos above consumed the single failure; reaching this
      // case means the retry (if any) succeeded and we return normally.
      recordCall(name);
      return { content: [{ type: 'text', text: 'recovered-after-fail-once' }] };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: [] }));
server.setRequestHandler(ReadResourceRequestSchema, async () => ({ contents: [] }));
server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: [] }));
server.setRequestHandler(GetPromptRequestSchema, async () => ({ messages: [] }));

if (env.E2E_PID_FILE) {
  try {
    const fs = await import('node:fs');
    fs.writeFileSync(env.E2E_PID_FILE, String(process.pid));
  } catch {
    // best-effort
  }
}

const transport = new StdioServerTransport();
await server.connect(transport);

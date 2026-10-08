import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js';
import { MCPClient } from '../client/MCPClient.js';
import { validateServerConfig } from '../utils/validation.js';

interface JsonRpcMessage {
  jsonrpc: string;
  id?: number | string;
  method?: string;
  params?: unknown;
}

/**
 * Minimal in-process WebSocket double that speaks just enough JSON-RPC to
 * satisfy the MCP client handshake. This keeps the test hermetic (no network,
 * no extra server process) and works on every supported Node version.
 */
class MockWebSocket {
  static instances: MockWebSocket[] = [];

  url: string | URL;
  protocol: string;
  readyState = 0;
  sent: JsonRpcMessage[] = [];

  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;

  constructor(url: string | URL, protocol?: string) {
    this.url = url;
    this.protocol = protocol ?? '';
    MockWebSocket.instances.push(this);
    queueMicrotask(() => {
      this.readyState = 1;
      this.onopen?.();
    });
  }

  send(data: string): void {
    const message = JSON.parse(data) as JsonRpcMessage;
    this.sent.push(message);
    if (message.id === undefined) return; // notification — no response

    let result: unknown;
    switch (message.method) {
      case 'initialize':
        result = {
          protocolVersion: LATEST_PROTOCOL_VERSION,
          capabilities: { tools: {}, resources: {}, prompts: {} },
          serverInfo: { name: 'mock-ws-server', version: '1.0.0' },
        };
        break;
      case 'ping':
        result = {};
        break;
      case 'tools/list':
        result = {
          tools: [{ name: 'echo', description: 'Echo a message', inputSchema: { type: 'object' } }],
        };
        break;
      case 'tools/call':
        result = { content: [{ type: 'text', text: 'echo from websocket' }] };
        break;
      default:
        result = {};
    }

    queueMicrotask(() =>
      this.onmessage?.({ data: JSON.stringify({ jsonrpc: '2.0', id: message.id, result }) })
    );
  }

  close(): void {
    this.readyState = 3;
    this.onclose?.();
  }
}

const originalWebSocket = (globalThis as unknown as { WebSocket?: unknown }).WebSocket;

beforeAll(() => {
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = MockWebSocket;
});

afterAll(() => {
  (globalThis as unknown as { WebSocket?: unknown }).WebSocket = originalWebSocket;
});

describe('WebSocket transport', () => {
  let client: MCPClient;

  beforeEach(() => {
    MockWebSocket.instances = [];
    client = new MCPClient({ timeout: 5000, logLevel: 'none' });
  });

  afterEach(async () => {
    if (client.isConnected()) {
      await client.stop();
    }
  });

  it('connects using the WebSocket transport and the mcp subprotocol', async () => {
    await client.start({ transport: 'websocket', url: 'ws://localhost:3000' });

    expect(client.isConnected()).toBe(true);
    expect(client.getTransportType()).toBe('websocket');
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(String(MockWebSocket.instances[0].url)).toBe('ws://localhost:3000/');
    expect(MockWebSocket.instances[0].protocol).toBe('mcp');
  });

  it('lists tools over WebSocket', async () => {
    await client.start({ transport: 'websocket', url: 'ws://localhost:3000' });

    const tools = await client.listTools();
    expect(tools.map((tool) => tool.name)).toContain('echo');
  });

  it('calls a tool over WebSocket', async () => {
    await client.start({ transport: 'websocket', url: 'ws://localhost:3000' });

    const result = await client.callTool({ name: 'echo', arguments: { message: 'hi' } });
    expect((result.content[0] as { text?: string }).text).toBe('echo from websocket');
  });

  it('reports no local PID and a healthy connection', async () => {
    await client.start({ transport: 'websocket', url: 'ws://localhost:3000' });

    expect(client.getServerPid()).toBeNull();
    const health = await client.isHealthy();
    expect(health.healthy).toBe(true);
    expect(health.pid).toBeNull();
  });

  it('closes the socket on stop()', async () => {
    await client.start({ transport: 'websocket', url: 'ws://localhost:3000' });
    const socket = MockWebSocket.instances[0];

    await client.stop();

    expect(socket.readyState).toBe(3);
    expect(client.isConnected()).toBe(false);
  });
});

describe('WebSocket transport — config validation', () => {
  it('rejects an http(s) URL for the websocket transport', () => {
    expect(() =>
      validateServerConfig({ transport: 'websocket', url: 'http://localhost:3000' })
    ).toThrow(/ws or wss/);
  });

  it('accepts ws and wss URLs', () => {
    expect(() =>
      validateServerConfig({ transport: 'websocket', url: 'ws://localhost:3000' })
    ).not.toThrow();
    expect(() =>
      validateServerConfig({ transport: 'websocket', url: 'wss://example.com/mcp' })
    ).not.toThrow();
  });
});

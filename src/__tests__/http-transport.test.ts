import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { spawn, type ChildProcess } from 'child_process';
import { join } from 'path';
import { MCPClient } from '../client/MCPClient.js';
import type { HealthStatus } from '../client/MCPClient.js';

// Resolve server-everything entry point without import.meta.url (TS1343 in ts-jest)
const EVERYTHING_SERVER = join(
  process.cwd(),
  'node_modules',
  '@modelcontextprotocol',
  'server-everything',
  'dist',
  'index.js'
);

const HTTP_PORT = 3199;
const SSE_PORT = 3198;

let httpServer: ChildProcess | null = null;
let sseServer: ChildProcess | null = null;

/**
 * Wait for a server to be ready by polling the health endpoint.
 */
async function waitForServer(port: number, timeout = 10000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(`http://localhost:${port}/`);
      // Any response means the server is up
      if (res.status === 404 || res.ok || res.status === 405) return;
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Server on port ${port} did not start within ${timeout}ms`);
}

function startEverythingServer(transport: 'streamableHttp' | 'sse', port: number): ChildProcess {
  const proc = spawn('node', [EVERYTHING_SERVER, transport], {
    env: { ...process.env, PORT: String(port) },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  proc.stderr?.on('data', (data) => {
    // Uncomment for debugging:
    // console.error(`[server:${transport}] ${data.toString().trim()}`);
  });
  return proc;
}

describe('HTTP Transport — Streamable HTTP', () => {
  let client: MCPClient;

  beforeAll(async () => {
    httpServer = startEverythingServer('streamableHttp', HTTP_PORT);
    await waitForServer(HTTP_PORT);
  }, 15000);

  afterAll(() => {
    if (httpServer) {
      httpServer.kill('SIGTERM');
      httpServer = null;
    }
  });

  beforeEach(() => {
    client = new MCPClient({ timeout: 10000, logLevel: 'none' });
  });

  afterEach(async () => {
    if (client.isConnected()) {
      await client.stop();
    }
  });

  it('should connect via streamable HTTP', async () => {
    await client.start({
      transport: 'http',
      url: `http://localhost:${HTTP_PORT}/mcp`,
    });
    expect(client.isConnected()).toBe(true);
    expect(client.getTransportType()).toBe('http');
  });

  it('should list tools via HTTP', async () => {
    await client.start({
      transport: 'http',
      url: `http://localhost:${HTTP_PORT}/mcp`,
    });
    const tools = await client.listTools();
    expect(tools.length).toBeGreaterThan(0);
    const names = tools.map((t) => t.name);
    expect(names).toContain('echo');
  });

  it('should call a tool via HTTP', async () => {
    await client.start({
      transport: 'http',
      url: `http://localhost:${HTTP_PORT}/mcp`,
    });
    const result = await client.callTool({
      name: 'echo',
      arguments: { message: 'hello-http' },
    });
    expect(result.content[0]).toBeDefined();
    const text = (result.content[0] as { text?: string }).text;
    expect(text).toContain('hello-http');
  });

  it('should list resources via HTTP', async () => {
    await client.start({
      transport: 'http',
      url: `http://localhost:${HTTP_PORT}/mcp`,
    });
    const resources = await client.listResources();
    expect(resources.length).toBeGreaterThan(0);
  });

  it('should read a resource via HTTP', async () => {
    await client.start({
      transport: 'http',
      url: `http://localhost:${HTTP_PORT}/mcp`,
    });
    // List resources first to get a valid URI
    const resources = await client.listResources();
    expect(resources.length).toBeGreaterThan(0);
    const result = await client.readResource(resources[0].uri);
    expect(result.contents).toBeDefined();
    expect(result.contents.length).toBeGreaterThan(0);
  });

  it('should list prompts via HTTP', async () => {
    await client.start({
      transport: 'http',
      url: `http://localhost:${HTTP_PORT}/mcp`,
    });
    const prompts = await client.listPrompts();
    expect(prompts.length).toBeGreaterThan(0);
  });

  it('should get a prompt via HTTP', async () => {
    await client.start({
      transport: 'http',
      url: `http://localhost:${HTTP_PORT}/mcp`,
    });
    const result = await client.getPrompt('simple-prompt', {});
    expect(result.messages).toBeDefined();
    expect(result.messages.length).toBeGreaterThan(0);
  });

  it('should run health check via HTTP', async () => {
    await client.start({
      transport: 'http',
      url: `http://localhost:${HTTP_PORT}/mcp`,
    });
    const health = await client.isHealthy();
    expect(health.healthy).toBe(true);
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    // HTTP transport has no local PID
    expect(health.pid).toBeNull();
  });

  it('should return null for getServerPid on HTTP transport', async () => {
    await client.start({
      transport: 'http',
      url: `http://localhost:${HTTP_PORT}/mcp`,
    });
    expect(client.getServerPid()).toBeNull();
  });

  it('should handle retry logic via HTTP', async () => {
    const retryClient = new MCPClient({
      timeout: 5000,
      retries: 2,
      retryDelay: 100,
      logLevel: 'none',
    });
    try {
      await retryClient.start({
        transport: 'http',
        url: `http://localhost:${HTTP_PORT}/mcp`,
      });
      const result = await retryClient.callTool({
        name: 'echo',
        arguments: { message: 'retry-test' },
      });
      expect(result.content[0]).toBeDefined();
    } finally {
      if (retryClient.isConnected()) {
        await retryClient.stop();
      }
    }
  });

  it('should fail to connect to a non-existent server', async () => {
    await expect(
      client.start({
        transport: 'http',
        url: 'http://localhost:59999/mcp',
      })
    ).rejects.toThrow();
  });
});

describe('HTTP Transport — SSE (legacy)', () => {
  let client: MCPClient;

  beforeAll(async () => {
    sseServer = startEverythingServer('sse', SSE_PORT);
    await waitForServer(SSE_PORT);
  }, 15000);

  afterAll(() => {
    if (sseServer) {
      sseServer.kill('SIGTERM');
      sseServer = null;
    }
  });

  beforeEach(() => {
    client = new MCPClient({ timeout: 10000, logLevel: 'none' });
  });

  afterEach(async () => {
    if (client.isConnected()) {
      await client.stop();
    }
  });

  it('should connect via SSE', async () => {
    await client.start({
      transport: 'sse',
      url: `http://localhost:${SSE_PORT}/sse`,
    });
    expect(client.isConnected()).toBe(true);
    expect(client.getTransportType()).toBe('sse');
  });

  it('should list tools via SSE', async () => {
    await client.start({
      transport: 'sse',
      url: `http://localhost:${SSE_PORT}/sse`,
    });
    const tools = await client.listTools();
    expect(tools.length).toBeGreaterThan(0);
  });

  it('should call a tool via SSE', async () => {
    await client.start({
      transport: 'sse',
      url: `http://localhost:${SSE_PORT}/sse`,
    });
    const result = await client.callTool({
      name: 'echo',
      arguments: { message: 'hello-sse' },
    });
    expect(result.content[0]).toBeDefined();
    const text = (result.content[0] as { text?: string }).text;
    expect(text).toContain('hello-sse');
  });

  it('should run health check via SSE', async () => {
    await client.start({
      transport: 'sse',
      url: `http://localhost:${SSE_PORT}/sse`,
    });
    const health = await client.isHealthy();
    expect(health.healthy).toBe(true);
    expect(health.pid).toBeNull(); // No PID for SSE
  });
});

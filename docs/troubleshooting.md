# Troubleshooting

## Common Issues

### "Client not started" Error

**Problem:** Calling methods before `start()`

```typescript
// ✗ Wrong
const client = new MCPClient();
const tools = await client.listTools(); // Error!

// ✓ Correct
const client = new MCPClient();
await client.start({ command: 'node', args: ['./server.js'] });
const tools = await client.listTools(); // Works
```

### Timeout Errors

**Problem:** Requests timing out

```typescript
// Increase global timeout
const client = new MCPClient({ timeout: 60000 });

// Or per-call timeout
await client.callTool({
  name: 'slow-tool',
  arguments: {},
  timeout: 30000,
});
```

### Server Process Fails to Start

**Problem:** Server command not found or crashes immediately

```bash
# Verify server exists and runs standalone
ls -la ./my-server.js
node ./my-server.js
```

### "Module not found" Errors

**Problem:** ESM import without `.js` extension

```typescript
// ✗ Wrong
import { MCPClient } from './client/MCPClient';

// ✓ Correct
import { MCPClient } from './client/MCPClient.js';
```

### TypeScript Build Errors

```bash
# Clean and rebuild
rm -rf dist/
npm run build
```

### Server Crashes During Tests

**Problem:** Server process dies mid-test, but `isConnected()` still returns `true`

```typescript
// Use health checks to detect zombie processes
const health = await client.isHealthy();
if (!health.healthy) {
  console.error(`Server died: ${health.message}`);
  await client.stop();
  await client.start({ command: 'node', args: ['./server.js'] });
}

// Or use periodic monitoring
client.startHealthMonitor({
  interval: 3000,
  onUnhealthy: () => { throw new Error('Server crashed during tests'); },
});
```

### Tests Fail in CI but Pass Locally

- Check Node.js version matches (>= 20)
- Verify server paths are correct
- Ensure environment variables are set
- Check `maxWorkers: 1` in Jest config (avoids SIGSEGV crashes)

## Debug Mode

Enable verbose logging:

```typescript
const client = new MCPClient({
  logLevel: 'debug',
  enableProtocolLogging: true,
});
```

All log output goes to stderr.

## Test Coverage

```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

Coverage thresholds: **80%** for branches, functions, lines, and statements.

## Known Limitations

- Supports **stdio**, **Streamable HTTP**, **SSE**, and **WebSocket** transports
- Node.js by default; the HTTP/SSE/WebSocket transports also run in browsers and edge runtimes (see [Browser Support](./browser.md))
- Mock server has configurable delays, failures, stateful tools, and validation

## Vitest

Custom matchers work with Vitest. Use `setupVitestMatchers()` and add the type declarations:

```typescript
import { setupVitestMatchers } from '@slbdn/mcp-tester';
import { beforeAll } from 'vitest';
// /// <reference types="@slbdn/mcp-tester/vitest" />

beforeAll(() => setupVitestMatchers());
```

If you get TypeScript errors with custom matchers, make sure your `tsconfig.json` includes the `vitest.d.ts` from the package:

```json
{
  "include": ["node_modules/@slbdn/mcp-tester/vitest.d.ts"]
}
```

## Browser and Edge Runtimes

**"Module not found: node:child_process" / "cross-spawn" in a browser build**
Your bundler is not honouring the `browser` field. Ensure it targets `browser`
(Webpack `target: 'web'`, Vite `build.target` not `ssr`, esbuild
`platform: 'browser'`). The repo's `npm run test:browser` script is a minimal
reference. Do not import `@slbdn/mcp-tester/dist/...` deep paths — import the
package root so the browser entry point is selected.

**"WebSocket is not defined" (Node.js)**
The WebSocket transport needs a global `WebSocket`. Node.js 22+ provides one;
on older versions enable it with `--experimental-websocket` or set a polyfill
such as `ws` on `globalThis`.

**CORS errors against a remote MCP server**
The server must allow your origin and, for Streamable HTTP, the
`mcp-session-id` header. This is a browser/network constraint — configure the
server, not the client.

See [Browser Support](./browser.md) for the full matrix.

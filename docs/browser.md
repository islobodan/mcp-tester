# Browser Support

`mcp-tester` can run inside browser and edge runtimes to test MCP servers over
network transports. This is useful for:

- Component/unit tests that run in a real browser (Vitest browser mode, Karma,
  Playwright component testing, Web Test Runner).
- In-browser debugging or smoke checks of a remote MCP server.
- Edge runtimes (Cloudflare Workers, Deno Deploy, Vercel Edge) that expose
  `fetch` and `WebSocket`.

## How it works

The package declares a `browser` field in `package.json`:

```json
"browser": {
  "./dist/index.js": "./dist/browser.js",
  "./dist/utils/stdio-transport.js": false
}
```

When a bundler targets the browser it resolves the package entry to
`dist/browser.js` and replaces the Node-only stdio transport with an empty
module. You import the package exactly as you would on Node:

```typescript
import { MCPClient, assert } from '@slbdn/mcp-tester';

const client = new MCPClient();
await client.start({ transport: 'http', url: 'https://api.example.com/mcp' });

const result = await client.callTool({ name: 'echo', arguments: { message: 'hi' } });
assert.toolTextContains(result, 'hi');

await client.stop();
```

Webpack, Vite, Rollup, esbuild, Parcel, and Rspack all honor the `browser`
field. The repository's CI runs `npm run test:browser`, which bundles the
package with esbuild using `platform: 'browser'` and fails if any Node built-in
(`node:*`) or the stdio transport (`cross-spawn`) leaks into the bundle.

## Transports

| Transport | Browser | Notes |
|-----------|:-------:|-------|
| `http` (Streamable HTTP) | ✅ | Uses `fetch` + `ReadableStream`. Recommended for remote servers. |
| `sse` (legacy) | ✅ | Uses `fetch` + `EventSource` semantics. |
| `websocket` | ✅ | Uses the global `WebSocket` API. |
| `stdio` | ❌ | Spawns a local process; Node.js only. |

### Streamable HTTP

```typescript
await client.start({
  transport: 'http',
  url: 'https://api.example.com/mcp',
  headers: { Authorization: 'Bearer token' },
});
```

### WebSocket

```typescript
await client.start({
  transport: 'websocket',
  url: 'wss://api.example.com/mcp',
});
```

The client connects using the `mcp` WebSocket subprotocol, matching the MCP
SDK's `WebSocketClientTransport`.

> **Node.js note:** the WebSocket transport needs a global `WebSocket`.
> Node.js 22+ provides one. On older Node versions use `--experimental-websocket`
> or a polyfill such as [`ws`](https://www.npmjs.com/package/ws) installed on
> `globalThis`.

## What is included

The browser entry point (`dist/browser.js`) exports the browser-safe subset:

- `MCPClient` and all client types (`ServerConfig`, `StreamableHttpServerConfig`,
  `SseServerConfig`, `WebSocketServerConfig`, `MCPClientOptions`, `HealthStatus`, …)
- Custom matchers (`toHaveTool`, `toReturnText`, `setupVitestMatchers`, …)
- The `assert` module
- Error classes (`MCPClientError`, `MCPTimeoutError`, …)
- Logging/masking utilities (`startTimer`, `prettyPrint`, `maskSecrets`, …)
- The deterministic edge-case generator (`suggestEdgeCases`, `generateToolArgs`, …)

## What is Node-only

These are intentionally excluded and tree-shaken from browser bundles:

- **stdio transport** — spawns a child process via `cross-spawn`.
- **`generateTests` / `generateTypes`** — read/write files and read the package
  version from disk.
- **AI provider** (`OpenAICompatProvider`, `createProviderFromEnv`) — uses
  `node:crypto`, `node:fs`, and `node:path`.

If you need test generation in a browser workflow, generate the files in a Node
step (CLI or script) and run the generated tests in the browser.

## Limitations

- **No stdio.** Browsers cannot spawn processes. Use `http`, `sse`, or
  `websocket`.
- **CORS applies.** The MCP server must send appropriate
  `Access-Control-Allow-Origin` headers (and allow the `mcp-session-id` header
  for Streamable HTTP). This is a browser/network constraint, not a limitation
  of this library.
- **File-based caching is unavailable.** The AI provider (Node-only) writes a
  cache to disk; in-browser code paths do not touch the filesystem.
- **`process`-based features degrade gracefully.** Health checks for stdio PIDs
  return `null`, and logging falls back to a non-TTY format.

## Testing from Node

You can exercise the browser-safe entry point from Node without a browser. The
repository's `test:browser` script is a good template; a focused version is:

```js
import { build } from 'esbuild';

await build({
  entryPoints: ['src/entry.ts'],
  bundle: true,
  platform: 'browser',
  format: 'esm',
  outfile: 'out.js',
});
```

If the bundle succeeds, no Node built-ins were pulled in.

See also: [Starter Templates](./starter-templates.md) and
[Testing](./testing.md).

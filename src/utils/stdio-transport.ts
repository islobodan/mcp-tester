/**
 * Node-only stdio transport loader.
 *
 * The stdio transport depends on `cross-spawn` and Node built-ins
 * (`node:process`, `node:stream`), so it cannot run in a browser. It is
 * isolated in this module for two reasons:
 *
 * 1. `MCPClient` imports it dynamically, so it is only evaluated when a stdio
 *    config is actually used.
 * 2. Browser bundlers can replace this module with an empty stub via the
 *    `browser` field in `package.json`, keeping the browser bundle free of
 *    Node built-ins.
 *
 * @module
 */
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export { StdioClientTransport };

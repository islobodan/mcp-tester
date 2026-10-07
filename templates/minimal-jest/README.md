# MCP Test Minimal — Starter Template

The smallest working project that uses [`@slbdn/mcp-tester`](https://www.npmjs.com/package/@slbdn/mcp-tester) to test an MCP server.

## What's included
- A mock MCP server (`examples/mock-server.js`) with two tools: `echo` and `add`.
- One Jest test file (`tests/server.test.ts`) that connects, lists, and calls.
- TypeScript + `ts-jest` ESM configuration.
- A `package.json` with everything you need.

## Quick start

```bash
npm install
npm test
```

You should see something like:

```
PASS  tests/server.test.ts
  Mock MCP server
    ✓ should connect to the server
    ✓ should list at least one tool
    ✓ should echo a message
    ✓ should add two numbers
```

## Point this at your own server

Replace `examples/mock-server.js` with your server (or update `tests/server.test.ts` to point at a real one):

```ts
await client.start({
  command: 'node',
  args: ['./path/to/your-server.js'],
});
```

## Next steps
- **Standard tests**: see `templates/standard-jest/` for tools/resources/prompts suites, fixtures, and CI.
- **Generation**: see `templates/full-stack/` for `generateTests` / `generateTypes` integration.
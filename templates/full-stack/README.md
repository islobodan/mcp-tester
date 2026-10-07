# MCP Test Full-Stack — Starter Template

The most complete scaffold: a real TypeScript MCP server, code generation scripts, multi-file tests, parallel/stress tests, and CI matrix.

## What's included

```
full-stack/
├── src/
│   └── server.ts                # Real TypeScript MCP server (greet, sum, uppercase)
├── examples/
│   └── mock-server.js           # Plain-JS mirror of src/server.ts (used by tests)
├── scripts/
│   ├── generate-tests.ts        # Run: `npm run gen:tests`
│   └── generate-types.ts        # Run: `npm run gen:types`
├── tests/
│   ├── helpers.ts
│   ├── server.test.ts
│   ├── tools.test.ts
│   └── parallel.test.ts
├── .github/workflows/
│   └── test.yml                 # CI matrix + HTML report upload
├── jest.config.js
├── tsconfig.json
└── package.json
```

## Quick start

```bash
npm install
npm run build       # build src/server.ts via tsc (so its types are available)
npm test
```

## Workflows

### Run the server
```bash
npm run server
```
Then attach an MCP inspector to it.

### Regenerate tests from the running server
After changing `src/server.ts` (or its mirror `examples/mock-server.js`):
```bash
npm run gen:tests
```
This inspects the server and writes `tests/generated.test.ts`.

### Generate types from tool schemas
```bash
npm run gen:types
```
This writes `src/generated-types.ts`, exposing:
```ts
import type { ToolArgsMap, ToolName } from './generated-types.js';
await client.callTool<ToolArgsMap['sum']>({
  name: 'sum',
  arguments: { numbers: [1, 2, 3] },
});
```

## What's different from `standard-jest`
- A real TypeScript server in `src/` plus a JS mirror in `examples/` (so tests don't need `tsx` in the spawn path).
- Code generation scripts (`.next` + `.next -types`).
- A parallel/stress test demonstrating `Promise.all`.
- Build step in CI.

## When to use which template
- **`minimal-jest`**: A simple project; just one test file.
- **`standard-jest`**: A real-world CI setup; per-capability test files + reporter + workflow.
- **`full-stack`**: A library with a server; code generation + typed calls + CI matrix.
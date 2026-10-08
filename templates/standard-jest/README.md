# MCP Test Standard — Starter Template

A "blessed" layout for testing MCP servers with [`@slbdn/mcp-tester`](https://www.npmjs.com/package/@slbdn/mcp-tester). Splits tests by capability, ships an HTML reporter, includes a CI workflow, and demonstrates richer mocking patterns.

## What's included

```
standard-jest/
├── examples/
│   └── mock-server.js        # Stdio mock server: echo, add, slow, version resource, greet prompt
├── tests/
│   ├── helpers.ts            # Shared client setup
│   ├── server.test.ts        # Lifecycle and health
│   ├── tools.test.ts         # Tool listing, schemas, calls (incl. timeout)
│   ├── resources.test.ts     # Resource listing and reads
│   └── prompts.test.ts       # Prompt listing and gets
├── .github/workflows/
│   └── test.yml              # CI matrix (Node 20, 22) + HTML report upload
├── jest.config.js
├── tsconfig.json
└── package.json
```

## Quick start

```bash
npm install
npm test
```

Open `reports/test-report.html` for the visual report.

## What's different from `minimal-jest`
- **Test split**: separate files per capability for clearer failure attribution.
- **HTML reporter**: jest-html-reporters preconfigured.
- **Coverage**: `npm run test:coverage` runs with text/lcov reporters.
- **CI workflow**: GitHub Actions matrix on Node 20 and 22.
- **Timeout testing**: demonstrates `timeout` per-call option.

## Point this at your own server
Replace `examples/mock-server.js` with your server, or update `tests/helpers.ts` to point at it.

## Next steps
- **Full stack**: see `templates/full-stack/` for code generation (`generateTests` / `generateTypes`) and typed tool calls.
# Starter Templates

Three ready-to-use scaffolds for testing MCP servers. Pick the one that matches the size of your project, then `npx @slbdn/mcp-tester create <template> <dest>` (or just copy `templates/<template>/` by hand).

| Template | Best for | Includes |
|---|---|---|
| `minimal-jest` | Tiny side projects | One test file, one mock server, zero ceremony |
| `standard-jest` | Real-world CI | Per-capability test files, HTML reporter, GitHub Actions matrix |
| `full-stack` | A library that ships a server | Real TS server, code generation, typed tool calls |

## CLI usage

```bash
npx @slbdn/mcp-tester create <template> <dest>     # scaffold + npm install
npx @slbdn/mcp-tester create list                 # show all templates
npx @slbdn/mcp-tester create <template> <dest> --no-install   # skip install
npx @slbdn/mcp-tester create <template> <dest> --git         # also git init
```

`__NAME__` placeholders in `package.json` are replaced with the destination directory name.

## Manual usage

Copy any subdirectory of [`templates/`](../templates/) into your project and run `npm install`.

## Which template should I pick?

- **I'm evaluating mcp-tester** → `minimal-jest`
- **I'm adding CI to an existing server** → `standard-jest`
- **I'm building a library and need type-safe tool calls** → `full-stack`

## What lives in each template?

### `minimal-jest`
```
minimal-jest/
├── README.md
├── package.json
├── tsconfig.json
├── jest.config.js
├── .gitignore
├── tests/server.test.ts          # 4 tests: connect, list, echo, add
└── examples/mock-server.js       # echo, add
```

**Run:** `npm install && npm test` (≈1.5s, 4 tests)

### `standard-jest`
```
standard-jest/
├── README.md
├── package.json                  # + jest-html-reporters
├── tsconfig.json
├── jest.config.js                # HTML reporter configured
├── .gitignore
├── examples/mock-server.js       # echo, add, slow + version resource + greet prompt
├── tests/
│   ├── helpers.ts
│   ├── server.test.ts            # lifecycle + health
│   ├── tools.test.ts             # list, schemas, calls (incl. timeout)
│   ├── resources.test.ts
│   └── prompts.test.ts
└── .github/workflows/test.yml    # Node 20/21 matrix + report upload
```

**Run:** `npm install && npm test` (≈4.5s, 15 tests)
**HTML report:** `reports/test-report.html`
**CI:** matrix on Node 20 and 21 with HTML artifact upload

### `full-stack`
```
full-stack/
├── README.md
├── package.json                  # + tsx
├── tsconfig.json
├── jest.config.js
├── .gitignore
├── src/server.ts                 # Real TS server (greet, sum, uppercase)
├── examples/mock-server.js       # JS mirror (used by tests so spawn path stays JS)
├── scripts/
│   ├── generate-tests.ts         # `npm run gen:tests`
│   └── generate-types.ts         # `npm run gen:types`
├── tests/
│   ├── helpers.ts
│   ├── server.test.ts            # lifecycle, health, tool listing
│   ├── tools.test.ts             # happy-path + edge cases
│   └── parallel.test.ts          # Promise.all stress tests
└── .github/workflows/test.yml    # build + test on Node 20/21
```

**Run:** `npm install && npm run build && npm test` (≈2s, 10 tests)
**Generate:** `npm run gen:tests` writes `tests/generated.test.ts`
**Types:** `npm run gen:types` writes `src/generated-types.ts`

## Customising

1. Replace `examples/mock-server.js` (and `src/server.ts` for full-stack) with your server.
2. Edit `tests/helpers.ts` to point at your server.
3. Run `npm test`.

## Adding a new template

Templates live in [`templates/`](../templates/) and are copied verbatim by the CLI. To add one:

1. Create `templates/<your-template>/` with the files above.
2. Use `__NAME__` as the `package.json` `name` field if you want it substituted on scaffold.
3. Rebuild: `npm run build` (copies `templates/` → `dist/templates/`).
4. Run `npm run gen:docs` if you want this page updated automatically (the table is generated).

The CLI discovers templates by scanning the directory at runtime — no code changes needed.
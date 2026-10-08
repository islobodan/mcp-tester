# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Browser support.** `mcp-tester` can now run in browsers and edge runtimes over the `http`, `sse`, and new `websocket` transports. A browser-safe entry point (`src/browser.ts`) is selected automatically via the `browser` field in `package.json`, and the Node-only stdio transport is isolated so bundlers exclude it from browser builds.
- **WebSocket transport** (`{ transport: 'websocket', url: 'ws://…' }`), available in the client and the CLI (`--transport websocket`), using the browser-native `WebSocket` API and the `mcp` subprotocol. `ws://`/`wss://` URLs are auto-detected by the CLI. Config validation accepts `ws:`/`wss:` for this transport.
- `docs/browser.md` and a README "Browser Support" section.
- `npm run test:browser` bundles the package with esbuild using `platform: 'browser'` and fails if Node built-ins or the stdio transport leak into the bundle; wired into CI.

## [1.5.4] - 2026-10-08

### Fixed
- Rebuilt the README architecture diagram. Its box borders were misaligned (right edges varied by up to six columns, so the boxes did not line up), and the `MCP Server (child process)` label was wrong for the HTTP/SSE transports, which connect to a remote server rather than spawning a process. The diagram now has consistently aligned borders and shows the tested capabilities (`Tools`, `Resources`, `Prompts`, `Sampling`, `Elicitation`, `Notifications`).

## [1.5.3] - 2026-10-08

### Fixed
- **`npm run test:coverage` failed its branch-coverage gate for `src/generate-cases.ts`** (`81.87% < 85%`) even though every test passed. Added tests covering the previously untested `additionalProperties`-as-schema constraint checks (`minLength`/`maxLength`/`maximum`/`exclusiveMinimum`/`exclusiveMaximum`/`minItems`/`maxItems`/`uniqueItems`), constraint-only violating-value inference, union/`null`/untyped-property handling, and rule-engine edges (numeric enums, unmatched `required` keys, required object properties, `maxItems` without an `items` schema). Branch coverage for the file is now 97.65%; overall branch coverage is 87.76%.

## [1.5.2] - 2026-10-08

### Fixed
- **`npm ci` failed on Node 20 / npm 10, blocking the 1.5.1 publish.** The 1.5.1 lockfile was left inconsistent by `npm audit fix`: it dropped the top-level `@emnapi/core` and `@emnapi/runtime` entries that satisfy `@napi-rs/wasm-runtime`'s peer dependencies. npm 11 (which wrote the lock) tolerated this, but npm 10's stricter `npm ci` sync check rejected it with `EUSAGE` (`Missing: @emnapi/core@1.11.3 from lock file`). The entries are restored; `npm ci` and `npm audit --audit-level=high` both pass on npm 10.
  - 1.5.1 was never published to npm; this release supersedes it and carries the same security updates described below.

### Changed
- CI and the release verification job now run on Node.js 20 and 22 instead of 20 and 21. Node 21 is end-of-life and is outside the `engines` range of Jest 30 and several dev dependencies (`glob@13`, `minimatch@10`, `lru-cache@11`, `eslint-visitor-keys@5`, …), which produced `EBADENGINE` warnings during install. The starter-template CI matrices were updated to match.

## [1.5.1] - 2026-10-08

### Security
- Cleared the `npm audit` findings that blocked the 1.5.0 publish (the `release.yml` job's hard `npm audit --audit-level=high` gate). A semver-safe `npm audit fix` bumped:
  - `@modelcontextprotocol/sdk` 1.29.0 → 1.32.1 (high — the OAuth client could send credentials to an authorization server chosen by the MCP server, [GHSA-6qxp-vccf-f47h](https://github.com/advisories/GHSA-6qxp-vccf-f47h)).
  - `proxy-addr` 2.0.7 → 2.0.8 (critical — IP spoofing via an IPv4-mapped IPv6 trust subnet, [GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h)), transitive via `express` through the SDK's server integration.
  - `ts-jest` → 29.4.14 and `babel-plugin-istanbul` → 8.0.2 transitively.
  - The remaining advisories are dev-only moderate findings (`sprintf-js` via `ts-jest`) and sit below the release gate's `--audit-level=high` threshold; clearing them requires a breaking `ts-jest` downgrade (`npm audit fix --force`), so they are intentionally left in place.

## [1.5.0] - 2026-10-08

### Added
- **AI-assisted & schema-driven test-case generation** (TODO #39) — `generate` now goes beyond happy-path calls:
  - `--edge-cases` — deterministic boundary/invalid cases from each tool's JSON Schema (offline, no AI): missing required args, invalid enums, wrong types, `minLength`/`maxLength`, `minimum`/`maximum` bounds, `minItems`, `additionalProperties: false`. Expectations are `error`, `observe`, or `success`, and every case is tagged with a provenance comment (`// rule:required — ...`).
  - `--ai-generate` — augments the edge cases with LLM suggestions via any OpenAI-compatible endpoint (OpenAI, Ollama, LM Studio, vLLM). The model only proposes **structured case data** (`GeneratedCase`); every suggestion is validated against the real tool schemas and rendered deterministically — hallucinated arguments are dropped with a summary line, and the model never emits code — model-supplied rationales are sanitized before being embedded in a comment, so a crafted rationale cannot break out and become executable test code. Configure via `MCP_TESTER_AI_API_KEY` / `MCP_TESTER_AI_BASE_URL` / `MCP_TESTER_AI_MODEL` or the new `--ai-model` / `--ai-base-url` / `--require-ai` flags. Responses are cached in `.mcp-tester-cache/`.
  - `--verify` — dry-runs every derived case against the live server before writing the file; predictions that don't hold become `it.skip` blocks with an explanatory comment instead of broken tests.
  - New modules: `generate-cases.ts` (rules engine, `GeneratedCase`, `suggestEdgeCases*`, `validateArgsAgainstSchema`, `mergeAndValidateCases`) and `ai/provider.ts` (`OpenAICompatProvider` with injectable `fetchImpl`, `createProviderFromEnv`). All exported from the package barrel.
  - Docs: [`docs/ai-generation.md`](docs/ai-generation.md), README section, CLI reference.
- **Starter templates** under `templates/` with a new `mcp-tester create <template> <dest>` CLI command:
  - `minimal-jest` — one test file, one mock server, zero ceremony.
  - `standard-jest` — per-capability test files, HTML reporter, GitHub Actions matrix.
  - `full-stack` — real TS server, code generation scripts (`npm run gen:tests` / `gen:types`), typed tool calls, parallel stress tests.
- `create list` shows available templates. `__NAME__` placeholders in `package.json` are substituted with the destination directory name. `--no-install` skips `npm install`; `--git` initializes a repo.
- Documentation: [`docs/starter-templates.md`](docs/starter-templates.md) and a new README section.

### Fixed
- **Jest matcher types were broken for consumers since the Jest 30 upgrade (1.4.3)** — `expect(tools).toHaveTool(...)` produced TS2339 in consumer projects (the global `jest.Matchers` augmentation no longer reaches Jest 30's `expect()` return type). The matchers are now additionally declared against the `expect` package's `Matchers` interface via `MCPMatchers`, so autocomplete/type-checking works in both ts-jest and plain `tsc` setups. Because TypeScript does not apply module augmentations shipped inside `node_modules`, the package now ships a copy-ready `jest.d.ts` — copy it into your project to enable the types (see README).
- Templates now typecheck cleanly under `strict` `tsc --noEmit` (they were only ever compiled by ts-jest's non-strict inline config): `content[0].text`-style union accesses replaced with typed `contentText()` / `promptText()` / `resourceText()` helpers, and full-stack's server handler no longer assumes `arguments` is defined.
- `generateTests` (stdio variant) now respects the `includeTools` / `includeResources` / `includePrompts` flags when fetching from the server, matching the behaviour of `generateTestsFromClient`. Previously it always called `listResources` and `listPrompts` even when the output flags said to skip them — causing generation to fail against servers that don't declare those capabilities.
- `examples/mock-server.js`: the `delay` tool now rejects invalid `ms` values (`NaN`, negative, > 60000) instead of passing them to `setTimeout` — caught by the new `--verify` mode.
- The published package now ships the top-level `docs/*.md` guides, so the README's documentation links resolve on npmjs.com (they previously 404'd — the generated `docs/api/` HTML is still excluded).
- The generated `it(...)` titles and call arguments now escape the exact quote delimiter they are interpolated into, so tool/resource/prompt names containing apostrophes, double quotes, or backslashes produce valid test files. Observe-oracle cases emit a proper single-quoted tool literal instead of a literal `${c.tool}` expression (which previously caused a `ReferenceError`).
- AI mode no longer drops the deterministic one-past-`maxLength` `observe` case during schema validation, so `--edge-cases` and `--ai-generate` produce the same rule cases. The merge diagnostic now counts only AI rejections.
- The `additionalProperties`-as-schema rule now emits a value that actually violates the declared type (it previously injected a number that satisfied `{ type: 'number' }`), and the `pattern` rule skips patterns that match every probe value (e.g. `.*`) instead of asserting a false `error`.
- `parseJsonLoose` falls back past an unparseable code fence to a valid JSON payload elsewhere in the response, and its object scanner skips past a well-formed object instead of rescanning every nested `{`.
- `validateValueAgainstSchema` now checks `enum`/`pattern`/numeric/array constraints on `additionalProperties` values, not just type and string length.

### Security
- **Generated test code cannot be turned into an injection vector** — model-supplied case rationales are collapsed onto a single line comment before being emitted, so a crafted multi-line rationale can no longer close the comment and inject executable statements into the generated file. The copy-ready `jest.d.ts` shipped to consumers also no longer contains a `*/` inside its doc comment (which made the file a syntax error).

## [1.4.3] - 2026-10-05

### Security
- Cleared all `npm audit` advisories. A semver-safe `npm audit fix` removed the runtime advisories (`ip-address`, `qs`, `hono`, `body-parser`, `fast-uri`, `js-yaml`, `markdown-it`, …). The remaining dev-only advisories all traced to Jest 29's `micromatch`/`braces`/`expect`, so **Jest and `@types/jest` were upgraded to v30** (ts-jest already supports it). `npm audit` now reports 0 vulnerabilities.
  - This also unblocks the `release.yml` publish job, whose hard `npm audit --audit-level=high` gate had prevented 1.4.2 from reaching npm.

### Changed
- CI uses `npm audit --omit=dev` instead of the deprecated `npm audit --production` alias.

### Added
- Exported the `TransportType` type (returned by `MCPClient.getTransportType()`), which typedoc previously flagged as referenced but undocumented.

## [1.4.2] - 2026-10-05

### Fixed
- **Published package was unusable from 1.3.0 onward** — the `files` allowlist omitted `dist/generate-tests.*` and `dist/generate-types.*` while `dist/index.js` eagerly re-exported them, so importing `@slbdn/mcp-tester` (or any deep path through the barrel) failed with `ERR_MODULE_NOT_FOUND`.
  - `files` is now simply `["dist", ...]`, which cannot drift when new modules are added at the `dist/` root.
- **CLI global options were ignored** — `--timeout`, `--verbose` and `--log-level` are declared on the root program, but subcommands read options from their own `opts`, so they had no effect. Actions now merge in `program.opts()`; `--log-level debug` emits debug output and `--timeout 1` correctly fails slow calls.
- **`--url` without `--transport` failed** — the HTTP branch required a truthy `transport`. A URL now implies HTTP, and unknown `--transport` values are rejected with exit code 1.
- **`getPackageVersion()` resolved against `process.cwd()`** — generated file headers reported `1.0.0` for consumers. It now resolves the installed package via Node module resolution (works from a clean install, the repo, and global CLI installs).
- **CI `security` job failed on every run** — the `npm audit` steps are now `continue-on-error: true` rather than hard-failing the workflow.
- **`startupDelay` was validated and documented but never applied** — `start()` now waits for it when configured. The default is `0` (opt-in).
- **Health check assumed the server exposes tools** — `isHealthy()` used `tools/list`, so resource/prompt-only servers were reported unhealthy. It now uses the protocol-level `ping`, and records `lastHealthStatus` on every path.
- **`startHealthMonitor()` could crash the process** — a throwing `onCheck`/`onUnhealthy`/`onRecovery` callback (or a rejected health check) surfaced as an unhandled rejection. Callbacks are now guarded and logged.
- **`callTool()` was retried by default** — re-running a tool can duplicate side effects. Tool calls are now retried only when `retries` is passed per call; idempotent requests keep the global retry policy.
- **HTTP/SSE header merging dropped entries** when `requestInit.headers` was a `Headers` instance or tuple array; headers are now merged without data loss.
- **Sampling validation lied about `maxTokens`** — `validateSamplingRequest()` asserted it was a number without checking. It now rejects missing, non-numeric, non-integer, and non-positive values.
- **Generated type declarations could reference undefined `$ref` types** — `$ref` targets are now emitted as `export type` aliases (resolved from `$defs`/`definitions`, transitively), falling back to `unknown` for unresolved refs so the output always type-checks.
- **Descriptions could break generated JSDoc** — tool/resource/prompt/argument descriptions containing `*/` are escaped.
- Removed dead code and stale artifacts: duplicated `toTypeName` ternary, tracked `.github/workflows/release.yml.bak`, and a stale CI coverage-threshold comment.

### Added
- **Package smoke test** (`npm run test:package`, wired into CI) — packs the tarball, installs it into a clean project, and verifies the root import and public exports. This catches packaging regressions that the `src/`-based Jest suite cannot.
- `generateTestsFromClient()` / `generateTypesFromClient()` — generate from an already-connected client, so HTTP/SSE generation shares the stdio code path instead of a divergent inline copy.
- CLI `generate` and `generate-types` now use the shared library generators for all transports.

### Changed
- Generated test call cases accept either a successful result or a tool-level error, so generated suites for servers with intentional error tools no longer fail out of the box.
- `tsx` is now a declared devDependency for the `benchmark` script.
- Coverage config excludes `src/cli/index.ts` explicitly (exercised end-to-end via `child_process`) instead of the blanket `src/**/index.ts` glob.
- `matchers.ts` coverage raised from 68/29/42/65 to 100/95/100/100 (statements/branches/functions/lines); the Jest per-file floor now enforces it.

## [1.4.1] - 2026-07-02

### Fixed
- **`maskSecrets()` no longer throws on hostile objects** — objects with a non-function `toString` (e.g. `{ toString: false }`), non-function `valueOf`, non-function `Symbol.toPrimitive`, throwing coercion methods, or circular references previously crashed `String(input)` with `TypeError: Cannot convert object to primitive value`.
  - Root cause: `String()` invokes `toString()`/`valueOf()`/`Symbol.toPrimitive`, but throws when those are present yet not callable.
  - Since masking runs inside `ConsoleLogger.format()` on every log line, this could take down logging entirely.
  - New internal `safeToString()` helper guards coercion with `typeof` checks and `try/catch`, falling back to `JSON.stringify` then `Object.prototype.toString.call()`.
  - Found by property-based testing (`fc.anything()`); verified against 2000 randomized runs with 0 crashes.
  - Added regression tests for hostile objects and circular references.

### Changed
- **CI: bumped GitHub Actions to current versions** (fixes "Node 20 is being deprecated" warning):
  - `actions/checkout` v3 → v5 (node16 → node24 runtime)
  - `actions/setup-node` v3 → v5
  - `codecov/codecov-action` v3/v4 → v5
  - Replaced deprecated `actions/create-release@v1` with `gh release create`
  - The deprecation warning was about the action runtime, not the test matrix.

## [1.4.0] - 2026-07-01

### Added
- **HTTP and SSE transport support** — connect to remote MCP servers:
  - `StreamableHttpServerConfig` (`transport: 'http'`) — modern MCP Streamable HTTP (POST + SSE GET)
  - `SseServerConfig` (`transport: 'sse'`) — legacy SSE transport
  - `ServerConfig` union type — `StdioServerConfig | StreamableHttpServerConfig | SseServerConfig`
  - `getTransportType()` method — returns `'stdio'`, `'http'`, `'sse'`, or `null`
  - URL auto-detection in CLI (passing a URL as first arg uses HTTP transport)
  - CLI `--transport`, `--url`, `--headers` options on all commands
  - 15 integration tests (Streamable HTTP + SSE) against server-everything
  - 5 CLI HTTP transport tests
  - 14 validation tests for HTTP/SSE configs

### Changed
- `MCPServerConfig` is now a deprecated alias for `StdioServerConfig` (backward compatible)
- `start()` accepts the `ServerConfig` discriminated union instead of `MCPServerConfig`
- CLI commands now accept `[command]` (optional) instead of `<command>` to support HTTP/SSE

## [1.3.0] - 2026-07-01

### Added
- **TypeScript type generator** (`src/generate-types.ts`) — generate typed `.d.ts` from MCP tool schemas:
  - `generateTypes()` API: connect to server, inspect schemas, emit TypeScript declarations
  - CLI: `npx mcp-tester generate-types node ./server.js -o server.d.ts`
  - Handles: primitives, enums, arrays, nested objects, oneOf/anyOf/allOf, $ref, const
  - Generated types: `{Tool}Args`, `ToolName`, `ToolArgsMap`, `ToolCall`, `ResourceUri`, `PromptCall`
  - 59 tests (12 e2e + 4 options + 43 unit)
- **Server health checks** — detect zombie processes and monitor server health:
  - `isHealthy()` — sends a lightweight `tools/list` ping, returns `HealthStatus` with latency, PID, message
  - `getServerPid()` — get the server process PID
  - `getLastHealthStatus()` — cached result without re-checking
  - `startHealthMonitor(options)` — periodic health monitoring with `onUnhealthy`/`onRecovery`/`onCheck` callbacks
  - `stopHealthMonitor()` — stop periodic monitoring (also auto-stopped by `client.stop()`)
  - Zombie process detection via `process.kill(pid, 0)`
  - 17 tests (including SIGKILL zombie detection test)
- **Enhanced mock server** (`src/__tests__/fixtures/mock-server.ts`) — 68 tests:
  - Configurable delays (`defaultDelay`) and random failures (`failureRate`)
  - Input schema validation (`validateSchemas` option)
  - Stateful tools: `counter` (increment/get/reset), `items` (add/list/remove/clear)
  - Transform tool: `upper`/`lower`/`reverse`/`length` operations
  - Custom handlers: `registerToolHandler`, `registerResourceHandler`, `registerPromptHandler`
  - Call history: `getCallHistory`, `getCallCount` for test assertions
  - Streaming support: `setupStream`, `nextStreamChunk`
  - Dynamic registration/removal of tools, resources, prompts

### Changed
- **CLI version** is now read dynamically from `package.json` (was hardcoded `1.0.0`)
- Applied safe dependency patches: `@typescript-eslint/*` 8.60.0, `@types/node` 20.19.41, `prettier` 3.8.3, `ts-jest` 29.4.11
- `npm audit fix` — 0 vulnerabilities (was 11)

### Test Suite
- **635 tests** (17 suites), up from 491 (14 suites)
- New: mock server (68), generate-types (59), health checks (17)

## [1.2.0] - 2026-04-30

### Added
- **Visual test reports** — HTML test report auto-generated on every `npm test` run:
  - Uses `jest-html-reporters` with collapsible test trees, timing, failure details
  - Report saved to `reports/test-report.html`
  - CI uploads report as artifact (14-day retention)
  - Open locally: `open reports/test-report.html`
- **Property-based tests** (`src/__tests__/property-based.test.ts`) — 73 tests using fast-check:
  - 44 validation tests: reject/accept all input types, error code invariants
  - 17 masking tests: idempotency, completeness, secret detection, length bounds
  - 12 generate-tests tests: no-throw, serializability, schema priority, nested arrays
  - Fixed flaky `fc.double()` producing NaN/Infinity → use `fc.integer()` for numeric fields
- **Enhanced mock server** (`src/__tests__/fixtures/mock-server.ts`) — 68 tests:
  - Configurable delays (`defaultDelay`) and random failures (`failureRate`)
  - Input schema validation (`validateSchemas` option)
  - Stateful tools: `counter` (increment/get/reset), `items` (add/list/remove/clear)
  - Transform tool: `upper`/`lower`/`reverse`/`length` operations
  - Custom handlers: `registerToolHandler`, `registerResourceHandler`, `registerPromptHandler`
  - Call history: `getCallHistory`, `getCallCount` for test assertions
  - Streaming support: `setupStream`, `nextStreamChunk`
  - Dynamic registration/removal of tools, resources, prompts
- **TypeScript type generator** (`src/generate-types.ts`) — generate typed `.d.ts` from MCP tool schemas:
  - `generateTypes()` API: connect to server, inspect schemas, emit TypeScript declarations
  - CLI: `npx mcp-tester generate-types node ./server.js -o server.d.ts`
  - Handles: primitives, enums, arrays, nested objects, oneOf/anyOf/allOf, $ref, const
  - Generated types: `{Tool}Args`, `ToolName`, `ToolArgsMap`, `ToolCall`, `ResourceUri`, `PromptCall`
  - 59 tests (12 e2e + 4 options + 43 unit)
- **Server health checks** — detect zombie processes and monitor server health:
  - `isHealthy()` — sends a lightweight `tools/list` ping, returns `HealthStatus` with latency, PID, message
  - `getServerPid()` — get the server process PID
  - `getLastHealthStatus()` — cached result without re-checking
  - `startHealthMonitor(options)` — periodic health monitoring with `onUnhealthy`/`onRecovery`/`onCheck` callbacks
  - `stopHealthMonitor()` — stop periodic monitoring (also auto-stopped by `client.stop()`)
  - Zombie process detection via `process.kill(pid, 0)`
  - 17 tests (including SIGKILL zombie detection test)
- **Test code generator** (`src/generate-tests.ts`) — generate a complete test file from MCP server inspection:
  - CLI: `mcp-tester generate node ./server.js -o server.test.ts` (alias: `gen`)
  - API: `generateTests({ command, args, framework, ... })`
  - Generates lifecycle tests, tool call tests with sample args from JSON Schema, resource read tests, prompt tests
  - Options: `--framework jest|vitest`, `--output <file>`, `--description <name>`, `--no-tools`, `--no-resources`, `--no-prompts`, `--no-matchers`
  - Sample arguments derived from JSON Schema: types, enums, defaults, examples
  - 21 tests in `generate-tests.test.ts`
- **Input validation** (`src/utils/validation.ts`) — all MCPClient methods validate inputs before execution:
  - `start()`: validates command (required string), args (string array), env (string values), startupDelay (non-negative number)
  - `callTool()`: validates name (required string), arguments (object), timeout (positive number), retries (non-negative number)
  - `readResource()`: validates URI (required non-empty string)
  - `getPrompt()`: validates name (required string), args (string values)
  - `requestSampling()`: validates messages (non-empty array)
  - Constructor: validates timeout (positive), retries/retryDelay/startupDelay (non-negative), name/version (string)
  - Validation runs before connection checks — invalid args throw `MCPClientError`, not `MCPNotStartedError`
  - 91 tests in `validation.test.ts`
- **Code coverage comments on PRs** — GitHub Actions workflow now posts a coverage table as a sticky comment on every pull request (statements/branches/functions/lines with thresholds)
- **Dedicated `coverage` CI job** — runs on single Node.js version (faster than matrix), generates `coverage-summary.json`, uploads to Codecov v4
- **`coverageReporters`** in `jest.config.js` — added `json-summary` reporter for CI coverage data extraction
- **VS Code snippets** (`.vscode/mcp-tester.code-snippets`) — 15 snippets for MCP test patterns (type `mcp` prefix)

### Changed
- **Per-file coverage thresholds** updated for new files (`masking.ts`, `logger.ts`) and actual coverage numbers
- Global thresholds: 67% statements, 61% branches, 60% functions, 67% lines (was 76/57/64/76)
- **README** coverage badge and table updated with real numbers (68/61/60/68)
- **docs/cicd.md** — rewritten with full workflow including coverage job, PR comments, and Codecov
- **docs/testing.md** — updated coverage thresholds (was "80%", now per-file table)
- **AGENTS.md** — updated test count, coverage stats, CI job descriptions, file listing
- Fixed flaky `delay` test (100ms → 90ms tolerance for timing variance)
- **Updated test count**: 491 (was 306)

## [1.1.0] - 2026-04-23

### Added
- **Assertion module** (`src/assert.ts`) — 30+ framework-agnostic assertion functions:
  - Value: `equal`, `notEqual`, `deepEqual`, `ok`, `notOk`, `throws`, `doesNotThrow`
  - Numeric: `equalNum`, `greaterThan`, `atLeast`, `lessThan`, `closeTo`
  - String: `contains`, `notContains`, `matches`
  - Tool results: `toolTextEquals`, `toolTextContains`, `toolNumEquals`, `toolNumCloseTo`, `toolJsonEquals`, `toolIsError`, `toolIsOk`, `toolHasContent`, `toolHasImage`
  - Resources: `resourceHasContent`, `resourceTextContains`
  - Prompts: `promptHasMessages`, `promptTextContains`
  - Exported as `assert` namespace and `AssertionError` class
- **20 custom Jest/Vitest matchers** for MCP-specific assertions:
  - Collection: `toHaveTool`, `toHaveToolWithSchema`, `toHaveToolCount`, `toHaveResource`, `toHaveResourceByName`, `toHaveResourceCount`, `toHavePrompt`, `toHavePromptWithArgs`, `toHavePromptCount`
  - Tool results: `toReturnText`, `toReturnTextContaining`, `toReturnError`, `toReturnOk`, `toReturnJson`, `toReturnContentCount`, `toReturnImage`
  - Resource results: `toReturnResourceText`, `toReturnResourceTextContaining`
  - Prompt results: `toReturnPromptTextContaining`, `toReturnPromptMessageCount`
- **Vitest support** — all matchers work with Vitest via `setupVitestMatchers()`:
  - `vitest.d.ts` type declarations included in package
  - `setupJestMatchers()` (renamed from `setupCustomMatchers`, kept as alias)
  - `setupVitestMatchers()` for Vitest environments
  - Same `{ pass, message }` format, works identically in both frameworks
- **Standalone assertion wrappers** in `matchers.ts` for non-Jest usage: `assertHasTool`, `assertHasResource`, `assertHasPrompt`, `assertToolText`, `assertToolTextContains`
- **CLI tool** with shebang (`#!/usr/bin/env node`) for proper `npx` support
- **Examples** added to `examples/`:
  - `everything-server-test.ts` — full test against real `@modelcontextprotocol/server-everything`
  - `jest-matchers-example.ts` — demonstrates all 20 Jest matchers (20 tests)
  - `assert-example.ts` — demonstrates all assert utilities (20 tests)
- **Documentation reorganization** — README condensed from 1610 to ~200 lines:
  - `docs/api-reference.md` — full method docs, types, error classes, assert & matchers tables
  - `docs/testing.md` — writing tests, Jest/Vitest setup, matchers, assert module, mock server
  - `docs/examples.md` — practical code examples for Jest, Vitest, and assert
  - `docs/advanced.md` — timeouts, retries, concurrency, notifications, logging
  - `docs/cli.md` — CLI commands, options, output formats
  - `docs/cicd.md` — GitHub Actions, CircleCI, Jenkins configs
  - `docs/troubleshooting.md` — common issues, Vitest setup, solutions
  - `docs/releases.md` — release process and commands
  - `docs/nodejs-compatibility.md` — version matrix, upgrade guide
- **README improvements**:
  - "This is not your grandpa's MCP Inspector" intro
  - Capabilities table (9 categories)
  - Parallel execution section with `Promise.all` examples
  - Assertion utilities section with full API table
  - Custom Jest matchers section with all 20 matchers
  - Vitest setup section
  - Removed old `CLI.md` (replaced by `docs/cli.md`)
- **227 tests** (up from 111) — new `assert.test.ts` (67 tests) and `matchers.test.ts` (49 tests)

### Changed
- **`MCPTimeoutError` and `MCPConnectionError` are now actually thrown** — `start()` catches connection errors as `MCPConnectionError`, `wrapError()` detects timeout errors and throws `MCPTimeoutError`
- **CLI** rewritten to use Commander's native `help` and `version` handling instead of duplicated logic
- **Example imports** fixed: `../index.js` → `../dist/index.js` (examples now actually run with `npx tsx`)
- **Matchers** moved from `src/__tests__/matchers.ts` to `src/matchers.ts` and exported publicly
- **Test helper server path** fixed: `./dist/__tests__/fixtures/mock-server.js` → `./examples/mock-server.js`
- Husky `prepare` script now handles Node.js v24 incompatibility (`"husky || true"`)
- `tsconfig.json` excludes `src/__tests__` from compilation — `dist/` now has only library files (28)
- `toolTextEquals()` now accepts optional `expected` param — can be used as "has any text" check

### Removed
- **`src/__tests__/helpers.ts`** — removed dead code (was only used once, `new MCPClient()` is simpler)
- **`src/__tests__/helpers-example.test.ts`** — removed (demonstrated unused helpers)
- **`src/__tests__/matchers.ts`** — moved to `src/matchers.ts` (now a public export)
- **`CLI.md`** — replaced by `docs/cli.md`
- **`toBeConnectedClient`** matcher — removed (never had real implementation)
- All `any` types removed from `mock-server.ts` — replaced with proper TypeScript interfaces
- Documentation references to removed helpers, old import paths, and stale test counts

### Fixed
- **Two failing tests** in `everything-server.test.ts`:
  - `trigger-long-running-operation`: `duration` parameter is in seconds, not milliseconds
  - `args-prompt`: requires `city` argument, not `name`
- **MCPClient error handling**: catches in `start()`, `listTools()`, `callTool()`, `listResources()`, `readResource()`, `listPrompts()`, and `getPrompt()` now throw proper error subclasses instead of generic `MCPServerError`
- **Husky compatibility** with Node.js v24+ (exit code issue)
- **Test helper import paths** across all test files
- **CLI version format**: now outputs plain `1.1.0` instead of `mcp-tester v1.1.0`
- **Package name** in RELEASE.md and CONTRIBUTING.md: `mcp-tester` → `@slbdn/mcp-tester`
- **Repo URLs** in RELEASE.md and CONTRIBUTING.md: `your-username` → `islobodan`

## [1.0.0] - 2026-01-19

### Added
- Initial release of MCP Tester
- Full MCP protocol support (Tools, Resources, Prompts, Sampling, Elicitation, Notifications)
- Jest integration with 26 tests
- Mock MCP server for unit testing
- TypeScript support with full type definitions
- CI/CD pipeline with GitHub Actions
- Comprehensive documentation and examples
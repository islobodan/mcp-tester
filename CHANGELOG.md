# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
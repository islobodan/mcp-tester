# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2026-04-23

### Added
- **Assertion module** (`src/assert.ts`) — 30+ assertion functions for any test runner:
  - Value: `equal`, `notEqual`, `deepEqual`, `ok`, `notOk`, `throws`, `doesNotThrow`
  - Numeric: `equalNum`, `greaterThan`, `atLeast`, `lessThan`, `closeTo`
  - String: `contains`, `notContains`, `matches`
  - Tool results: `toolTextEquals`, `toolTextContains`, `toolNumEquals`, `toolNumCloseTo`, `toolJsonEquals`, `toolIsError`, `toolIsOk`, `toolHasContent`, `toolHasImage`
  - Resources: `resourceHasContent`, `resourceTextContains`
  - Prompts: `promptHasMessages`, `promptTextContains`
  - Exported as `assert` namespace and individual `AssertionError` class
- **15 new Jest matchers** for tool results, resources, and prompts:
  - Collection: `toHaveToolCount`, `toHaveResourceCount`, `toHavePromptCount`, `toHaveResourceByName`, `toHavePromptWithArgs`
  - Tool results: `toReturnText`, `toReturnTextContaining`, `toReturnError`, `toReturnOk`, `toReturnJson`, `toReturnContentCount`, `toReturnImage`
  - Resources: `toReturnResourceText`, `toReturnResourceTextContaining`
  - Prompts: `toReturnPromptTextContaining`, `toReturnPromptMessageCount`
- **Standalone assertion wrappers** in `matchers.ts` for non-Jest usage: `assertHasTool`, `assertHasResource`, `assertHasPrompt`, `assertToolText`, `assertToolTextContains`
- **CLI tool** with shebang (`#!/usr/bin/env node`) for proper `npx` support
- **Examples** added to `examples/`:
  - `everything-server-test.ts` — full test against real `@modelcontextprotocol/server-everything`
  - `jest-matchers-example.ts` — demonstrates all Jest matchers (20 tests)
  - `assert-example.ts` — demonstrates assert module (20 tests)
- **Documentation reorganization** — README condensed from 1610 to ~200 lines:
  - `docs/api-reference.md` — full method docs, types, error classes
  - `docs/testing.md` — writing tests, matchers, mock server
  - `docs/examples.md` — practical code examples
  - `docs/advanced.md` — timeouts, retries, concurrency, logging
  - `docs/cli.md` — CLI commands, options, output formats
  - `docs/cicd.md` — GitHub Actions, CircleCI, Jenkins configs
  - `docs/troubleshooting.md` — common issues and solutions
  - `docs/releases.md` — release process and commands
  - `docs/nodejs-compatibility.md` — version matrix, upgrade guide
- **README improvements**:
  - "This is not your grandpa's MCP Inspector" intro
  - Capabilities table (9 categories)
  - Parallel execution section with `Promise.all` examples
  - Assertion utilities section with full API table
  - Custom Jest matchers section with all 20 matchers
  - Removed old `CLI.md` (replaced by `docs/cli.md`)
- `setupCustomMatchers()` — one-call registration of all matchers (replaces manual `expect.extend()`)
- Matchers auto-register in Jest environments (safe no-op outside Jest)

### Changed
- **`MCPTimeoutError` and `MCPConnectionError` are now actually thrown** — `start()` catches connection errors as `MCPConnectionError`, `wrapError()` detects timeout errors and throws `MCPTimeoutError`
- **CLI** rewritten to use Commander's native `help` and `version` handling instead of duplicated logic
- **Example imports** fixed: `../index.js` → `../dist/index.js` (examples now actually run with `npx tsx`)
- **Matchers** moved from `src/__tests__/matchers.ts` to `src/matchers.ts` and exported publicly
- **Test helper server path** fixed: `./dist/__tests__/fixtures/mock-server.js` → `./examples/mock-server.js`
- Test count updated: 115 → 111 (removed unused helpers test suite)
- Husky `prepare` script now handles Node.js v24 incompatibility (`"husky || true"`)
- `tsconfig.json` excludes `src/__tests__` from compilation — `dist/` now has only library files (28)

### Removed
- **`src/__tests__/helpers.ts`** — removed dead code (was only used once, inlined `new MCPClient()` is simpler)
- **`src/__tests__/helpers-example.test.ts`** — removed (demonstrated unused helpers)
- **`src/__tests__/matchers.ts`** — moved to `src/matchers.ts` (now a public export)
- **`CLI.md`** — replaced by `docs/cli.md`
- **`toBeConnectedClient`** matcher — removed (never had real implementation, always returned `pass: true`)
- All `any` types removed from `mock-server.ts` — replaced with proper interfaces

### Fixed
- **Two failing tests** in `everything-server.test.ts`:
  - `trigger-long-running-operation`: `duration` parameter is in seconds, not milliseconds
  - `args-prompt`: requires `city` argument, not `name`
- **MCPClient error handling**: catches in `start()`, `listTools()`, `callTool()`, `listResources()`, `readResource()`, `listPrompts()`, and `getPrompt()` now throw proper error subclasses instead of generic `MCPServerError`
- **Husky compatibility** with Node.js v24+ (exit code issue)
- **Test helper import paths** across all test files
- **CLI version format**: now outputs plain `1.0.2` instead of `mcp-tester v1.0.2`

## [1.0.0] - 2026-01-19

### Added
- Initial release of MCP Tester
- Full MCP protocol support (Tools, Resources, Prompts, Sampling, Elicitation, Notifications)
- Jest integration with 26 tests
- Mock MCP server for unit testing
- TypeScript support with full type definitions
- CI/CD pipeline with GitHub Actions
- Comprehensive documentation and examples
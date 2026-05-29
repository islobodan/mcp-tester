# TODO.md - Roadmap and Improvements

This document tracks planned improvements, features, and enhancements for mcp-tester.

## Status Legend
- `[ ]` - Not implemented / Not started
- `[/]` - In progress
- `[x]` - Implemented / Completed

---

## Critical Bug Fixes

### [x] 40. Fix Duplicate Process Spawn in MCPClient.start()
**Description**: `start()` spawned the server process twice — once via `child_process.spawn()` and once via `StdioClientTransport`. The first process was orphaned (never connected to transport) and only used for stderr logging. This wasted resources and could cause port conflicts.

**Tasks**:
- [x] Remove manual `spawn()` call from `start()`
- [x] Remove `ChildProcess` import and `serverProcess` field
- [x] Update `stop()` to use `client.close()` + `transport.close()` instead of manual SIGTERM/SIGKILL
- [x] Fix error cleanup in `start()` catch block to close transport instead of killing process
- [x] Remove unused `MCPConnectionError` import
- [x] Verify all 43 tests still pass

**Impact**: Eliminates resource waste, prevents orphaned processes

**Estimated Effort**: 1 hour

---

### [x] 41. Fix Broken Example Files
**Description**: `examples/basic-test.ts` and `examples/full-test.ts` called `client.start({ command: 'node', args: [] })` without specifying a server file. They would fail immediately with a module error.

**Tasks**:
- [x] Update `basic-test.ts` to use `args: ['./examples/mock-server.js']`
- [x] Update `full-test.ts` to use `args: ['./examples/mock-server.js']`

**Impact**: Examples are now runnable

**Estimated Effort**: 15 minutes

---

### [x] 42. Fix `@ts-ignore` Usage in Test Files
**Description**: `helpers-example.test.ts` used `@ts-ignore` instead of `@ts-expect-error` (project convention per AGENTS.md).

**Tasks**:
- [x] Replace 3 instances of `@ts-ignore` with `@ts-expect-error` in helpers-example.test.ts

**Impact**: Follows project conventions

**Estimated Effort**: 5 minutes

---

## Code Quality Fixes

### [x] 43. Fix `any` Types in resources-prompts.test.ts
**Description**: `resources-prompts.test.ts` used `let client: any` in 4 describe blocks and had duplicate dynamic imports (`await import(...)`) alongside the static import.

**Tasks**:
- [x] Replace all `any` types with `MCPClient`
- [x] Remove redundant dynamic imports in `beforeEach`
- [x] Add custom matcher registration (`expect.extend`)
- [x] Replace `some((t: any) => ...)` with custom matchers using `@ts-expect-error`

**Impact**: Type safety, cleaner code

**Estimated Effort**: 30 minutes

---

### [x] 44. Fix `setElicitationHandler` `any` Types
**Description**: `setElicitationHandler` had signature `(request: any) => Promise<any>`, violating the "no any" principle.

**Tasks**:
- [x] Replace `any` with proper typed interface for elicitation request/response

**Impact**: Type safety for elicitation API

**Estimated Effort**: 15 minutes

---

### [x] 45. Improve Package Exports
**Description**: The library's main `index.ts` only re-exported from `client/index.ts`. Error classes, logger types, and utility types were not accessible to consumers.

**Tasks**:
- [x] Export all error classes from `src/index.ts`
- [x] Export `Logger`, `LoggerOptions`, `LogLevel` types
- [x] Export `RetryOptions` type from client index

**Impact**: Consumers can import error classes and types directly from `mcp-tester`

**Estimated Effort**: 15 minutes

---

### [x] 46. Clean npm Package Contents
**Description**: `npm pack` included 40 files, including test files from `dist/__tests__/` and their source maps. The published package should only contain the library code.

**Tasks**:
- [x] Update `files` field in package.json to explicitly include only `dist/client`, `dist/utils`, and `dist/index.*`
- [x] Verify package size reduced (40 → 28 files)

**Impact**: Smaller package, cleaner distribution

**Estimated Effort**: 15 minutes

---

## Dependency Updates

### [x] 47. Update MCP SDK Dependency
**Description**: `@modelcontextprotocol/sdk` was pinned at `^1.25.2`. Dependabot had an open PR to update to `1.29.0`.

**Tasks**:
- [x] Update to `@modelcontextprotocol/sdk@^1.29.0`
- [x] Verify build and all tests pass with new SDK version

**Impact**: Latest protocol features and bug fixes

**Estimated Effort**: 15 minutes

---

## High Priority Improvements

### [x] 1. Add Jest Test Helpers/Matchers
**Description**: Reduce boilerplate in test files with custom Jest matchers and helper functions.

**Tasks**:
- [x] Create `src/matchers.ts` with custom matchers (moved from `src/__tests__/`)
- [x] Add `toBeConnectedClient` matcher
- [x] ~~Create helpers.ts with test utilities~~ (removed — use `assert` module instead)
- [x] Add `createTestSuite()` helper for common setup patterns
- [x] Document usage in README

**Impact**: Reduces test boilerplate by ~40%

**Estimated Effort**: 2-3 hours

---

### [x] 2. Add Pre-commit Hooks (Husky + lint-staged)
**Description**: Automatically lint and format code before commits.

**Tasks**:
- [x] Install husky and lint-staged as dev dependencies
- [x] Configure `.husky/pre-commit` hook to run `lint-staged`
- [x] Add lint-staged configuration to package.json
- [x] `prepare` script auto-added by `husky init`
- [x] Configure lint-staged to run eslint + prettier on staged `.ts` files
- [x] Fix Husky compatibility with newer Node.js (`husky || true`)

**Impact**: Ensures code quality on every commit

**Estimated Effort**: 1 hour

---

### [x] 3. Publish to npm
**Description**: Publish package to npm registry for public use.

**Tasks**:
- [x] Verify package.json has all required fields
- [x] Ensure README has installation instructions for npm
- [x] Clean up npm package contents (exclude test files)
- [x] Add npm badge to README (added: downloads, license, updated test status)
- [x] Test local installation from tarball: `npm pack && npm install ./mcp-tester-*.tgz`
- [x] Run `npm publish`
- [x] Verify package can be installed: `npm install mcp-tester`

**Impact**: Enables public use, biggest improvement for adoption

**Estimated Effort**: 2-4 hours

---

### [x] 4. Add CLI Tool for Quick Server Validation
**Description**: Create command-line tool for quick MCP server testing.

**Tasks**:
- [x] Create `src/cli/index.ts` with commander.js
- [x] Implement basic server connection test (`test` command)
- [x] Add options for timeout, verbosity, log-level
- [x] Add `list-tools` / `lt` command
- [x] Add `call-tool` / `ct` command
- [x] Add `read-resource` / `rr` command
- [x] Add `get-prompt` / `gp` command
- [x] Add to package.json `bin` field
- [x] Test CLI with mock server
- [x] Document CLI usage in help text

**Impact**: Quick testing without writing test files

**Estimated Effort**: 4-6 hours

---

## Medium Priority Improvements

### [x] 5. Add Actual Test Coverage Report
**Description**: Document real coverage numbers and link to coverage reports.

**Tasks**:
- [x] Run `npm run test:coverage` — results: Stmts 76.77%, Branch 57.26%, Funcs 64.48%, Lines 76.19%
- [x] Document actual coverage percentages in README
- [x] Create realistic per-file coverage thresholds in jest.config.js
- [x] Set global thresholds below current values to prevent CI noise while allowing regression detection

**Resulting Thresholds** (jest.config.js):
| File | Stmts | Branch | Funcs | Lines |
|------|-------|--------|-------|-------|
| `src/assert.ts` | 96% | 87% | 100% | 96% |
| `src/matchers.ts` | 68% | 28% | 42% | 64% |
| `src/client/MCPClient.ts` | 66% | 53% | 75% | 66% |
| `src/utils/logger.ts` | 81% | 45% | 54% | 81% |
| `src/utils/errors.ts` | 73% | 0% | 66% | 73% |
| `src/utils/env.ts` | 80% | 100% | 60% | 87% |
| `src/__tests__/fixtures/mock-server.ts` | 96% | 64% | 94% | 96% |
| **Global floor** | 76% | 57% | 64% | 76% |

**Impact**: Transparency on test quality, realistic thresholds prevent CI noise

**Estimated Effort**: 30 minutes

---

### [x] 6. Add Integration Tests
**Description**: Test against real MCP servers, not just mock server.

**Tasks**:
- [x] Add test for `@modelcontextprotocol/server-everything`
- [x] Test all 16 tools (echo, get-sum, get-env, etc.)
- [x] Test resources and prompts
- [x] Test error handling
- [x] Test multiple sequential operations

**Impact**: Validates library works with real MCP servers

**Estimated Effort**: 4-6 hours

---

### [x] 7. Add Performance Benchmarks
**Description**: Add benchmark suite to measure performance.

**Tasks**:
- [x] Create `src/__tests__/benchmarks.ts` with 19 benchmarks across 7 categories
- [x] Measure connection startup/disconnect latency
- [x] Measure tool call latency (echo, add, delay)
- [x] Measure sequential batch tool calls (5, 10 tools)
- [x] Measure parallel throughput (5, 10, 20 concurrent calls)
- [x] Measure large payload handling (10KB, 100KB, 1MB)
- [x] Measure metadata listing (tools, resources, prompts, prompt args)
- [x] Measure full client lifecycle patterns
- [x] Use `perf_hooks.performance.now()` for timing
- [x] Document results in `docs/advanced.md` with reference numbers
- [x] Add `benchmark` script to package.json: `npm run benchmark`

**Reference numbers** (Node.js 24, Apple Silicon):
| Operation | Mean | Throughput |
|----------|------|------------|
| Single tool call | 0.19 ms | ~5,130 ops/s |
| 10 parallel calls | 0.55 ms total | ~18,200 ops/s |
| Server reconnect | 165 ms | ~6 ops/s |
| 1MB payload | 7.79 ms | ~1,080 Mbps |

**Impact**: Track performance over time, catch regressions

**Estimated Effort**: 3-4 hours

---

### [x] 8. Improve Error Messages
**Description**: Add contextual error information and actionable suggestions.

**Tasks**:
- [x] Enhance `MCPTimeoutError` with operation context, timeout value in message, and actionable suggestions
- [x] Improve `MCPConnectionError` with server command and command-specific suggestions (node/python/npx)
- [x] Enhance `MCPServerError` with operation context and `serverCode` property (extracts MCP error code)
- [x] Improve `MCPNotStartedError` to include which method was called
- [x] Improve `MCPAlreadyStartedError` with actionable message ("Call stop() or create new MCPClient")
- [x] Add 28 tests for error classes in `errors.test.ts`
- [x] Update `docs/api-reference.md` with full error property documentation
- [x] Update README test count (227 → 257)

**Resulting Error Properties**:
| Error | New Properties |
|-------|---------------|
| `MCPTimeoutError` | `.timeout`, `.operation`, `.suggestions[]` |
| `MCPConnectionError` | `.command`, `.suggestions[]` |
| `MCPNotStartedError` | `.method` (which method was called) |
| `MCPAlreadyStartedError` | `.message` now includes "Call stop()" and "new MCPClient" |
| `MCPServerError` | `.operation`, `.serverCode` (extracted from MCP error) |

**Impact**: Better developer experience when errors occur

**Estimated Effort**: 2-3 hours

---

### [ ] 48. Triage Open Dependabot PRs
**Description**: 14 Dependabot PRs are open and unmerged. Some contain major version bumps (ESLint 8→10, TypeScript 5→6) that need careful review.

**Tasks**:
- [ ] Review ESL 8→10 PR (breaking changes in config format)
- [ ] Review TypeScript 5→6 PR (may require code changes)
- [ ] Review `@typescript-eslint/*` 7→8 PRs
- [ ] Review `@types/node` 20→25 PRs
- [ ] Close/merge safe minor/patch PRs
- [ ] Add breaking major bumps to roadmap with proper planning

**Impact**: Security, up-to-date dependencies without broken builds

**Estimated Effort**: 2-3 hours

---

## Low Priority / Nice to Have

### [x] 9. Add TypeDoc API Documentation
**Description**: Generate comprehensive API documentation.

**Tasks**:
- [x] Install typedoc and typedoc-plugin-markdown
- [x] Add JSDoc comments to MCPClient class and methods
- [x] Add JSDoc to utility classes (errors, logger)
- [x] Add JSDoc to index.ts
- [x] Create typedoc.json configuration
- [x] Add `docs` script to package.json
- [x] Generate API documentation in docs/api/
- [x] Update README.md with API docs link

**Impact**: Better API reference for users

**Estimated Effort**: 2-3 hours

---

### [ ] 10. Add HTTP Transport Support
**Description**: Support HTTP-based MCP servers in addition to stdio.

**Tasks**:
- Research HTTP transport in MCP specification
- Create `HttpMCPClient` class or extend existing
- Add `MCPHttpConfig` interface
- Implement HTTP transport using fetch
- Add tests for HTTP transport
- Document HTTP vs stdio trade-offs
- Update examples to show both transports

**Impact**: Enables testing of remote MCP servers

**Estimated Effort**: 8-12 hours

---

### [x] 11. Add Test Code Generator
**Description**: CLI tool to generate test boilerplate from server inspection.

**Tasks**:
- [x] Create `src/generate-tests.ts` with `generateTests()` function
- [x] Add `generate` command to CLI (`mcp-tester generate` / `mcp-tester gen`)
- [x] Connect to server, list tools/resources/prompts in parallel
- [x] Generate test file with all available endpoints
- [x] Generate sample arguments from JSON Schema (types, enums, defaults, examples)
- [x] Support `--framework jest|vitest` flag
- [x] Support `--output <file>` to write to file (stdout by default)
- [x] Support `--description` for custom suite name
- [x] Support `--no-tools`, `--no-resources`, `--no-prompts`, `--no-matchers` flags
- [x] Export `generateTests()` and `GenerateTestOptions` from package index
- [x] 21 tests in `generate-tests.test.ts`
- [x] Document in CLI help and examples

**Impact**: Quick test scaffolding for new servers — one command generates a full test suite

**Estimated Effort**: 6-8 hours

---

### [postponed] 12. Add Snapshot Testing Support
**Description**: Support Jest snapshot testing for tools/resources/prompts.

**Reason for postponement**: Snapshot testing is a poor fit for MCP testing — assertions are more intentional, `jest -u` is a blunt tool that can accept bugs, and dynamic responses cause false failures. A schema diff utility would be more valuable.

**Tasks**:
- Add snapshot tests to existing test suite
- Document when to use snapshots vs assertions
- Add helper for snapshot updates
- Document snapshot testing best practices
- Update AGENTS.md with snapshot patterns

**Impact**: Easier detection of API changes

**Estimated Effort**: 1-2 hours

---

### [ ] 13. Add TypeScript Types for Tool Schemas
**Description**: Generate TypeScript types from tool schemas.

**Tasks**:
- Research JSON Schema to TypeScript generation
- Create utility to generate types from tool schemas
- Add `generate-types` CLI command
- Support nested schemas and arrays
- Document usage
- Add example in examples/

**Impact**: Type-safe tool calling

**Estimated Effort**: 6-8 hours

---

### [x] 14. Better Mock Server
**Description**: Enhance mock server for more realistic testing scenarios.

**Tasks**:
- [x] Replace `any` types with proper MCP SDK types in MockMCPServer
- [x] Add simulated delays (configurable `defaultDelay`)
- [x] Add random failures (`failureRate` 0-1, custom `failureMessage`)
- [x] Add tools that return different results based on input (`transform`, `counter`, `items`)
- [x] Add support for streaming responses (`setupStream`, `nextStreamChunk`)
- [x] Add validation of input schemas (`validateSchemas` option)
- [x] Document mock server capabilities

**New Tools**:
| Tool | Description |
|------|-------------|
| `counter` | Stateful counter: increment/get/reset |
| `items` | Stateful item list: add/list/remove/clear |
| `transform` | Input-based transforms: upper/lower/reverse/length |

**New Features**:
- `MockServerConfig` — `defaultDelay`, `failureRate`, `validateSchemas`, `failureMessage`
- Custom handlers: `registerToolHandler`, `registerResourceHandler`, `registerPromptHandler`
- Call history: `getCallHistory`, `getCallCount`
- Streaming: `setupStream`, `nextStreamChunk`
- Dynamic registration: `addTool/addResource/addPrompt`, `removeTool/removeResource/removePrompt`
- `resetState()` clears counters, items, history, streams
- 68 tests in `mock-server.test.ts`

**Impact**: Better unit testing — test retry logic, delays, stateful interactions, schema validation

**Estimated Effort**: 4-6 hours

---

### [x] 15. Add Example MCP Servers
**Description**: Include example MCP servers for testing.

**Tasks**:
- [x] Create `examples/simple-server.ts` (minimal TypeScript server — greet tool, version resource, welcome prompt)
- [x] Create `examples/stateful-server.ts` (counter + todo list with mutable state and notifications)
- [x] Create `examples/stateful-server-test.ts` (testing patterns for stateful servers)
- [x] Update `docs/examples.md` with server descriptions and run commands
- [x] Update README project structure and AGENTS.md key files table

**Example Servers**:
| Server | Description |
|--------|-------------|
| `mock-server.js` | Basic JS server: echo, add, delay, error_tool + 2 resources + 2 prompts |
| `simple-server.ts` | Minimal TS server: greet tool, version resource, welcome prompt |
| `stateful-server.ts` | Stateful server: counter (increment/get/reset), todos (add/list/complete) + notifications |

**Impact**: Better learning materials, realistic testing patterns

**Estimated Effort**: 3-4 hours

---

## Documentation Improvements

### [x] 16. Mention AGENTS.md in README
**Description**: Add reference to AGENTS.md in README for AI agents.

**Tasks**:
- [x] Add "For AI Agents" section to README
- [x] Link to AGENTS.md
- [x] Brief description of what AGENTS.md contains

**Impact**: Helps AI agents work with the codebase

**Estimated Effort**: 15 minutes

---

### [x] 17. Create Comprehensive Documentation (AGENTS.md & TODO.md)
**Description**: Create detailed documentation for AI agents and project roadmap.

**Tasks**:
- [x] Create AGENTS.md with essential commands, patterns, conventions, gotchas
- [x] Document project overview, code organization, naming conventions
- [x] Add testing approach with examples and patterns
- [x] Document CI/CD integration, error handling, development workflow
- [x] Add key files reference, common tasks, environment variables
- [x] Create TODO.md with improvement tasks
- [x] Organize tasks by priority
- [x] Add status indicators and progress tracking

**Impact**: Improves AI agent productivity, provides clear roadmap for improvements

**Estimated Effort**: 4-6 hours

---

### [x] 18. Add Troubleshooting Section to README
**Description**: Comprehensive troubleshooting guide in README.

**Tasks**:
- [x] Create "Troubleshooting" section in README
- [x] Cover: "Client not started" error (MCPNotStartedError)
- [x] Cover: Timeout errors with code examples
- [x] Cover: Server won't start (MCPConnectionError)
- [x] Cover: ESM import errors (.js extension)
- [x] Cover: Tests fail in CI (maxWorkers, Node version)
- [x] Cover: Debug mode (logLevel, enableProtocolLogging)
- [x] Link to docs/troubleshooting.md for full guide

**Impact**: Reduce support burden

**Estimated Effort**: 1 hour

---

### [ ] 19. Add More Language Examples
**Description**: Examples for testing MCP servers in different languages.

**Tasks**:
- Add example for Python server testing
- Add example for TypeScript server testing
- Add example for Bash script servers
- Document language-specific considerations
- Update README with language examples

**Impact**: Broader language support

**Estimated Effort**: 2-3 hours

---

### [x] 20. Add Architecture Diagram
**Description**: Visual diagram of how mcp-tester works.

**Tasks**:
- [x] Create ASCII diagram of architecture in README
- [x] Show MCPClient, MCP Server, Jest/Vitest/assert relationship
- [x] Show data flow (JSON-RPC over stdio)
- [x] Show error handling layer (Retry/Timeout/Error classes)
- [x] Include in README (after Capabilities, before Why MCP Tester)

**Impact**: Better understanding of system design

**Estimated Effort**: 1 hour

---

## Developer Experience

### [x] 21. Add VS Code Snippets
**Description**: Code snippets for common test patterns.

**Tasks**:
- [x] Create `.vscode/mcp-tester.code-snippets`
- [x] Add snippet for test suite (`mcp-test`)
- [x] Add snippet for tool call test (`mcp-tool`)
- [x] Add snippet for resource test (`mcp-resource`)
- [x] Add snippet for prompt test (`mcp-prompt`)
- [x] Add snippet for client setup (`mcp-client`, `mcp-client-opts`)
- [x] Add snippet for error handling (`mcp-error`)
- [x] Add snippet for parallel calls (`mcp-parallel`)
- [x] Add snippet for list+assert (`mcp-list-tools`, `mcp-list-resources`, `mcp-list-prompts`)
- [x] Add snippet for assertions (`mcp-assert-text`, `mcp-assert-json`)
- [x] Add snippet for notifications (`mcp-notifications`)
- [x] Add snippet for imports (`mcp-import`, `mcp-import-full`)
- [x] Document available snippets in README

**Impact**: Faster test writing in VS Code

**Estimated Effort**: 1 hour

---

### [x] 22. Add Watch Mode for Development
**Description**: Hot-reload development mode.

**Tasks**:
- [x] Add `dev` script to package.json (`tsc --watch`)
- [x] Document watch mode in README and AGENTS.md essential commands

**Impact**: Faster development cycle — no manual `npm run build` after edits

**Estimated Effort**: 1 hour

---

### [x] 23. Add Better Debug Logging
**Description**: Enhanced logging for debugging issues.

**Tasks**:
- [x] Add request/response timing to logger — every operation now logs elapsed ms
- [x] Add JSON pretty-printing for protocol messages (`prettyPrint()`)
- [x] Add colored output for different log levels (cyan/debug, green/info, yellow/warn, red/error)
- [x] Add timestamps option (`new ConsoleLogger({ timestamps: true })`)
- [x] Add `startTimer()` utility for measuring operation duration
- [x] Integrate timing into MCPClient: listTools/callTool/listResources/readResource/listPrompts/getPrompt all log `X in Nms`
- [x] Add `prettyPrint()` to protocol logging (args masked, JSON-formatted)
- [x] Export `startTimer` and `prettyPrint` from package index
- [x] 22 tests in `logger.test.ts`
- [x] Document in docs/api-reference.md and README troubleshooting

**New Logger Options**:
```typescript
new ConsoleLogger({
  level: 'debug',
  prefix: 'MyApp',
  timestamps: true,    // ← NEW: include ISO timestamps
  colors: true,       // ← NEW: colored output (auto-disabled in non-TTY)
  maskSecrets: true,   // already existed, now defaults to true
});
```

**New Exports**:
- `startTimer()` — returns `() => number` (elapsed ms since call)
- `prettyPrint(value, mask?)` — JSON pretty-print with secret masking

**Impact**: Easier troubleshooting — timing in debug logs, pretty-printed protocol messages

**Estimated Effort**: 2-3 hours

---

## Security & Reliability

### [x] 24. Add Input Validation
**Description**: Validate all inputs to client methods.

**Tasks**:
- [x] Create `src/utils/validation.ts` with validation functions
- [x] Validate `start()` config (command, args, env, startupDelay)
- [x] Validate `callTool()` options (name, arguments, timeout, retries)
- [x] Validate `readResource()` URI (non-empty string)
- [x] Validate `getPrompt()` name and arguments (non-empty name, string-valued args)
- [x] Validate `requestSampling()` params (non-empty messages array)
- [x] Validate constructor options (timeout, retries, retryDelay, startupDelay, etc.)
- [x] Throw descriptive `MCPClientError` with actionable messages for invalid inputs
- [x] Validation runs before connection-state checks (invalid args error, not "not started")
- [x] 91 tests in `validation.test.ts` (unit + MCPClient integration)

**Impact**: Better error messages, catches bugs early, prevents silent failures

**Estimated Effort**: 3-4 hours

---

### [ ] 25. Add Server Health Checks
**Description**: Periodic health checks for server process.

**Tasks**:
- Implement health check mechanism
- Add `isHealthy()` method
- Detect zombie processes
- Auto-restart on server crash (optional)
- Add health check tests

**Impact**: More reliable testing

**Estimated Effort**: 4-6 hours

---

### [x] 26. Add Secret Masking in Logs
**Description**: Automatically mask sensitive data in logs.

**Tasks**:
- [x] Create `src/utils/masking.ts` with secret detection patterns
- [x] Built-in patterns: OpenAI/Anthropic keys, AWS keys, Bearer tokens, JWTs, hex tokens, URL creds, key-value pairs
- [x] Built-in env var masking: 30+ sensitive key names (API_KEY, PASSWORD, TOKEN, DATABASE_URL, etc.)
- [x] `maskSecrets()` function integrated into `ConsoleLogger.format()`
- [x] Configurable: `addSecretPattern()`, `resetSecretPatterns()`, `getSecretPatterns()`, `getSensitiveEnvKeys()`
- [x] Disable masking per-logger: `new ConsoleLogger({ maskSecrets: false })`
- [x] Exported from package index: `maskSecrets`, `maskValue`, `addSecretPattern`, `resetSecretPatterns`, `getSecretPatterns`, `getSensitiveEnvKeys`
- [x] 27 tests in `masking.test.ts`
- [x] Documented in `docs/api-reference.md` Secret Masking section

**Impact**: Security — prevents accidental secret leaks in debug output

**Estimated Effort**: 2-3 hours

---

## Testing Enhancements

### [ ] 27. Add E2E Tests
**Description**: End-to-end tests covering complete workflows.

**Tasks**:
- Create `src/__tests__/e2e/` directory
- Add test for full server lifecycle
- Add test for error recovery
- Add test for concurrent operations
- Add test for large payload handling
- Add to CI test suite

**Impact**: Better confidence in system

**Estimated Effort**: 4-6 hours

---

### [x] 28. Add Property-Based Testing
**Description**: Use property-based testing (fast-check) for robustness of pure utility functions.

**Tasks**:
- [x] Install fast-check library as dev dependency
- [x] 44 validation property tests — reject/accept for all input types, error code invariants
- [x] 17 masking property tests — idempotency, completeness, secret detection, length bounds
- [x] 12 generate-tests property tests — no-throw, serializability, enum/default/example priority, nested schemas
- [x] Configure fast-check with 25 runs per property (fast CI)
- [x] All 73 tests pass in ~1s

**Scope**: Pure functions only (validation.ts, masking.ts, generate-tests.ts). Async/stateful MCP client methods are not suitable for property-based testing.

**Key Findings**:
- maskSecrets env var regex requires 4+ non-whitespace/non-quote chars — short values aren't masked
- maskValue preserves first/last 3 chars — secrets under ~12 chars may be partially reconstructable
- generateSampleValue never crashes on any JSON Schema combination

**Impact**: Catches edge cases manual tests miss — e.g., AWS key filter starvation, quote chars in env values

**Estimated Effort**: 4-6 hours

---

### [x] 29. Add Visual Test Reports
**Description**: Generate HTML test reports with jest-html-reporters.

**Tasks**:
- [x] Install jest-html-reporters as dev dependency
- [x] Configure reporters in jest.config.js with `publicPath: './reports'`
- [x] Add `reports/` to `.gitignore`
- [x] Upload report as CI artifact (14-day retention, all Node versions)
- [x] Report auto-generated on every `npm test` run
- [x] Open report: `open reports/test-report.html`

**Impact**: Visual test results in CI artifacts and local dev — collapsible test trees, timing, failure details

**Estimated Effort**: 1-2 hours

---

## CI/CD Improvements

### [ ] 30. Add Release Automation
**Description**: Automate more of release process.

**Tasks**:
- Add conventional-changelog for CHANGELOG generation
- Add semantic-release for versioning
- Configure automated npm publishing
- Add GitHub release notes generation
- Test release automation thoroughly

**Impact**: Smoother releases

**Estimated Effort**: 4-6 hours

---

### [x] 31. Add Dependabot
**Description**: Automated dependency updates.

**Tasks**:
- [x] Create `.github/dependabot.yml`
- [x] Configure for production and dev dependencies
- [x] Set review rules
- [x] Test PR creation

**Impact**: Security, up-to-date dependencies

**Estimated Effort**: 1 hour

---

### [x] 32. Add Code Coverage Comments
**Description**: Comment PRs with coverage changes.

**Tasks**:
- [x] Add dedicated `coverage` job in CI workflow (runs on single Node version, not matrix)
- [x] Generate `coverage-summary.json` via `coverageReporters` in jest.config.js
- [x] Add coverage data extraction step (extract statements/branches/functions/lines)
- [x] Add PR comment with coverage table using `marocchino/sticky-pull-request-comment@v2`
- [x] Include per-file coverage thresholds in jest.config.js
- [x] Upload coverage to Codecov via `codecov/codecov-action@v4`
- [x] Coverage badges in README updated with real numbers

**Impact**: Visibility into coverage changes on every PR

**Estimated Effort**: 1 hour

---

## Community & Ecosystem

### [ ] 33. Add Examples Repository
**Description**: Separate repository with example MCP servers and tests.

**Tasks**:
- Create new repo: `mcp-tester-examples`
- Add various MCP server examples
- Add test files for each example
- Link from main README
- Document examples

**Impact**: Better learning resources

**Estimated Effort**: 8-10 hours

---

### [ ] 34. Create Starter Templates
**Description**: Starter templates for common use cases.

**Tasks**:
- Create template for simple MCP server
- Create template for complex MCP server
- Create template for CI/CD setup
- Document how to use templates
- Link from README

**Impact**: Faster project setup

**Estimated Effort**: 4-6 hours

---

### [ ] 35. Add Contributing Guide Enhancement
**Description**: Improve CONTRIBUTING.md with more details.

**Tasks**:
- Add development setup screenshots
- Add debugging tips
- Add code review checklist
- Add PR template
- Add issue templates

**Impact**: Better contributor experience

**Estimated Effort**: 2-3 hours

---

## Future / Experimental

### [ ] 36. Add Browser Support
**Description**: Run mcp-tester in browser environments.

**Tasks**:
- Research browser transport for MCP
- Implement WebSocket transport
- Add browser-specific tests
- Document browser limitations
- Update CI for browser testing

**Impact**: Web-based testing

**Estimated Effort**: 12-16 hours

---

### [ ] 37. Add Plugin System
**Description**: Allow plugins to extend functionality.

**Tasks**:
- Design plugin interface
- Implement plugin loading
- Create example plugins
- Document plugin development
- Add plugin marketplace links

**Impact**: Extensibility

**Estimated Effort**: 16-20 hours

---

### [ ] 38. Add Distributed Testing
**Description**: Test across multiple servers simultaneously.

**Tasks**:
- Design multi-server client API
- Implement concurrent server management
- Add aggregate reporting
- Add load testing capabilities
- Document distributed testing patterns

**Impact**: Test complex systems

**Estimated Effort**: 12-16 hours

---

### [ ] 39. Add AI-Powered Test Generation
**Description**: Use AI to generate tests from server analysis.

**Tasks**:
- Research AI code generation
- Integrate with AI API (optional)
- Generate intelligent test cases
- Suggest edge cases
- Add `--ai-generate` CLI flag

**Impact**: Automated test creation

**Estimated Effort**: 16-24 hours

---

---

## Quick Wins (Under 1 hour each)

The following tasks can be completed quickly and provide immediate value:

- [x] Add npm badges to README (version, license, downloads)
- [x] Fix duplicate process spawn bug
- [x] Fix broken example files
- [x] Fix `@ts-ignore` → `@ts-expect-error`
- [x] Fix `any` types in test files
- [x] Fix `any` types in `setElicitationHandler`
- [x] Improve package exports (error classes, logger types)
- [x] Clean npm package contents (exclude test files)
- [x] Update MCP SDK dependency
- [x] Add pre-commit hooks (Husky + lint-staged)
- [x] Fix failing everything-server tests (timeout + wrong args)
- [x] Make MCPTimeoutError and MCPConnectionError actually thrown
- [x] Replace CLI manual help with Commander native help
- [ ] Add Codecov badge to README
- [ ] Add Node.js compatibility badge
- [ ] Add architecture diagram to README
- [ ] Add VS Code snippets for test patterns
- [ ] Add watch mode for development
- [ ] Triage open Dependabot PRs
- [ ] Add property-based tests for critical paths
- [ ] Add visual test reports

---

## Priority Summary

### Completed ✅
1. ~~Add test helpers/matchers~~
2. ~~Add pre-commit hooks~~
3. ~~Fix duplicate process spawn bug~~
4. ~~Fix broken examples~~
5. ~~Fix type safety issues~~
6. ~~Clean npm package~~
7. ~~Update SDK dependency~~
8. ~~Add Dependabot~~

### Must Have (High Impact, Low Effort)
1. ~~Publish to npm~~ ✅
2. ~~Add CLI tool~~ ✅
3. ~~Triage Dependabot PRs~~ ✅

### Should Have (Good Impact, Reasonable Effort)
4. Add integration tests
5. ~~Improve error messages~~ ✅
6. ~~Add performance benchmarks~~ ✅
7. Better mock server (remove `any` types) ✅
8. ~~Add architecture diagram~~ ✅

### Nice to Have (Lower Priority)
8. HTTP transport support
9. TypeDoc API documentation
10. Test code generator
11. TypeScript types for tool schemas

---

## Progress Tracking

**Total Items**: 48
**Completed**: 35
**In Progress**: 0
**Not Started**: 13

**Completion Percentage**: 72.9%

---

## Notes

- All effort estimates are approximate and may vary
- Items can be implemented in any order based on needs
- Community feedback may influence priority
- This document will be updated regularly
- Items 40-48 were added from code review / audit findings (2026-04-08)

For more information on working with this codebase, see [AGENTS.md](./AGENTS.md).

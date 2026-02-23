# TODO.md - Roadmap and Improvements

This document tracks planned improvements, features, and enhancements for mcp-tester.

## Status Legend
- `[ ]` - Not implemented / Not started
- `[/]` - In progress
- `[x]` - Implemented / Completed

---

## High Priority Improvements

### [ ] 1. Add Jest Test Helpers/Matchers
**Description**: Reduce boilerplate in test files with custom Jest matchers and helper functions.

**Tasks**:
- Create `src/__tests__/matchers.ts` with custom matchers
- Add `toBeConnectedClient` matcher
- Create `src/__tests__/helpers.ts` with test utilities
- Add `createTestSuite()` helper for common setup patterns
- Document usage in README

**Impact**: Reduces test boilerplate by ~40%

**Estimated Effort**: 2-3 hours

---

### [ ] 2. Add Pre-commit Hooks (Husky + lint-staged)
**Description**: Automatically lint and format code before commits.

**Tasks**:
- Install husky and lint-staged as dev dependencies
- Configure `.husky/pre-commit` hook
- Add lint-staged configuration to package.json
- Add `prepare` script to package.json
- Test pre-commit hooks work correctly

**Impact**: Ensures code quality on every commit

**Estimated Effort**: 1 hour

---

### [/] 3. Publish to npm
**Description**: Publish package to npm registry for public use.

**Tasks**:
- Verify package.json has all required fields
- Ensure README has installation instructions for npm
- Test local installation from tarball: `npm pack && npm install ./mcp-tester-*.tgz`
- Create npm account (if not exists)
- Run `npm publish`
- Verify package can be installed: `npm install mcp-tester`
- Add npm badge to README

**Impact**: Enables public use, biggest improvement for adoption

**Estimated Effort**: 2-4 hours

---

### [ ] 4. Add CLI Tool for Quick Server Validation
**Description**: Create command-line tool for quick MCP server testing.

**Tasks**:
- Create `src/cli.ts` with commander.js
- Implement basic server connection test
- Add options for timeout, verbosity
- Add commands: `test`, `list-tools`, `call-tool`
- Add to package.json `bin` field
- Test CLI with various servers
- Document CLI usage in README

**Impact**: Quick testing without writing test files

**Estimated Effort**: 4-6 hours

---

## Medium Priority Improvements

### [ ] 5. Add Actual Test Coverage Report
**Description**: Document real coverage numbers and link to coverage reports.

**Tasks**:
- Run `npm run test:coverage`
- Document actual coverage percentages in README
- Add Codecov badge to README (if configured)
- Create coverage thresholds based on current state
- Link to coverage reports in CI

**Impact**: Transparency on test quality

**Estimated Effort**: 30 minutes

---

### [ ] 6. Add Integration Tests
**Description**: Test against real MCP servers, not just mock server.

**Tasks**:
- Create `src/__tests__/integration/` directory
- Add test for `@modelcontextprotocol/server-filesystem`
- Add test for `@modelcontextprotocol/server-github`
- Create optional integration test suite (skip by default)
- Document how to run integration tests
- Add to CI (optional with flag)

**Impact**: Validates compatibility with real servers

**Estimated Effort**: 4-6 hours

---

### [ ] 7. Add Performance Benchmarks
**Description**: Add benchmark suite to measure performance.

**Tasks**:
- Create `src/__tests__/benchmarks.ts`
- Add benchmark for tool call latency
- Add benchmark for concurrent operations
- Add benchmark for large payloads
- Use `perf_hooks` for timing
- Document performance characteristics
- Add performance regression detection in CI

**Impact**: Track performance over time

**Estimated Effort**: 3-4 hours

---

### [ ] 8. Improve Error Messages
**Description**: Add contextual error information and actionable suggestions.

**Tasks**:
- Enhance `MCPTimeoutError` with operation context and timeout increase suggestion
- Improve `MCPConnectionError` with common failure reasons
- Add stack trace hints for debugging
- Include server startup logs in error context when available
- Document all error codes in README
- Add troubleshooting examples to README

**Impact**: Better developer experience when errors occur

**Estimated Effort**: 2-3 hours

---

## Low Priority / Nice to Have

### [ ] 9. Add TypeDoc API Documentation
**Description**: Generate comprehensive API documentation.

**Tasks**:
- Install typedoc as dev dependency
- Configure typedoc options
- Add script to package.json: `"docs": "typedoc --out docs src"`
- Ensure all public APIs have JSDoc comments
- Generate documentation
- Add link to docs in README
- Optionally deploy docs to GitHub Pages

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

### [ ] 11. Add Test Code Generator
**Description**: CLI tool to generate test boilerplate from server inspection.

**Tasks**:
- Create `src/generate-tests.ts`
- Add `generate` command to CLI
- Connect to server, list tools/resources/prompts
- Generate test file with all available endpoints
- Include optional test for each tool with sample args
- Add command-line options for output file, template
- Document usage

**Impact**: Quick test scaffolding for new servers

**Estimated Effort**: 6-8 hours

---

### [ ] 12. Add Snapshot Testing Support
**Description**: Support Jest snapshot testing for tools/resources/prompts.

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

### [ ] 14. Better Mock Server
**Description**: Enhance mock server for more realistic testing scenarios.

**Tasks**:
- Add simulated delays (configurable)
- Add random failures (for testing retry logic)
- Add tools that return different results based on input
- Add support for streaming responses
- Add tool that throws errors for error testing
- Add validation of input schemas
- Document mock server capabilities

**Impact**: Better unit testing without real servers

**Estimated Effort**: 4-6 hours

---

### [ ] 15. Add Example MCP Servers
**Description**: Include example MCP servers for testing.

**Tasks**:
- Create `examples/simple-server.js` (minimal implementation)
- Create `examples/advanced-server.ts` (full-featured)
- Document how to run each example
- Add tests for example servers
- Include examples in README quick start

**Impact**: Better learning materials

**Estimated Effort**: 3-4 hours

---

## Documentation Improvements

### [x] 16. Mention AGENTS.md in README
**Description**: Add reference to AGENTS.md in README for AI agents.

**Tasks**:
- Add "For AI Agents" section to README
- Link to AGENTS.md
- Brief description of what AGENTS.md contains

**Impact**: Helps AI agents work with the codebase

**Estimated Effort**: 15 minutes

---

### [x] 17. Create Comprehensive Documentation (AGENTS.md & TODO.md)
**Description**: Create detailed documentation for AI agents and project roadmap.

**Tasks**:
- Create AGENTS.md (557 lines) with essential commands, patterns, conventions, gotchas
- Document project overview, code organization, naming conventions
- Add testing approach with examples and patterns
- Document CI/CD integration, error handling, development workflow
- Add key files reference, common tasks, environment variables
- Create TODO.md (719 lines) with 38 improvement tasks
- Organize tasks by priority (High, Medium, Low)
- Add status indicators ([ ], [/], [x]) and progress tracking
- Include task descriptions, subtasks, impact, effort estimates
- Add quick wins summary and priority sections
- Update AGENTS.md with Roadmap section linking to TODO.md

**Impact**: Improves AI agent productivity, provides clear roadmap for improvements

**Estimated Effort**: 4-6 hours

---

### [ ] 18. Add Troubleshooting Section to README
**Description**: Comprehensive troubleshooting guide in README.

**Tasks**:
- Create "Troubleshooting" section in README
- Add common issues and solutions:
  - "Module not found" errors
  - Server won't start
  - Timeout issues
  - Permission errors
  - ESM import issues
- Add debugging tips
- Link to AGENTS.md for detailed patterns

**Impact**: Reduce support burden

**Estimated Effort**: 2-3 hours

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

### [ ] 20. Add Architecture Diagram
**Description**: Visual diagram of how mcp-tester works.

**Tasks**:
- Create ASCII diagram of architecture
- Show MCPClient, MCP Server, Jest relationship
- Include in README
- Optionally create mermaid diagram for better rendering

**Impact**: Better understanding of system design

**Estimated Effort**: 1 hour

---

## Developer Experience

### [ ] 21. Add VS Code Snippets
**Description**: Code snippets for common test patterns.

**Tasks**:
- Create `.vscode/mcp-tester.code-snippets`
- Add snippet for test suite
- Add snippet for basic test
- Add snippet for tool call test
- Add snippet for resource test
- Document available snippets in README

**Impact**: Faster test writing in VS Code

**Estimated Effort**: 1-2 hours

---

### [ ] 22. Add Watch Mode for Development
**Description**: Hot-reload development mode.

**Tasks**:
- Install tsx and nodemon
- Add `dev` script to package.json
- Configure nodemon to watch src/
- Document watch mode usage
- Add to README development section

**Impact**: Faster development cycle

**Estimated Effort**: 1 hour

---

### [ ] 23. Add Better Debug Logging
**Description**: Enhanced logging for debugging issues.

**Tasks**:
- Add request/response timing to logger
- Add JSON pretty-printing for protocol messages
- Add colored output for different log levels
- Add `verbose` mode for detailed debugging
- Add log filtering options
- Document debug logging in README

**Impact**: Easier troubleshooting

**Estimated Effort**: 2-3 hours

---

## Security & Reliability

### [ ] 24. Add Input Validation
**Description**: Validate all inputs to client methods.

**Tasks**:
- Add validation for `start()` config
- Add validation for tool arguments
- Add validation for resource URIs
- Add validation for prompt arguments
- Throw descriptive errors for invalid inputs
- Add tests for validation

**Impact**: Better error messages, security

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

### [ ] 26. Add Secret Masking in Logs
**Description**: Automatically mask sensitive data in logs.

**Tasks**:
- Add secret detection patterns (API keys, tokens, passwords)
- Mask secrets in debug logs
- Add configurable secret patterns
- Document secret masking behavior

**Impact**: Security, prevents accidental secret leaks

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

### [ ] 28. Add Property-Based Testing
**Description**: Use property-based testing for robustness.

**Tasks**:
- Install fast-check library
- Add property-based tests for tool calls
- Add tests with random inputs
- Add invariant testing
- Document property-based testing patterns

**Impact**: Catch edge cases

**Estimated Effort**: 4-6 hours

---

### [ ] 29. Add Visual Test Reports
**Description**: Generate visual test reports.

**Tasks**:
- Install jest-html-reporters
- Configure HTML report generation
- Add script for viewing reports
- Add to CI artifacts
- Document report viewing

**Impact**: Better test result visualization

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

### [ ] 31. Add Dependabot
**Description**: Automated dependency updates.

**Tasks**:
- Create `.github/dependabot.yml`
- Configure for production and dev dependencies
- Set review rules
- Test PR creation
- Document dependency update process

**Impact**: Security, up-to-date dependencies

**Estimated Effort**: 1 hour

---

### [ ] 32. Add Code Coverage Comments
**Description**: Comment PRs with coverage changes.

**Tasks**:
- Install codecov-actions
- Configure coverage comments
- Add coverage checks to PRs
- Document coverage expectations

**Impact**: Awareness of coverage impact

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

- [ ] Add npm badges to README (version, license, downloads)
- [ ] Add Codecov badge to README
- [ ] Add Node.js compatibility badge
- [ ] Add AGENTS.md mention to README
- [ ] Add architecture diagram to README
- [ ] Add VS Code snippets for test patterns
- [ ] Add watch mode for development
- [ ] Configure Dependabot
- [ ] Add property-based tests for critical paths
- [ ] Add visual test reports

---

## Priority Summary

### Must Have (High Impact, Low Effort)
1. Publish to npm
2. Add CLI tool
3. Add pre-commit hooks
4. Add test helpers/matchers

### Should Have (Good Impact, Reasonable Effort)
5. Add integration tests
6. Improve error messages
7. Add performance benchmarks
8. Better mock server

### Nice to Have (Lower Priority)
9. HTTP transport support
10. TypeDoc API documentation
11. Test code generator
12. TypeScript types for tool schemas

---

## Progress Tracking

**Total Items**: 39
**Completed**: 2
**In Progress**: 1
**Not Started**: 36

**Completion Percentage**: 5.1%

---

## Notes

- All effort estimates are approximate and may vary
- Items can be implemented in any order based on needs
- Community feedback may influence priority
- This document will be updated regularly

For more information on working with this codebase, see [AGENTS.md](./AGENTS.md).

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Configurable logging system with multiple log levels (debug, info, warn, error, none)
- Custom error classes (MCPClientError, MCPTimeoutError, MCPConnectionError, MCPNotStartedError, MCPAlreadyStartedError, MCPServerError)
- Retry logic with exponential backoff for failed requests
- Protocol logging option for debugging MCP communication
- `setLogLevel()` method to dynamically change log level at runtime
- `logLevel`, `enableProtocolLogging`, `retries`, `retryDelay`, and `startupDelay` configuration options
- Comprehensive JSDoc comments for all public APIs
- Utility functions for environment variable filtering and merging
- Better process cleanup with SIGTERM and SIGKILL
- Comprehensive AGENTS.md documentation (557 lines) for AI agents working with the codebase
- Detailed TODO.md roadmap (719 lines) with 38 improvement tasks organized by priority
- Progress tracking system in TODO.md with status indicators ([ ] not started, [/] in progress, [x] completed)
- Package metadata for npm publishing: repository, bugs, homepage fields added to package.json
- .npmignore file created to control what files are published to npm
- Roadmap section in AGENTS.md linking to TODO.md for planned improvements
- "For AI Agents" section added to README.md with comprehensive description and link to AGENTS.md
- AGENTS.md link added to README.md Table of Contents and Additional Resources section
- Dependabot configuration (.github/dependabot.yml) for automated npm dependency updates
- Weekly dependency update schedule with Monday 05:00 UTC check
- Automatic PRs for dependency updates with "dependencies", "npm", and "dependabot" labels
- Additional npm badges added to README.md:
  - npm downloads badge (monthly download count)
  - npm license badge
  - Updated GitHub Actions test status badge to use correct repository URL
- Test helpers and custom matchers for Jest:
  - `src/__tests__/matchers.ts` with custom Jest matchers:
    - `toHaveTool(toolName)` - Check if tool exists
    - `toHaveResource(uri)` - Check if resource exists
    - `toHavePrompt(promptName)` - Check if prompt exists
    - `toHaveToolWithSchema(toolName)` - Check if tool has schema
  - `src/__tests__/helpers.ts` with test utilities:
    - `createTestClient(options?)` - Create client with defaults
    - `createTestSuite(config, options?)` - Auto setup/teardown
    - `setupTestServer(config, options?)` - Manual server setup
    - `teardownTestServer(client)` - Manual server cleanup
    - `waitForClientState(client, isConnected, timeout?)` - Wait for state
    - `createMockServerConfig(args?)` - Create server config
    - `runWithTimeout(fn, timeout?)` - Run with timeout
    - `retryUntil(fn, attempts?, delay?)` - Retry until success
    - `callTool(client, toolName, args?)` - Tool call helper
    - `validateToolResult(result)` - Validate result
  - `src/__tests__/helpers-example.test.ts` - Usage examples
- Updated `src/__tests__/client.test.ts` to use helpers
- Documentation in README.md for helpers and matchers with usage examples

### Changed
- Replaced all `any` types with proper TypeScript interfaces
- Improved error messages with error codes
- Enhanced timeout handling with customizable delays
- Better TypeScript type safety throughout the codebase
- Improved server process management and cleanup
- Environment variable handling now uses utility functions
- Updated package.json with repository, bugs, and homepage fields for npm registry

### Fixed
- Type safety issues with environment variable merging
- Process cleanup now properly handles both SIGTERM and SIGKILL
- Typo in AGENTS.md: "Security Considerations" fixed (was "Security Considerations")

### Deprecated
- None

### Removed
- None

### Security
- None

## [1.0.0] - 2026-01-19

### Added
- Initial release of MCP Tester
- Full MCP protocol support (Tools, Resources, Prompts, Sampling, Elicitation, Notifications)
- Jest integration with 26 tests
- Mock MCP server for unit testing
- TypeScript support with full type definitions
- CI/CD pipeline with GitHub Actions
- Comprehensive documentation and examples

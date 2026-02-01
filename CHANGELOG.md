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

### Changed
- Replaced all `any` types with proper TypeScript interfaces
- Improved error messages with error codes
- Enhanced timeout handling with customizable delays
- Better TypeScript type safety throughout the codebase
- Improved server process management and cleanup
- Environment variable handling now uses utility functions

### Fixed
- Type safety issues with environment variable merging
- Process cleanup now properly handles both SIGTERM and SIGKILL

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

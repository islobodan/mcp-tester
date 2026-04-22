# AGENTS.md

This guide helps AI agents work effectively in mcp-tester repository. It documents essential commands, patterns, conventions, and gotchas observed in this codebase.

## Roadmap

For planned improvements, features, and enhancements, see [TODO.md](./TODO.md). The TODO.md file contains:
- **48 tracked items** organized by priority (Critical, High, Medium, Low)
- Critical bug fixes and code quality improvements (items 40-48)
- Detailed task descriptions and effort estimates
- Progress tracking with status indicators: `[ ]` (not started), `[/]` (in progress), `[x]` (completed)
- Quick wins that can be completed in under 1 hour
- Current completion: 35.4% (17 completed)

## Project Overview

**mcp-tester** is a TypeScript/Node.js library that provides a minimal, production-ready MCP (Model Context Protocol) client implementation for CI/CD testing of MCP servers with Jest.

- **Type**: TypeScript library (ESM modules)
- **Primary Purpose**: Test MCP server implementations in CI/CD pipelines
- **Node.js Version**: >=18 (tested on 18, 20, 21)
- **Package Manager**: npm
- **Main SDK**: @modelcontextprotocol/sdk v1.29.0
- **Status**: Production-ready

## Essential Commands

### Development

```bash
# Build TypeScript to JavaScript
npm run build

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Code Quality

```bash
# Run ESLint
npm run lint

# Format code with Prettier
npm run format

# Check code formatting (without fixing)
npm run format:check
```

### Security

```bash
# Run security audit
npm run audit

# Attempt to fix security vulnerabilities
npm run audit:fix
```

### Release

```bash
# Patch release (1.0.0 → 1.0.1)
npm run release:patch

# Minor release (1.0.0 → 1.1.0)
npm run release:minor

# Major release (1.0.0 → 2.0.0)
npm run release:major

# Prerelease (1.0.0 → 1.0.1-beta.0)
npm run release:prerelease

# Commit version bump and CHANGELOG updates
npm run release:commit
```

## Code Organization

```
src/
├── index.ts                 # Library entry point, exports from client/
├── client/
│   ├── MCPClient.ts         # Main client wrapper class (~400 lines)
│   └── index.ts            # Client module exports
├── utils/
│   ├── logger.ts            # Logger utility (ConsoleLogger, NoOpLogger)
│   ├── errors.ts            # Custom error classes (MCPClientError, etc.)
│   └── env.ts              # Environment variable utilities
└── __tests__/
    ├── client.test.ts               # Basic client operations tests
    ├── resources-prompts.test.ts    # Resources & prompts functionality tests
    ├── advanced.test.ts             # Advanced features tests
    ├── real-server.test.ts          # Integration tests (stdio transport)
    ├── helpers-example.test.ts      # Test helpers usage examples
    ├── helpers.ts                   # Test utility functions
    ├── matchers.ts                  # Custom Jest matchers
    └── fixtures/
        └── mock-server.ts           # In-memory mock MCP server

examples/
├── basic-test.ts            # Basic usage example
├── full-test.ts             # Full capabilities example
└── mock-server.js           # Standalone MCP server for testing
```

**Build Output**: `dist/` directory (JavaScript + TypeScript declaration files)

## Naming Conventions & Style

### TypeScript Conventions
- **Strict Mode**: Enabled (`"strict": true` in tsconfig.json)
- **Module System**: ESM (ES2022 modules)
- **Import Extensions**: Must use `.js` extensions in imports (ESM requirement)
  ```typescript
  // ✓ Correct
  import { MCPClient } from './client/MCPClient.js';

  // ✗ Incorrect
  import { MCPClient } from './client/MCPClient';
  ```

### Code Style (Prettier)
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### Naming Patterns
- **Classes**: PascalCase (e.g., `MCPClient`, `ConsoleLogger`)
- **Interfaces**: PascalCase (e.g., `MCPServerConfig`, `MCPClientOptions`)
- **Functions/Methods**: camelCase (e.g., `listTools()`, `callTool()`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `DEFAULT_RETRY_OPTIONS`)
- **Private Fields**: camelCase with underscore prefix (e.g., `client: Client | null`)
- **Test Files**: `*.test.ts`
- **Exported Types**: Use `export type` for types only, `export` for values

### ESLint Rules
- No unused variables (except those starting with `_`)
- `no-explicit-any` is **OFF** - but codebase avoids `any` types
- Explicit function return types: **OFF**
- Explicit module boundary types: **OFF**

## Testing Approach

### Test Framework
- **Framework**: Jest 29.7.0 with ts-jest
- **Module System**: ESM support via `ts-jest/presets/default-esm`
- **Test Timeout**: 30 seconds
- **Test Mode**: Serial execution (`maxWorkers: 1`) to avoid worker crashes
- **Coverage Threshold**: 80% for all metrics (branches, functions, lines, statements)

### Jest Configuration Notes
- Cache directory: `/tmp/mcp-tester-cache` (avoids temp folder issues)
- Worker crashes (SIGSEGV) can occur with parallel execution; use `maxWorkers: 1`

### Test File Organization
- All tests in `src/__tests__/` directory
- Test files named `*.test.ts`
- Mock fixtures in `src/__tests__/fixtures/`

### Testing Patterns

#### 1. Basic Test Structure
```typescript
import { MCPClient } from '../client/MCPClient.js';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('Feature Name', () => {
  let client: MCPClient;

  beforeEach(() => {
    client = new MCPClient({
      name: 'test-client',
      version: '1.0.0',
      timeout: 10000,
    });
  });

  afterEach(async () => {
    if (client.isConnected()) {
      await client.stop();
    }
  });

  it('should do something', async () => {
    // Arrange, Act, Assert
    const result = await client.someMethod();
    expect(result).toBeDefined();
  });
});
```

#### 2. Async/Await Pattern
**Always use `async/await` for MCP client operations:**
```typescript
it('should handle async operation', async () => {
  const result = await client.listTools();  // ✓ Correct
  // const result = client.listTools();    // ✗ Returns Promise, not result
});
```

#### 3. Cleanup Pattern
**Always clean up connections in `afterEach`:**
```typescript
afterEach(async () => {
  if (client.isConnected()) {
    await client.stop();
  }
});
```

#### 4. Error Testing
**Use `rejects.toThrow()` for expected errors:**
```typescript
it('should handle invalid tool', async () => {
  await expect(
    client.callTool({ name: 'non-existent', arguments: {} })
  ).rejects.toThrow();
});
```

#### 5. Using In-Memory Mock Server
```typescript
import { MockMCPServer } from './fixtures/mock-server.js';

describe('Feature', () => {
  let mockServer: MockMCPServer;

  beforeEach(() => {
    mockServer = new MockMCPServer();
  });

  it('should handle mock tool call', async () => {
    const result = await mockServer.handleToolCall('echo', { message: 'test' });
    expect(result.content[0].text).toBe('Echo: test');
  });
});
```

#### 6. Using Real Server Process (stdio)
```typescript
import { MCPClient } from '../client/MCPClient.js';

describe('Integration', () => {
  let client: MCPClient;

  beforeEach(async () => {
    client = new MCPClient();
    await client.start({
      command: 'node',
      args: ['./examples/mock-server.js'],
    });
  });

  afterEach(async () => {
    if (client.isConnected()) {
      await client.stop();
    }
  });

  it('should communicate via stdio', async () => {
    const tools = await client.listTools();
    expect(tools.length).toBeGreaterThan(0);
  });
});
```

### Current Test Suite
- **Total Tests**: 43 tests (all passing)
- **Test Categories**:
  - Basic Operations: 3 tests
  - Tools (in-memory): 11 tests
  - Resources (in-memory): 5 tests
  - Prompts (in-memory): 4 tests
  - Advanced Features: 3 tests
  - Helpers Examples: 4 tests
  - Real Server (stdio): 13 tests

## Important Gotchas & Non-Obvious Patterns

### 1. ESM Import Extensions
**Critical**: All TypeScript imports must include `.js` extensions because this is an ESM project:
```typescript
// ✓ Correct
import { MCPClient } from './client/MCPClient.js';

// ✗ Will fail at runtime
import { MCPClient } from './client/MCPClient';
```

### 2. Client Lifecycle
**Must call `start()` before any client methods:**
```typescript
const client = new MCPClient();

// ✗ Error: Client not started
await client.listTools();

// ✓ Correct
await client.start({ command: 'node', args: ['./server.js'] });
await client.listTools();
```

### 3. Process Cleanup
The `StdioClientTransport` manages the server process lifecycle. The client's `stop()` method:
- Calls `client.close()` to gracefully close the MCP connection
- Calls `transport.close()` to shut down the server process
- This prevents zombie processes and ensures clean shutdown

### 4. Type Safety
**Codebase strictly avoids `any` types** despite ESLint allowing it. All code uses proper TypeScript interfaces and types from the SDK.

### 5. Environment Variables
Environment variables passed to `start()` are filtered to remove `undefined` values using utility functions from `src/utils/env.ts`:
```typescript
await client.start({
  command: 'node',
  args: ['./server.js'],
  env: {
    NODE_ENV: 'production',
    API_KEY: process.env.API_KEY,  // undefined values are filtered out
  },
});
```

### 6. Retry Logic
Requests support configurable retry with exponential backoff:
```typescript
const client = new MCPClient({
  retries: 3,
  retryDelay: 1000,  // base delay in ms
});
```

Per-call retry override:
```typescript
await client.callTool({
  name: 'flaky-tool',
  arguments: {},
  retries: 5,
});
```

### 7. Logging System
Configurable logging with multiple levels:
```typescript
const client = new MCPClient({
  logLevel: 'debug',  // 'debug' | 'info' | 'warn' | 'error' | 'none'
});

// Dynamic log level change
client.setLogLevel('warn');
```

### 8. Timeout Handling
Two levels of timeout configuration:
```typescript
// Global timeout
const client = new MCPClient({ timeout: 30000 });

// Per-call timeout override
await client.callTool({
  name: 'slow-tool',
  arguments: {},
  timeout: 60000,
});
```

### 9. Jest ESM Module Resolution
Jest requires special module name mapping for ESM:
```javascript
moduleNameMapper: {
  '^(\\.{1,2}/.*)\\.js$': '$1',
},
```

### 10. Build Output Structure
The `dist/` directory structure mirrors `src/` but with compiled JavaScript and separate `.d.ts` type declaration files. Always run `npm run build` before committing if you changed TypeScript files.

### 11. @ts-ignore vs @ts-expect-error
Use `@ts-expect-error` instead of `@ts-ignore` (ESLint requirement):
```typescript
// ✓ Correct
// @ts-expect-error - Custom matcher not typed
expect(tools).toHaveTool('echo');

// ✗ Incorrect
// @ts-ignore
expect(tools).toHaveTool('echo');
```

### 12. Custom Jest Matchers
Custom matchers need explicit registration with `expect.extend()`:
```typescript
import { toHaveTool, toHaveResource } from './matchers.js';

beforeEach(() => {
  expect.extend({ toHaveTool, toHaveResource });
});
```

## CI/CD Integration

### GitHub Actions Workflow (`.github/workflows/test.yml`)

**Triggers**: Push to main/develop, Pull Requests

**Jobs**:
1. **test**: Multi-version Node testing (18, 20, 21)
   - Security audit (`npm audit --audit-level=high`)
   - Check for outdated dependencies
   - Build, lint, format check
   - Run tests with coverage
   - Upload coverage to Codecov

2. **lint**: Separate linting job
   - Runs ESLint and Prettier checks

3. **security**: Security-focused job
   - Runs security audit with moderate threshold
   - Checks production dependencies for vulnerabilities

### Release Workflow (`.github/workflows/release.yml`)

**Trigger**: Git tags matching `v*.*.*` pattern (e.g., `v1.0.1`)

**Steps**:
1. Verify version matches between tag and package.json
2. Test across Node.js versions (18, 20, 21)
3. Build project
4. Run security audits
5. Publish to npm (requires `NPM_TOKEN` secret)
6. Create GitHub release with CHANGELOG notes
7. Upload coverage to Codecov
8. Verify package installation

## Error Handling Patterns

### Custom Error Classes
The codebase uses specific error classes for different scenarios:
- `MCPClientError`: Base error class
- `MCPTimeoutError`: Request timeout
- `MCPConnectionError`: Connection failures
- `MCPNotStartedError`: Methods called before `start()`
- `MCPAlreadyStartedError`: Attempt to start already-running client
- `MCPServerError`: Server-side errors

All errors include:
- Descriptive message
- Error code (e.g., `'MCP_TIMEOUT_ERROR'`)
- Proper stack traces

### Error Handling Example
```typescript
try {
  await client.callTool({ name: 'tool', arguments: {} });
} catch (error) {
  if (error instanceof MCPTimeoutError) {
    console.error(`Timeout after ${error.timeout}ms`);
  } else if (error instanceof MCPConnectionError) {
    console.error('Connection failed');
  }
}
```

## Development Workflow

### Making Changes
1. Create feature branch (e.g., `feature/your-feature`)
2. Make changes
3. Run `npm run build`
4. Run `npm test`
5. Run `npm run lint` and `npm run format`
6. Commit with conventional commit message
7. Create pull request

### Commit Message Format (Conventional Commits)
```
feat: add new feature
fix: correct bug
docs: update documentation
refactor: improve code structure
test: add or improve tests
chore: maintenance tasks
```

### Branch Naming
- `feature/your-feature-name`
- `bugfix/bug-description`
- `refactor/refactor-description`
- `docs/documentation-update`
- `test/test-improvements`

## Key Files Reference

| File | Purpose |
|------|---------|
| `package.json` | Dependencies, scripts, package metadata |
| `tsconfig.json` | TypeScript compilation configuration |
| `jest.config.js` | Jest test configuration with ESM support |
| `.eslintrc.json` | ESLint linting rules |
| `.prettierrc.json` | Code formatting rules |
| `src/index.ts` | Library entry point |
| `src/client/MCPClient.ts` | Main client implementation |
| `src/utils/logger.ts` | Logging utility |
| `src/utils/errors.ts` | Custom error classes |
| `src/utils/env.ts` | Environment variable utilities |
| `src/__tests__/fixtures/mock-server.ts` | In-memory mock server for unit tests |
| `src/__tests__/helpers.ts` | Test utility functions |
| `src/__tests__/matchers.ts` | Custom Jest matchers |
| `examples/mock-server.js` | Standalone MCP server for integration tests |
| `examples/basic-test.ts` | Basic usage example |
| `examples/full-test.ts` | Comprehensive example |
| `CHANGELOG.md` | Version history |
| `CONTRIBUTING.md` | Contribution guidelines |
| `RELEASE.md` | Release process documentation |

## Common Tasks

### Adding a New Test
1. Create test file in `src/__tests__/` with `*.test.ts` extension
2. Import test utilities: `import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';`
3. Import classes using `.js` extension
4. Use async/await for all async operations
5. Clean up in `afterEach`

### Adding New Error Type
1. Create class in `src/utils/errors.ts` extending `MCPClientError`
2. Add error code to constructor
3. Include `Error.captureStackTrace(this, YourErrorClass)`
4. Update exports

### Updating Documentation
1. Update `README.md` for user-facing changes
2. Update `CHANGELOG.md` with version notes (follow Keep a Changelog format)
3. Add JSDoc comments to code
4. Update relevant sections in this file

### Creating a Release
1. Run version bump: `npm run release:patch` (or minor/major)
2. Update `CHANGELOG.md` - move items from [Unreleased] to new version
3. Commit: `npm run release:commit`
4. Tag: `git tag v1.0.1`
5. Push: `git push origin main --tags`
6. Workflow automatically publishes to npm

## Environment Variables

### Required for Releases
- `NPM_TOKEN`: GitHub Actions secret for npm publishing

### Optional/Environment-Specific
- `NODE_ENV`: Node environment (development, production, test)
- Server-specific variables passed via `env` option in `start()`

## Dependencies

### Production Dependencies
- `@modelcontextprotocol/sdk@^1.29.0` - Official MCP SDK

### Development Dependencies
- `typescript@^5.3.0` - TypeScript compiler
- `jest@^29.7.0` - Testing framework
- `ts-jest@^29.1.0` - Jest TypeScript preprocessor
- `@types/node@^20.0.0` - Node.js type definitions
- `@types/jest@^29.5.0` - Jest type definitions
- `@typescript-eslint/parser@^7.0.0` - ESLint TypeScript parser
- `@typescript-eslint/eslint-plugin@^7.0.0` - ESLint TypeScript rules
- `eslint@^8.56.0` - JavaScript linter
- `prettier@^3.0.0` - Code formatter

## Known Limitations

1. **Transport**: Only supports stdio transport (HTTP transport not implemented)
2. **Runtime**: Designed for Node.js servers (other runtimes may need adjustments)
3. **Mock Server**: Minimal implementation (real servers may have different behavior)
4. **Test Coverage**: Target is 80% - some edge cases may not be covered

## Security Considerations

1. **Never commit secrets**: API keys, tokens, passwords
2. **Validate input**: Always validate server responses
3. **Type safety**: Use TypeScript for compile-time safety
4. **Error handling**: Never expose internal errors to users
5. **Secure connections**: Use stdio for local servers, HTTPS for remote

## Quick Reference

### Before Making Changes
- Read existing code patterns
- Check for similar implementations
- Follow existing naming conventions
- Ensure `.js` extensions in imports
- Run tests after changes
- Run linter and formatter

### Common Issues & Solutions

**Issue**: "Module not found" errors
- **Solution**: Check import paths include `.js` extension

**Issue**: Type errors with SDK types
- **Solution**: Import types from `@modelcontextprotocol/sdk/types.js`

**Issue**: Tests fail in CI but pass locally
- **Solution**: Check Node.js version (requires >=18), verify environment variables

**Issue**: Coverage below 80%
- **Solution**: Add tests for uncovered code paths

**Issue**: Build errors after TypeScript upgrade
- **Solution**: Clean build directory: `rm -rf dist/ && npm run build`

**Issue**: Worker process crashes (SIGSEGV)
- **Solution**: Ensure `maxWorkers: 1` in jest.config.js

**Issue**: Temp directory errors in Jest
- **Solution**: Set `cacheDirectory: '/tmp/mcp-tester-cache'` in jest.config.js

### Getting Help
- Check `README.md` for detailed usage examples
- Review `examples/` directory for working code
- Consult `CHANGELOG.md` for recent changes
- See `RELEASE.md` for release procedures
- Refer to official [MCP Specification](https://spec.modelcontextprotocol.io)

## Project Statistics

- **Total Lines of Code**: ~1,500 lines (excluding tests)
- **Test Coverage**: >80% (all categories)
- **Tests**: 43 (all passing)
- **Build Time**: ~3 seconds
- **Test Execution Time**: ~9 seconds
- **Node.js Versions Tested**: 18, 20, 21
- **SDK Version**: 1.29.0
- **Pre-commit Hooks**: Husky + lint-staged (eslint + prettier)

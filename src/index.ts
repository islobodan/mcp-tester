/**
 * MCP Tester - A minimal MCP client implementation for CI/CD testing.
 *
 * @packageDocumentation
 *
 * @example
 * ```typescript
 * import { MCPClient } from '@slbdn/mcp-tester';
 *
 * const client = new MCPClient({
 *   name: 'test-client',
 *   version: '1.0.0',
 * });
 *
 * await client.start({
 *   command: 'node',
 *   args: ['./server.js'],
 * });
 *
 * const tools = await client.listTools();
 * const result = await client.callTool({
 *   name: 'my-tool',
 *   arguments: { input: 'test' },
 * });
 *
 * await client.stop();
 * ```
 */

export {
  MCPClient,
  type MCPServerConfig,
  type MCPClientOptions,
  type ToolCallOptions,
  type NotificationHandler,
  type RetryOptions,
} from './client/index.js';
export {
  MCPClientError,
  MCPTimeoutError,
  MCPConnectionError,
  MCPNotStartedError,
  MCPAlreadyStartedError,
  MCPServerError,
} from './utils/errors.js';
export type { Logger, LoggerOptions, LogLevel } from './utils/logger.js';
export { startTimer, prettyPrint } from './utils/logger.js';
export {
  maskSecrets,
  maskValue,
  addSecretPattern,
  resetSecretPatterns,
  getSecretPatterns,
  getSensitiveEnvKeys,
} from './utils/masking.js';
export type { SecretPattern } from './utils/masking.js';
export * as assert from './assert.js';
export { AssertionError } from './assert.js';
export {
  toHaveTool,
  toHaveResource,
  toHavePrompt,
  toHaveToolWithSchema,
  toHaveToolCount,
  toHaveResourceCount,
  toHavePromptCount,
  toHaveResourceByName,
  toHavePromptWithArgs,
  toReturnText,
  toReturnTextContaining,
  toReturnError,
  toReturnOk,
  toReturnJson,
  toReturnContentCount,
  toReturnImage,
  toReturnResourceText,
  toReturnResourceTextContaining,
  toReturnPromptTextContaining,
  toReturnPromptMessageCount,
  setupJestMatchers,
  setupVitestMatchers,
  setupCustomMatchers,
  assertToolText,
  assertToolTextContains,
  assertHasTool,
  assertHasResource,
  assertHasPrompt,
} from './matchers.js';

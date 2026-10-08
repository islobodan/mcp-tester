/**
 * MCP Tester — browser-safe entry point.
 *
 * This module is selected automatically by browser bundlers via the
 * `"browser"` field in `package.json`. Import the package normally and the
 * bundler will substitute this entry for the Node entry point.
 *
 * It exports only code that runs in browsers/edge runtimes: the MCP client
 * (HTTP, SSE and WebSocket transports), assertion helpers, and custom
 * matchers. Node-only features are deliberately omitted:
 *
 * - **stdio** transport (spawns a child process)
 * - test/code generation (`generateTests`, `generateTypes`) which reads files
 *   and the package version via Node APIs
 * - the AI provider (`OpenAICompatProvider`) which uses `node:crypto`/`node:fs`
 *
 * @packageDocumentation
 *
 * @example
 * ```typescript
 * import { MCPClient } from '@slbdn/mcp-tester';
 *
 * const client = new MCPClient();
 * await client.start({ transport: 'websocket', url: 'wss://example.com/mcp' });
 * const tools = await client.listTools();
 * await client.stop();
 * ```
 */

export {
  MCPClient,
  type ServerConfig,
  type StdioServerConfig,
  type StreamableHttpServerConfig,
  type SseServerConfig,
  type WebSocketServerConfig,
  /** @deprecated Use StdioServerConfig */
  type MCPServerConfig,
  type MCPClientOptions,
  type ToolCallOptions,
  type NotificationHandler,
  type RetryOptions,
  type HealthStatus,
  type HealthMonitorOptions,
} from './client/index.js';
export type { TransportType } from './utils/validation.js';
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
export {
  type GeneratedCase,
  type CaseExpectation,
  type CaseSource,
  generateToolArgs,
  suggestEdgeCases,
  suggestEdgeCasesForTools,
  validateArgsAgainstSchema,
  mergeAndValidateCases,
} from './generate-cases.js';

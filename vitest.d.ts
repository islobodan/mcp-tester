/**
 * Vitest type declarations for MCP Tester custom matchers.
 *
 * Add this file to your tsconfig.json includes or reference it
 * in your Vitest setup file to get type-safe matcher autocompletion.
 *
 * Usage (in vitest.d.ts or your setup file):
 *   /// <reference types="@slbdn/mcp-tester/vitest" />
 *
 * Or add to tsconfig.json:
 *   "include": ["node_modules/@slbdn/mcp-tester/vitest.d.ts"]
 *
 * Then in your Vitest setup:
 *   import { setupVitestMatchers } from '@slbdn/mcp-tester';
 *   beforeAll(() => setupVitestMatchers());
 */

import 'vitest';

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Matchers<R = void, T = unknown> {
    // Collection matchers
    toHaveTool(toolName: string): R;
    toHaveResource(uri: string): R;
    toHavePrompt(promptName: string): R;
    toHaveToolWithSchema(toolName: string): R;
    toHaveToolCount(count: number): R;
    toHaveResourceCount(count: number): R;
    toHavePromptCount(count: number): R;
    toHaveResourceByName(name: string): R;
    toHavePromptWithArgs(promptName: string): R;

    // Tool result matchers
    toReturnText(expected?: string): R;
    toReturnTextContaining(substring: string): R;
    toReturnError(): R;
    toReturnOk(): R;
    toReturnJson(expected: unknown): R;
    toReturnContentCount(count: number): R;
    toReturnImage(): R;

    // Resource result matchers
    toReturnResourceText(expected?: string): R;
    toReturnResourceTextContaining(substring: string): R;

    // Prompt result matchers
    toReturnPromptTextContaining(substring: string): R;
    toReturnPromptMessageCount(count: number): R;
  }
}
/**
 * Standalone assertion utilities for MCP tool/resource/prompt testing.
 *
 * Works with any test runner — just throws descriptive errors on failure.
 * Designed for the `runTest(name, fn)` pattern:
 *
 *   await runTest("Get constant: c", async () => {
 *     const result = await client.callTool({ name: "get_constant", arguments: { name: "c" } });
 *     assertToolText(result, "299792458");
 *   });
 *
 * @module assert
 */

import type {
  CallToolResult,
  ReadResourceResult,
  GetPromptResult,
} from '@modelcontextprotocol/sdk/types.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractText(result: CallToolResult): string {
  const item = result.content[0];
  if (item && 'text' in item) return item.text;
  throw new AssertionError(
    `Tool result has no text content. Got: ${JSON.stringify(result.content[0])}`
  );
}

function fail(message: string): never {
  throw new AssertionError(message);
}

// ─── Error Class ────────────────────────────────────────────────────────────

/** Thrown when an assertion fails. */
export class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssertionError';
  }
}

// ─── Value Assertions ───────────────────────────────────────────────────────

/** Assert that `actual === expected` (strict equality). */
export function equal<T>(actual: T, expected: T, msg?: string): void {
  if (actual !== expected) {
    fail(msg ?? `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

/** Assert that `actual !== expected`. */
export function notEqual<T>(actual: T, expected: T, msg?: string): void {
  if (actual === expected) {
    fail(msg ?? `Expected value to NOT equal ${JSON.stringify(expected)}`);
  }
}

/** Assert that `actual` is deeply equal to `expected`. */
export function deepEqual(actual: unknown, expected: unknown, msg?: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(
      msg ??
        `Expected deep equality:\n  actual:   ${JSON.stringify(actual)}\n  expected: ${JSON.stringify(expected)}`
    );
  }
}

/** Assert that `value` is truthy. */
export function ok(value: unknown, msg?: string): void {
  if (!value) {
    fail(msg ?? `Expected truthy value, got ${JSON.stringify(value)}`);
  }
}

/** Assert that `value` is falsy. */
export function notOk(value: unknown, msg?: string): void {
  if (value) {
    fail(msg ?? `Expected falsy value, got ${JSON.stringify(value)}`);
  }
}

/** Assert that `fn` throws an error. Returns the error for further assertions. */
export async function throws(fn: () => Promise<unknown>, msg?: string): Promise<Error> {
  try {
    await fn();
    fail(msg ?? 'Expected function to throw, but it did not');
  } catch (error) {
    if (error instanceof AssertionError) throw error;
    return error as Error;
  }
}

/** Assert that `fn` does NOT throw. */
export async function doesNotThrow(fn: () => Promise<unknown>, msg?: string): Promise<void> {
  try {
    await fn();
  } catch (error) {
    fail(msg ?? `Expected function NOT to throw, but it threw: ${error}`);
  }
}

// ─── Numeric Assertions ─────────────────────────────────────────────────────

/** Assert that `actual === expected` (numbers). */
export function equalNum(actual: number, expected: number, msg?: string): void {
  if (actual !== expected) {
    fail(msg ?? `Expected ${expected}, got ${actual}`);
  }
}

/** Assert `actual > expected`. */
export function greaterThan(actual: number, expected: number, msg?: string): void {
  if (actual <= expected) {
    fail(msg ?? `Expected ${actual} > ${expected}`);
  }
}

/** Assert `actual >= expected`. */
export function atLeast(actual: number, expected: number, msg?: string): void {
  if (actual < expected) {
    fail(msg ?? `Expected ${actual} >= ${expected}`);
  }
}

/** Assert `actual < expected`. */
export function lessThan(actual: number, expected: number, msg?: string): void {
  if (actual >= expected) {
    fail(msg ?? `Expected ${actual} < ${expected}`);
  }
}

/** Assert `value` is within `epsilon` of `expected`. */
export function closeTo(actual: number, expected: number, epsilon = 0.001, msg?: string): void {
  if (Math.abs(actual - expected) > epsilon) {
    fail(msg ?? `Expected ${actual} to be within ${epsilon} of ${expected}`);
  }
}

// ─── String Assertions ──────────────────────────────────────────────────────

/** Assert that `str` contains `substring`. */
export function contains(str: string, substring: string, msg?: string): void {
  if (!str.includes(substring)) {
    fail(msg ?? `Expected string to contain "${substring}". Got: "${str}"`);
  }
}

/** Assert that `str` does NOT contain `substring`. */
export function notContains(str: string, substring: string, msg?: string): void {
  if (str.includes(substring)) {
    fail(msg ?? `Expected string to NOT contain "${substring}". Got: "${str}"`);
  }
}

/** Assert that `str` matches `regex`. */
export function matches(str: string, regex: RegExp, msg?: string): void {
  if (!regex.test(str)) {
    fail(msg ?? `Expected string to match ${regex}. Got: "${str}"`);
  }
}

// ─── MCP Tool Assertions ────────────────────────────────────────────────────

/** Assert tool result text equals expected string exactly. If expected omitted, just checks for text content. */
export function toolTextEquals(result: CallToolResult, expected?: string, msg?: string): void {
  const text = extractText(result);
  if (text === undefined) {
    fail(msg ?? 'Expected tool result to have text content');
  }
  if (expected !== undefined && text !== expected) {
    fail(msg ?? `Expected tool text "${expected}", got "${text}"`);
  }
}

/** Assert tool result text contains expected substring. */
export function toolTextContains(result: CallToolResult, substring: string, msg?: string): void {
  const text = extractText(result);
  if (!text.includes(substring)) {
    fail(msg ?? `Expected tool text to contain "${substring}". Got: "${text}"`);
  }
}

/** Assert tool result text, parsed as number, equals expected. */
export function toolNumEquals(result: CallToolResult, expected: number, msg?: string): void {
  const text = extractText(result);
  const actual = parseFloat(text);
  if (Number.isNaN(actual)) {
    fail(msg ?? `Expected tool text to be a number. Got: "${text}"`);
  }
  if (actual !== expected) {
    fail(msg ?? `Expected tool result ${expected}, got ${actual}`);
  }
}

/** Assert tool result text, parsed as number, is within epsilon of expected. */
export function toolNumCloseTo(
  result: CallToolResult,
  expected: number,
  epsilon = 0.001,
  msg?: string
): void {
  const text = extractText(result);
  const actual = parseFloat(text);
  if (Number.isNaN(actual)) {
    fail(msg ?? `Expected tool text to be a number. Got: "${text}"`);
  }
  if (Math.abs(actual - expected) > epsilon) {
    fail(msg ?? `Expected tool result within ${epsilon} of ${expected}, got ${actual}`);
  }
}

/** Assert tool result text, parsed as JSON, deeply equals expected. */
export function toolJsonEquals<T = unknown>(
  result: CallToolResult,
  expected: T,
  msg?: string
): void {
  const text = extractText(result);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    fail(msg ?? `Expected tool text to be valid JSON. Got: "${text}"`);
  }
  if (JSON.stringify(parsed) !== JSON.stringify(expected)) {
    fail(msg ?? `Expected tool JSON ${JSON.stringify(expected)}, got ${JSON.stringify(parsed)}`);
  }
}

/** Assert tool returned an error (isError flag or error in text). */
export function toolIsError(result: CallToolResult, msg?: string): void {
  if (!result.isError && !extractText(result).toLowerCase().includes('error')) {
    fail(msg ?? 'Expected tool result to be an error');
  }
}

/** Assert tool did NOT return an error. */
export function toolIsOk(result: CallToolResult, msg?: string): void {
  if (result.isError) {
    fail(msg ?? `Expected tool result to be successful, but got error: ${extractText(result)}`);
  }
}

/** Assert tool result has at least `minItems` content items. */
export function toolHasContent(result: CallToolResult, minItems = 1, msg?: string): void {
  if (result.content.length < minItems) {
    fail(msg ?? `Expected at least ${minItems} content items, got ${result.content.length}`);
  }
}

/** Assert tool result contains an image content item. */
export function toolHasImage(result: CallToolResult, msg?: string): void {
  const hasImage = result.content.some((item) => item.type === 'image');
  if (!hasImage) {
    fail(msg ?? 'Expected tool result to contain an image');
  }
}

// ─── MCP Resource Assertions ────────────────────────────────────────────────

/** Assert resource result has content. */
export function resourceHasContent(result: ReadResourceResult, minItems = 1, msg?: string): void {
  if (result.contents.length < minItems) {
    fail(msg ?? `Expected at least ${minItems} resource contents, got ${result.contents.length}`);
  }
}

/** Assert resource result text contains substring. */
export function resourceTextContains(
  result: ReadResourceResult,
  substring: string,
  msg?: string
): void {
  const item = result.contents[0];
  if (!item || !('text' in item)) {
    fail(msg ?? 'Resource result has no text content');
  }
  const text = (item as { text: string }).text;
  if (!text.includes(substring)) {
    fail(msg ?? `Expected resource text to contain "${substring}". Got: "${text}"`);
  }
}

// ─── MCP Prompt Assertions ──────────────────────────────────────────────────

/** Assert prompt result has messages. */
export function promptHasMessages(result: GetPromptResult, minMessages = 1, msg?: string): void {
  if (result.messages.length < minMessages) {
    fail(msg ?? `Expected at least ${minMessages} prompt messages, got ${result.messages.length}`);
  }
}

/** Assert prompt result text contains substring. */
export function promptTextContains(result: GetPromptResult, substring: string, msg?: string): void {
  const item = result.messages[0]?.content;
  if (!item || !('text' in item)) {
    fail(msg ?? 'Prompt message has no text content');
  }
  const text = (item as { text: string }).text;
  if (!text.includes(substring)) {
    fail(msg ?? `Expected prompt text to contain "${substring}". Got: "${text}"`);
  }
}

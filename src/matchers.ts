import {
  Tool,
  Resource,
  Prompt,
  CallToolResult,
  ReadResourceResult,
  GetPromptResult,
} from '@modelcontextprotocol/sdk/types.js';
import { AssertionError } from './assert.js';

// ─── Type Declarations ──────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
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
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractTextFromContent(result: CallToolResult): string | undefined {
  const item = result.content[0];
  return item && 'text' in item ? item.text : undefined;
}

function formatList(items: string[]): string {
  return items.length > 0 ? items.join(', ') : '(none)';
}

// ─── Collection Matchers ────────────────────────────────────────────────────

/**
 * Check if a tool with the given name exists in the tools array.
 * Works with `.not` for negation.
 *
 *   expect(tools).toHaveTool('echo');
 *   expect(tools).not.toHaveTool('deprecated_tool');
 */
export const toHaveTool = (received: Tool[], toolName: string) => {
  const hasTool = received.some((tool) => tool.name === toolName);
  return {
    pass: hasTool,
    message: () =>
      hasTool
        ? `Expected tools to NOT have "${toolName}"`
        : `Expected tools to have "${toolName}", found: ${formatList(received.map((t) => t.name))}`,
  };
};

/**
 * Check if a resource with the given URI exists.
 *
 *   expect(resources).toHaveResource('config://settings');
 */
export const toHaveResource = (received: Resource[], uri: string) => {
  const hasResource = received.some((resource) => resource.uri === uri);
  return {
    pass: hasResource,
    message: () =>
      hasResource
        ? `Expected resources to NOT have "${uri}"`
        : `Expected resources to have "${uri}", found: ${formatList(received.map((r) => r.uri))}`,
  };
};

/**
 * Check if a prompt with the given name exists.
 *
 *   expect(prompts).toHavePrompt('greet');
 */
export const toHavePrompt = (received: Prompt[], promptName: string) => {
  const hasPrompt = received.some((prompt) => prompt.name === promptName);
  return {
    pass: hasPrompt,
    message: () =>
      hasPrompt
        ? `Expected prompts to NOT have "${promptName}"`
        : `Expected prompts to have "${promptName}", found: ${formatList(received.map((p) => p.name))}`,
  };
};

/**
 * Check if a tool exists and has an input schema.
 *
 *   expect(tools).toHaveToolWithSchema('echo');
 */
export const toHaveToolWithSchema = (received: Tool[], toolName: string) => {
  const tool = received.find((t) => t.name === toolName);
  if (!tool) {
    return {
      pass: false,
      message: () =>
        `Expected tools to have "${toolName}", found: ${formatList(received.map((t) => t.name))}`,
    };
  }
  const hasSchema = !!tool.inputSchema;
  return {
    pass: hasSchema,
    message: () =>
      hasSchema
        ? `Expected tool "${toolName}" to NOT have input schema`
        : `Expected tool "${toolName}" to have input schema`,
  };
};

/**
 * Check that the tools array has exactly `count` items.
 *
 *   expect(tools).toHaveToolCount(5);
 */
export const toHaveToolCount = (received: Tool[], count: number) => {
  const actual = received.length;
  return {
    pass: actual === count,
    message: () =>
      actual === count
        ? `Expected tools to NOT have exactly ${count} items`
        : `Expected tools to have ${count} items, but found ${actual}: ${formatList(received.map((t) => t.name))}`,
  };
};

/**
 * Check that the resources array has exactly `count` items.
 *
 *   expect(resources).toHaveResourceCount(3);
 */
export const toHaveResourceCount = (received: Resource[], count: number) => {
  const actual = received.length;
  return {
    pass: actual === count,
    message: () =>
      actual === count
        ? `Expected resources to NOT have exactly ${count} items`
        : `Expected resources to have ${count} items, but found ${actual}: ${formatList(received.map((r) => r.uri))}`,
  };
};

/**
 * Check that the prompts array has exactly `count` items.
 *
 *   expect(prompts).toHavePromptCount(2);
 */
export const toHavePromptCount = (received: Prompt[], count: number) => {
  const actual = received.length;
  return {
    pass: actual === count,
    message: () =>
      actual === count
        ? `Expected prompts to NOT have exactly ${count} items`
        : `Expected prompts to have ${count} items, but found ${actual}: ${formatList(received.map((p) => p.name))}`,
  };
};

/**
 * Check if a resource with the given display name exists.
 *
 *   expect(resources).toHaveResourceByName('Settings');
 */
export const toHaveResourceByName = (received: Resource[], name: string) => {
  const hasResource = received.some((resource) => resource.name === name);
  return {
    pass: hasResource,
    message: () =>
      hasResource
        ? `Expected resources to NOT have "${name}"`
        : `Expected resources to have "${name}", found: ${formatList(received.map((r) => r.name))}`,
  };
};

/**
 * Check if a prompt exists and has defined arguments (is parameterized).
 *
 *   expect(prompts).toHavePromptWithArgs('greet');
 */
export const toHavePromptWithArgs = (received: Prompt[], promptName: string) => {
  const prompt = received.find((p) => p.name === promptName);
  if (!prompt) {
    return {
      pass: false,
      message: () =>
        `Expected prompts to have "${promptName}", found: ${formatList(received.map((p) => p.name))}`,
    };
  }
  const hasArgs = !!(prompt.arguments && prompt.arguments.length > 0);
  return {
    pass: hasArgs,
    message: () =>
      hasArgs
        ? `Expected prompt "${promptName}" to NOT have arguments`
        : `Expected prompt "${promptName}" to have arguments, but it has none`,
  };
};

// ─── Tool Result Matchers ───────────────────────────────────────────────────

/**
 * Check that a tool result has text content.
 * Optionally check that the text equals an exact string.
 *
 *   expect(result).toReturnText();               // has any text
 *   expect(result).toReturnText('Hello World');    // text equals exactly
 */
export const toReturnText = (received: CallToolResult, expected?: string) => {
  const text = extractTextFromContent(received);

  if (text === undefined) {
    return {
      pass: false,
      message: () =>
        `Expected tool result to have text content, but got: ${JSON.stringify(received.content[0]?.type ?? 'empty')}`,
    };
  }

  if (expected === undefined) {
    return {
      pass: true,
      message: () => `Expected tool result to NOT have text content, but got: "${text}"`,
    };
  }

  const matches = text === expected;
  return {
    pass: matches,
    message: () =>
      matches
        ? `Expected tool text to NOT equal "${expected}"`
        : `Expected tool text to equal "${expected}", but got: "${text}"`,
  };
};

/**
 * Check that a tool result's text contains a substring.
 *
 *   expect(result).toReturnTextContaining('hello');
 */
export const toReturnTextContaining = (received: CallToolResult, substring: string) => {
  const text = extractTextFromContent(received);
  if (text === undefined) {
    return {
      pass: false,
      message: () =>
        `Expected tool result to contain "${substring}", but result has no text content`,
    };
  }
  const contains = text.includes(substring);
  return {
    pass: contains,
    message: () =>
      contains
        ? `Expected tool text to NOT contain "${substring}"`
        : `Expected tool text to contain "${substring}", but got: "${text}"`,
  };
};

/**
 * Check that a tool result indicates an error (isError flag or "error" in text).
 *
 *   expect(result).toReturnError();
 */
export const toReturnError = (received: CallToolResult) => {
  const isError =
    received.isError ||
    (extractTextFromContent(received)?.toLowerCase().includes('error') ?? false);
  return {
    pass: isError,
    message: () =>
      isError
        ? `Expected tool result to NOT be an error`
        : `Expected tool result to be an error, but it succeeded`,
  };
};

/**
 * Check that a tool result indicates success (no error).
 *
 *   expect(result).toReturnOk();
 */
export const toReturnOk = (received: CallToolResult) => {
  const isError =
    received.isError ||
    (extractTextFromContent(received)?.toLowerCase().includes('error') ?? false);
  return {
    pass: !isError,
    message: () =>
      !isError
        ? `Expected tool result to be an error, but it succeeded`
        : `Expected tool result to be successful, but got error: ${extractTextFromContent(received) ?? '(no text)'}`,
  };
};

/**
 * Parse tool result text as JSON and deep-compare to expected object.
 *
 *   expect(result).toReturnJson({ status: 'ok', count: 5 });
 */
export const toReturnJson = (received: CallToolResult, expected: unknown) => {
  const text = extractTextFromContent(received);
  if (text === undefined) {
    return {
      pass: false,
      message: () => `Expected tool result to contain JSON, but result has no text content`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      pass: false,
      message: () =>
        `Expected tool result to be valid JSON, but got: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`,
    };
  }

  const matches = JSON.stringify(parsed) === JSON.stringify(expected);
  return {
    pass: matches,
    message: () =>
      matches
        ? `Expected tool JSON to NOT equal ${JSON.stringify(expected)}`
        : `Expected tool JSON to equal:\n  ${JSON.stringify(expected)}\n\nReceived:\n  ${JSON.stringify(parsed)}`,
  };
};

/**
 * Check that a tool result has exactly `count` content items.
 *
 *   expect(result).toReturnContentCount(2);  // e.g. text + image
 */
export const toReturnContentCount = (received: CallToolResult, count: number) => {
  const actual = received.content.length;
  return {
    pass: actual === count,
    message: () =>
      actual === count
        ? `Expected tool result to NOT have ${count} content items`
        : `Expected tool result to have ${count} content items, but found ${actual}`,
  };
};

/**
 * Check that a tool result contains at least one image content item.
 *
 *   expect(result).toReturnImage();
 */
export const toReturnImage = (received: CallToolResult) => {
  const hasImage = received.content.some((item) => 'type' in item && item.type === 'image');
  const types = received.content.map((c) => ('type' in c ? c.type : 'embedded')).join(', ');
  return {
    pass: hasImage,
    message: () =>
      hasImage
        ? `Expected tool result to NOT contain an image`
        : `Expected tool result to contain an image, but found types: ${types}`,
  };
};

// ─── Resource Result Matchers ────────────────────────────────────────────────

/**
 * Check that a resource result has text content.
 * Optionally check that the text equals an exact string.
 *
 *   expect(result).toReturnResourceText();              // has any text
 *   expect(result).toReturnResourceText('expected');    // text equals exactly
 */
export const toReturnResourceText = (received: ReadResourceResult, expected?: string) => {
  const item = received.contents[0];
  if (!item || !('text' in item)) {
    return {
      pass: false,
      message: () => 'Expected resource result to have text content',
    };
  }

  const text = (item as { text: string }).text;

  if (expected === undefined) {
    return {
      pass: true,
      message: () =>
        `Expected resource result to NOT have text content, but got: "${text.substring(0, 50)}"`,
    };
  }

  const matches = text === expected;
  return {
    pass: matches,
    message: () =>
      matches
        ? `Expected resource text to NOT equal "${expected}"`
        : `Expected resource text to equal "${expected}", but got: "${text}"`,
  };
};

/**
 * Check that a resource result's text contains a substring.
 *
 *   expect(result).toReturnResourceTextContaining('connection');
 */
export const toReturnResourceTextContaining = (received: ReadResourceResult, substring: string) => {
  const item = received.contents[0];
  if (!item || !('text' in item)) {
    return {
      pass: false,
      message: () =>
        `Expected resource text to contain "${substring}", but result has no text content`,
    };
  }

  const text = (item as { text: string }).text;
  const contains = text.includes(substring);
  return {
    pass: contains,
    message: () =>
      contains
        ? `Expected resource text to NOT contain "${substring}"`
        : `Expected resource text to contain "${substring}", but got: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`,
  };
};

// ─── Prompt Result Matchers ─────────────────────────────────────────────────

/**
 * Check that a prompt result's first message text contains a substring.
 *
 *   expect(result).toReturnPromptTextContaining('Alice');
 */
export const toReturnPromptTextContaining = (received: GetPromptResult, substring: string) => {
  const item = received.messages[0]?.content;
  if (!item || !('text' in item)) {
    return {
      pass: false,
      message: () =>
        `Expected prompt message to contain "${substring}", but result has no text content`,
    };
  }

  const text = (item as { text: string }).text;
  const contains = text.includes(substring);
  return {
    pass: contains,
    message: () =>
      contains
        ? `Expected prompt text to NOT contain "${substring}"`
        : `Expected prompt text to contain "${substring}", but got: "${text}"`,
  };
};

/**
 * Check that a prompt result has exactly `count` messages.
 *
 *   expect(result).toReturnPromptMessageCount(2);
 */
export const toReturnPromptMessageCount = (received: GetPromptResult, count: number) => {
  const actual = received.messages.length;
  return {
    pass: actual === count,
    message: () =>
      actual === count
        ? `Expected prompt to NOT have ${count} messages`
        : `Expected prompt to have ${count} messages, but found ${actual}`,
  };
};

// ─── Setup ──────────────────────────────────────────────────────────────────

/**
 * Register all custom matchers with Jest.
 * Call once in test setup:
 *
 *   import { setupCustomMatchers } from '@slbdn/mcp-tester';
 *   beforeAll(() => setupCustomMatchers());
 *
 * Or add to jest.setup.js for global availability.
 */
export const setupCustomMatchers = () => {
  expect.extend({
    // Collection
    toHaveTool,
    toHaveResource,
    toHavePrompt,
    toHaveToolWithSchema,
    toHaveToolCount,
    toHaveResourceCount,
    toHavePromptCount,
    toHaveResourceByName,
    toHavePromptWithArgs,
    // Tool results
    toReturnText,
    toReturnTextContaining,
    toReturnError,
    toReturnOk,
    toReturnJson,
    toReturnContentCount,
    toReturnImage,
    // Resource results
    toReturnResourceText,
    toReturnResourceTextContaining,
    // Prompt results
    toReturnPromptTextContaining,
    toReturnPromptMessageCount,
  });
};

// Auto-setup for Jest environments (no-op outside Jest)
if (typeof expect !== 'undefined' && typeof expect.extend === 'function') {
  setupCustomMatchers();
}

// ─── Standalone Assertion Wrappers ──────────────────────────────────────────
// Thin wrappers that throw AssertionError — usable outside Jest with any test runner.

/**
 * Assert that a tool result has text content (optionally matching exactly).
 * Works with any test runner — throws AssertionError on failure.
 */
export function assertToolText(result: CallToolResult, expected?: string, msg?: string): void {
  const text = extractTextFromContent(result);
  if (text === undefined)
    throw new AssertionError(msg ?? 'Expected tool result to have text content');
  if (expected !== undefined && text !== expected) {
    throw new AssertionError(msg ?? `Expected tool text "${expected}", got "${text}"`);
  }
}

/**
 * Assert that a tool result text contains a substring.
 * Works with any test runner — throws AssertionError on failure.
 */
export function assertToolTextContains(
  result: CallToolResult,
  substring: string,
  msg?: string
): void {
  const text = extractTextFromContent(result);
  if (text === undefined)
    throw new AssertionError(msg ?? 'Expected tool result to have text content');
  if (!text.includes(substring)) {
    throw new AssertionError(msg ?? `Expected tool text to contain "${substring}", got: "${text}"`);
  }
}

/**
 * Assert that tools list contains a tool with the given name.
 * Works with any test runner — throws AssertionError on failure.
 */
export function assertHasTool(tools: Tool[], name: string, msg?: string): void {
  if (!tools.some((t) => t.name === name)) {
    throw new AssertionError(
      msg ?? `Expected tools to have "${name}", found: ${formatList(tools.map((t) => t.name))}`
    );
  }
}

/**
 * Assert that resources list contains a resource with the given URI.
 * Works with any test runner — throws AssertionError on failure.
 */
export function assertHasResource(resources: Resource[], uri: string, msg?: string): void {
  if (!resources.some((r) => r.uri === uri)) {
    throw new AssertionError(
      msg ??
        `Expected resources to have "${uri}", found: ${formatList(resources.map((r) => r.uri))}`
    );
  }
}

/**
 * Assert that prompts list contains a prompt with the given name.
 * Works with any test runner — throws AssertionError on failure.
 */
export function assertHasPrompt(prompts: Prompt[], name: string, msg?: string): void {
  if (!prompts.some((p) => p.name === name)) {
    throw new AssertionError(
      msg ?? `Expected prompts to have "${name}", found: ${formatList(prompts.map((p) => p.name))}`
    );
  }
}

/**
 * Tests for the matchers module.
 * Verifies all custom matchers return correct pass/message on success and failure.
 */

import { describe, it, expect } from '@jest/globals';
import {
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
  setupCustomMatchers,
  setupVitestMatchers,
  assertToolText,
  assertToolTextContains,
  assertHasTool,
  assertHasResource,
  assertHasPrompt,
} from '../matchers.js';
import type {
  Tool,
  Resource,
  Prompt,
  CallToolResult,
  ReadResourceResult,
  GetPromptResult,
} from '@modelcontextprotocol/sdk/types.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function textResult(text: string, isError = false): CallToolResult {
  return { content: [{ type: 'text', text }], isError };
}

function imageResult(): CallToolResult {
  return {
    content: [
      { type: 'text' as const, text: 'desc' },
      { type: 'image' as const, data: 'base64', mimeType: 'image/png' },
    ],
  };
}

function noTextResult(): CallToolResult {
  return {
    content: [{ type: 'image' as const, data: 'base64', mimeType: 'image/png' }],
  } as CallToolResult;
}

function resourceResult(text: string): ReadResourceResult {
  return { contents: [{ uri: 'test://res', mimeType: 'text/plain', text }] };
}

function promptResult(text: string): GetPromptResult {
  return { messages: [{ role: 'user', content: { type: 'text', text } }] };
}

const tools: Tool[] = [
  {
    name: 'echo',
    description: 'Echo tool',
    inputSchema: { type: 'object', properties: { message: { type: 'string' } } },
  },
  { name: 'add', description: 'Add tool', inputSchema: { type: 'object', properties: {} } },
  { name: 'delay', description: 'Delay tool', inputSchema: { type: 'object', properties: {} } },
];

const toolsNoSchema: Tool[] = [{ name: 'bare', description: 'Bare tool' } as Tool];

const resources: Resource[] = [
  { uri: 'text://example', name: 'Example' },
  { uri: 'config://settings', name: 'Settings' },
];

const prompts: Prompt[] = [
  {
    name: 'greet',
    description: 'Greet',
    arguments: [{ name: 'name', description: 'Name', required: true }],
  },
  { name: 'summarize', description: 'Summarize' },
];

// ─── Collection: Tool Matchers ────────────────────────────────────────────────

describe('toHaveTool', () => {
  it('should pass when tool exists', () => {
    const result = toHaveTool(tools, 'echo');
    expect(result.pass).toBe(true);
  });

  it('should fail when tool does not exist', () => {
    const result = toHaveTool(tools, 'nonexistent');
    expect(result.pass).toBe(false);
    expect(result.message()).toContain('nonexistent');
    expect(result.message()).toContain('echo');
  });
});

describe('toHaveToolWithSchema', () => {
  it('should pass when tool has schema', () => {
    const result = toHaveToolWithSchema(tools, 'echo');
    expect(result.pass).toBe(true);
  });

  it('should fail when tool has no schema', () => {
    const result = toHaveToolWithSchema(toolsNoSchema, 'bare');
    expect(result.pass).toBe(false);
  });

  it('should fail when tool does not exist', () => {
    const result = toHaveToolWithSchema(tools, 'nonexistent');
    expect(result.pass).toBe(false);
  });
});

describe('toHaveToolCount', () => {
  it('should pass when count matches', () => {
    expect(toHaveToolCount(tools, 3).pass).toBe(true);
  });

  it('should fail when count does not match', () => {
    const result = toHaveToolCount(tools, 5);
    expect(result.pass).toBe(false);
    expect(result.message()).toContain('5');
    expect(result.message()).toContain('3');
  });
});

// ─── Collection: Resource Matchers ────────────────────────────────────────────

describe('toHaveResource', () => {
  it('should pass when resource exists', () => {
    expect(toHaveResource(resources, 'text://example').pass).toBe(true);
  });

  it('should fail when resource does not exist', () => {
    expect(toHaveResource(resources, 'nonexistent://x').pass).toBe(false);
  });
});

describe('toHaveResourceByName', () => {
  it('should pass when resource name exists', () => {
    expect(toHaveResourceByName(resources, 'Settings').pass).toBe(true);
  });

  it('should fail when resource name does not exist', () => {
    expect(toHaveResourceByName(resources, 'Nonexistent').pass).toBe(false);
  });
});

describe('toHaveResourceCount', () => {
  it('should pass when count matches', () => {
    expect(toHaveResourceCount(resources, 2).pass).toBe(true);
  });

  it('should fail when count does not match', () => {
    expect(toHaveResourceCount(resources, 5).pass).toBe(false);
  });
});

// ─── Collection: Prompt Matchers ─────────────────────────────────────────────

describe('toHavePrompt', () => {
  it('should pass when prompt exists', () => {
    expect(toHavePrompt(prompts, 'greet').pass).toBe(true);
  });

  it('should fail when prompt does not exist', () => {
    expect(toHavePrompt(prompts, 'nonexistent').pass).toBe(false);
  });
});

describe('toHavePromptWithArgs', () => {
  it('should pass when prompt has arguments', () => {
    expect(toHavePromptWithArgs(prompts, 'greet').pass).toBe(true);
  });

  it('should fail when prompt has no arguments', () => {
    expect(toHavePromptWithArgs(prompts, 'summarize').pass).toBe(false);
  });

  it('should fail when prompt does not exist', () => {
    expect(toHavePromptWithArgs(prompts, 'nonexistent').pass).toBe(false);
  });
});

describe('toHavePromptCount', () => {
  it('should pass when count matches', () => {
    expect(toHavePromptCount(prompts, 2).pass).toBe(true);
  });

  it('should fail when count does not match', () => {
    expect(toHavePromptCount(prompts, 5).pass).toBe(false);
  });
});

// ─── Tool Result Matchers ───────────────────────────────────────────────────

describe('toReturnText', () => {
  it('should pass when text matches exactly', () => {
    expect(toReturnText(textResult('hello'), 'hello').pass).toBe(true);
  });

  it('should fail when text does not match', () => {
    expect(toReturnText(textResult('hello'), 'world').pass).toBe(false);
  });

  it('should pass when no expected (has any text)', () => {
    expect(toReturnText(textResult('anything')).pass).toBe(true);
  });

  it('should fail when no text content', () => {
    expect(toReturnText(noTextResult()).pass).toBe(false);
  });
});

describe('toReturnTextContaining', () => {
  it('should pass when text contains substring', () => {
    expect(toReturnTextContaining(textResult('hello world'), 'world').pass).toBe(true);
  });

  it('should fail when substring not found', () => {
    expect(toReturnTextContaining(textResult('hello'), 'world').pass).toBe(false);
  });

  it('should fail when no text content', () => {
    expect(toReturnTextContaining(noTextResult(), 'hello').pass).toBe(false);
  });
});

describe('toReturnError', () => {
  it('should pass when isError is true', () => {
    expect(toReturnError(textResult('error', true)).pass).toBe(true);
  });

  it('should pass when text contains "error"', () => {
    expect(toReturnError(textResult('An error occurred')).pass).toBe(true);
  });

  it('should fail for successful results', () => {
    expect(toReturnError(textResult('success')).pass).toBe(false);
  });
});

describe('toReturnOk', () => {
  it('should pass for successful results', () => {
    expect(toReturnOk(textResult('success')).pass).toBe(true);
  });

  it('should fail for error results', () => {
    expect(toReturnOk(textResult('error', true)).pass).toBe(false);
  });
});

describe('toReturnJson', () => {
  it('should pass when parsed JSON matches', () => {
    expect(toReturnJson(textResult('{"a":1}'), { a: 1 }).pass).toBe(true);
  });

  it('should fail when parsed JSON does not match', () => {
    expect(toReturnJson(textResult('{"a":1}'), { a: 2 }).pass).toBe(false);
  });

  it('should fail when text is not JSON', () => {
    expect(toReturnJson(textResult('not json'), {}).pass).toBe(false);
  });

  it('should fail when no text content', () => {
    expect(toReturnJson(noTextResult(), {}).pass).toBe(false);
  });
});

describe('toReturnContentCount', () => {
  it('should pass when content count matches', () => {
    expect(toReturnContentCount(textResult('hello'), 1).pass).toBe(true);
    expect(toReturnContentCount(imageResult(), 2).pass).toBe(true);
  });

  it('should fail when content count does not match', () => {
    expect(toReturnContentCount(textResult('hello'), 5).pass).toBe(false);
  });
});

describe('toReturnImage', () => {
  it('should pass when result contains image', () => {
    expect(toReturnImage(imageResult()).pass).toBe(true);
  });

  it('should fail when result has no image', () => {
    expect(toReturnImage(textResult('hello')).pass).toBe(false);
  });
});

// ─── Resource Result Matchers ─────────────────────────────────────────────────

describe('toReturnResourceText', () => {
  it('should pass when text matches exactly', () => {
    expect(toReturnResourceText(resourceResult('hello'), 'hello').pass).toBe(true);
  });

  it('should pass when no expected (has any text)', () => {
    expect(toReturnResourceText(resourceResult('anything')).pass).toBe(true);
  });

  it('should fail when text does not match', () => {
    expect(toReturnResourceText(resourceResult('hello'), 'world').pass).toBe(false);
  });
});

describe('toReturnResourceTextContaining', () => {
  it('should pass when text contains substring', () => {
    expect(toReturnResourceTextContaining(resourceResult('hello world'), 'world').pass).toBe(true);
  });

  it('should fail when substring not found', () => {
    expect(toReturnResourceTextContaining(resourceResult('hello'), 'world').pass).toBe(false);
  });
});

// ─── Prompt Result Matchers ───────────────────────────────────────────────────

describe('toReturnPromptTextContaining', () => {
  it('should pass when text contains substring', () => {
    expect(toReturnPromptTextContaining(promptResult('hello world'), 'world').pass).toBe(true);
  });

  it('should fail when substring not found', () => {
    expect(toReturnPromptTextContaining(promptResult('hello'), 'world').pass).toBe(false);
  });
});

describe('toReturnPromptMessageCount', () => {
  it('should pass when message count matches', () => {
    expect(toReturnPromptMessageCount(promptResult('hello'), 1).pass).toBe(true);
  });

  it('should fail when message count does not match', () => {
    expect(toReturnPromptMessageCount(promptResult('hello'), 5).pass).toBe(false);
  });
});

// ─── Message Formatting Coverage ─────────────────────────────────────────────

describe('matcher messages', () => {
  it('toHaveTool messages (incl. empty list)', () => {
    expect(toHaveTool(tools, 'echo').message()).toContain('NOT have');
    expect(toHaveTool(tools, 'missing').message()).toContain('missing');
    expect(toHaveTool([], 'missing').message()).toContain('(none)');
  });

  it('toHaveResource messages', () => {
    expect(toHaveResource(resources, 'text://example').message()).toContain('NOT have');
    expect(toHaveResource(resources, 'nope://x').message()).toContain('nope://x');
  });

  it('toHavePrompt messages', () => {
    expect(toHavePrompt(prompts, 'greet').message()).toContain('NOT have');
    expect(toHavePrompt(prompts, 'nope').message()).toContain('nope');
  });

  it('toHaveToolWithSchema messages', () => {
    expect(toHaveToolWithSchema(tools, 'echo').message()).toContain('NOT have input schema');
    expect(toHaveToolWithSchema(toolsNoSchema, 'bare').message()).toContain('to have input schema');
    expect(toHaveToolWithSchema(tools, 'missing').message()).toContain('missing');
  });

  it('toHaveToolCount messages', () => {
    expect(toHaveToolCount(tools, 3).message()).toContain('NOT have exactly');
    expect(toHaveToolCount(tools, 1).message()).toContain('found 3');
  });

  it('toHaveResourceCount messages', () => {
    expect(toHaveResourceCount(resources, 2).message()).toContain('NOT have exactly');
    expect(toHaveResourceCount(resources, 1).message()).toContain('found 2');
  });

  it('toHavePromptCount messages', () => {
    expect(toHavePromptCount(prompts, 2).message()).toContain('NOT have exactly');
    expect(toHavePromptCount(prompts, 1).message()).toContain('found 2');
  });

  it('toHaveResourceByName messages', () => {
    expect(toHaveResourceByName(resources, 'Settings').message()).toContain('NOT have');
    expect(toHaveResourceByName(resources, 'Nope').message()).toContain('Nope');
  });

  it('toHavePromptWithArgs messages', () => {
    expect(toHavePromptWithArgs(prompts, 'greet').message()).toContain('NOT have arguments');
    expect(toHavePromptWithArgs(prompts, 'summarize').message()).toContain('to have arguments');
    expect(toHavePromptWithArgs(prompts, 'missing').message()).toContain('missing');
  });

  it('toReturnText messages', () => {
    expect(toReturnText(textResult('hi'), 'hi').message()).toContain('NOT equal');
    expect(toReturnText(textResult('hi'), 'bye').message()).toContain('to equal');
    expect(toReturnText(textResult('hi')).message()).toContain('NOT have text');
    expect(toReturnText(noTextResult()).message()).toContain('text content');
    expect(toReturnText({ content: [] } as unknown as CallToolResult).message()).toContain('empty');
  });

  it('toReturnTextContaining messages', () => {
    expect(toReturnTextContaining(textResult('hi world'), 'world').message()).toContain(
      'NOT contain'
    );
    expect(toReturnTextContaining(textResult('hi'), 'world').message()).toContain('to contain');
    expect(toReturnTextContaining(noTextResult(), 'x').message()).toContain('no text content');
  });

  it('toReturnError messages (incl. empty content)', () => {
    expect(toReturnError(textResult('oops', true)).message()).toContain('NOT be an error');
    expect(toReturnError(textResult('fine')).message()).toContain('to be an error');
    expect(toReturnError({ content: [] } as unknown as CallToolResult).message()).toContain(
      'to be an error'
    );
  });

  it('toReturnOk messages', () => {
    expect(toReturnOk(textResult('fine')).message()).toContain('to be an error');
    expect(toReturnOk(textResult('oops', true)).message()).toContain('successful');
  });

  it('toReturnJson messages', () => {
    expect(toReturnJson(textResult('{"a":1}'), { a: 1 }).message()).toContain('NOT equal');
    expect(toReturnJson(textResult('{"a":1}'), { a: 2 }).message()).toContain('Received');
    expect(toReturnJson(textResult('nope'), {}).message()).toContain('valid JSON');
    expect(toReturnJson(noTextResult(), {}).message()).toContain('no text content');
  });

  it('toReturnContentCount messages', () => {
    expect(toReturnContentCount(textResult('x'), 1).message()).toContain('NOT have');
    expect(toReturnContentCount(textResult('x'), 2).message()).toContain('but found 1');
  });

  it('toReturnImage messages', () => {
    expect(toReturnImage(imageResult()).message()).toContain('NOT contain an image');
    expect(toReturnImage(textResult('x')).message()).toContain('found types');
  });

  it('toReturnResourceText messages (incl. missing content)', () => {
    expect(toReturnResourceText(resourceResult('hi'), 'hi').message()).toContain('NOT equal');
    expect(toReturnResourceText(resourceResult('hi'), 'bye').message()).toContain('to equal');
    expect(toReturnResourceText(resourceResult('hi')).message()).toContain('NOT have text');
    expect(
      toReturnResourceText({ contents: [] } as unknown as ReadResourceResult).message()
    ).toContain('to have text content');
  });

  it('toReturnResourceTextContaining messages (incl. missing content)', () => {
    expect(toReturnResourceTextContaining(resourceResult('hi world'), 'world').message()).toContain(
      'NOT contain'
    );
    expect(toReturnResourceTextContaining(resourceResult('hi'), 'world').message()).toContain(
      'to contain'
    );
    expect(
      toReturnResourceTextContaining(
        { contents: [] } as unknown as ReadResourceResult,
        'x'
      ).message()
    ).toContain('no text content');
  });

  it('toReturnPromptTextContaining messages (incl. missing content)', () => {
    expect(toReturnPromptTextContaining(promptResult('hi world'), 'world').message()).toContain(
      'NOT contain'
    );
    expect(toReturnPromptTextContaining(promptResult('hi'), 'world').message()).toContain(
      'to contain'
    );
    expect(
      toReturnPromptTextContaining({ messages: [] } as unknown as GetPromptResult, 'x').message()
    ).toContain('no text content');
  });

  it('toReturnPromptMessageCount messages', () => {
    expect(toReturnPromptMessageCount(promptResult('x'), 1).message()).toContain('NOT have');
    expect(toReturnPromptMessageCount(promptResult('x'), 2).message()).toContain('but found 1');
  });
});

// ─── Setup & Standalone Assertions ───────────────────────────────────────────

describe('matcher setup', () => {
  it('setupJestMatchers registers without throwing', () => {
    expect(() => setupJestMatchers()).not.toThrow();
  });

  it('setupCustomMatchers is an alias for setupJestMatchers', () => {
    expect(setupCustomMatchers).toBe(setupJestMatchers);
  });

  it('setupVitestMatchers registers when expect.extend exists', () => {
    expect(() => setupVitestMatchers()).not.toThrow();
  });

  it('setupVitestMatchers throws when expect.extend is missing', () => {
    const original = (globalThis as { expect?: unknown }).expect;
    (globalThis as { expect?: unknown }).expect = {};
    try {
      expect(() => setupVitestMatchers()).toThrow('must be called in a Vitest environment');
    } finally {
      (globalThis as { expect?: unknown }).expect = original;
    }
  });
});

describe('standalone assertion wrappers', () => {
  it('assertToolText validates text', () => {
    expect(() => assertToolText(textResult('hi'), 'hi')).not.toThrow();
    expect(() => assertToolText(textResult('hi'), 'bye')).toThrow();
    expect(() => assertToolText(noTextResult())).toThrow('text content');
    expect(() => assertToolText(textResult('hi'), 'bye', 'custom')).toThrow('custom');
  });

  it('assertToolTextContains validates substrings', () => {
    expect(() => assertToolTextContains(textResult('hi world'), 'world')).not.toThrow();
    expect(() => assertToolTextContains(textResult('hi'), 'world')).toThrow();
    expect(() => assertToolTextContains(noTextResult(), 'x')).toThrow('text content');
  });

  it('assertHasTool validates tool presence', () => {
    expect(() => assertHasTool(tools, 'echo')).not.toThrow();
    expect(() => assertHasTool(tools, 'missing')).toThrow('missing');
  });

  it('assertHasResource validates resource presence', () => {
    expect(() => assertHasResource(resources, 'text://example')).not.toThrow();
    expect(() => assertHasResource(resources, 'nope://x')).toThrow('nope://x');
  });

  it('assertHasPrompt validates prompt presence', () => {
    expect(() => assertHasPrompt(prompts, 'greet')).not.toThrow();
    expect(() => assertHasPrompt(prompts, 'missing')).toThrow('missing');
  });
});

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

/**
 * Tests for the assert module.
 * Validates all assertion functions throw AssertionError on failure
 * and pass silently on success.
 */

import { describe, it, expect } from '@jest/globals';
import {
  equal,
  notEqual,
  deepEqual,
  ok,
  notOk,
  throws,
  doesNotThrow,
  equalNum,
  greaterThan,
  atLeast,
  lessThan,
  closeTo,
  contains,
  notContains,
  matches,
  toolTextEquals,
  toolTextContains,
  toolNumEquals,
  toolNumCloseTo,
  toolJsonEquals,
  toolIsError,
  toolIsOk,
  toolHasContent,
  toolHasImage,
  resourceHasContent,
  resourceTextContains,
  promptHasMessages,
  promptTextContains,
  AssertionError,
} from '../assert.js';
import type {
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
      { type: 'text', text: 'description' },
      { type: 'image' as const, data: 'base64data', mimeType: 'image/png' },
    ],
  };
}

function noTextResult(): CallToolResult {
  return {
    content: [{ type: 'image' as const, data: 'base64data', mimeType: 'image/png' }],
  } as CallToolResult;
}

function resourceResult(text: string): ReadResourceResult {
  return {
    contents: [{ uri: 'test://resource', mimeType: 'text/plain', text }],
  };
}

function emptyResourceResult(): ReadResourceResult {
  return { contents: [] };
}

function promptResult(text: string): GetPromptResult {
  return {
    messages: [{ role: 'user', content: { type: 'text', text } }],
  };
}

function emptyPromptResult(): GetPromptResult {
  return { messages: [] };
}

// ───AssertionError ────────────────────────────────────────────────────────────

describe('AssertionError', () => {
  it('should be an Error with correct name', () => {
    const err = new AssertionError('test message');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AssertionError);
    expect(err.name).toBe('AssertionError');
    expect(err.message).toBe('test message');
  });
});

// ─── Value Assertions ────────────────────────────────────────────────────────

describe('equal / notEqual', () => {
  it('equal: should pass for equal values', () => {
    expect(() => equal(1, 1)).not.toThrow();
    expect(() => equal('a', 'a')).not.toThrow();
  });

  it('equal: should throw for unequal values', () => {
    expect(() => equal(1, 2)).toThrow(AssertionError);
    expect(() => equal('a', 'b')).toThrow(AssertionError);
  });

  it('equal: should use custom message', () => {
    expect(() => equal(1, 2, 'custom msg')).toThrow('custom msg');
  });

  it('notEqual: should pass for unequal values', () => {
    expect(() => notEqual(1, 2)).not.toThrow();
  });

  it('notEqual: should throw for equal values', () => {
    expect(() => notEqual(1, 1)).toThrow(AssertionError);
  });
});

describe('deepEqual', () => {
  it('should pass for deeply equal objects', () => {
    expect(() => deepEqual({ a: 1 }, { a: 1 })).not.toThrow();
  });

  it('should throw for different objects', () => {
    expect(() => deepEqual({ a: 1 }, { a: 2 })).toThrow(AssertionError);
  });
});

describe('ok / notOk', () => {
  it('ok: should pass for truthy values', () => {
    expect(() => ok(1)).not.toThrow();
    expect(() => ok('hello')).not.toThrow();
    expect(() => ok(true)).not.toThrow();
  });

  it('ok: should throw for falsy values', () => {
    expect(() => ok(0)).toThrow(AssertionError);
    expect(() => ok('')).toThrow(AssertionError);
    expect(() => ok(null)).toThrow(AssertionError);
  });

  it('notOk: should pass for falsy values', () => {
    expect(() => notOk(0)).not.toThrow();
    expect(() => notOk(null)).not.toThrow();
  });

  it('notOk: should throw for truthy values', () => {
    expect(() => notOk(1)).toThrow(AssertionError);
  });
});

describe('throws / doesNotThrow', () => {
  it('throws: should catch errors and return them', async () => {
    const err = await throws(() => Promise.reject(new Error('boom')));
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('boom');
  });

  it('throws: should throw when function does not reject', async () => {
    await expect(throws(() => Promise.resolve('ok'))).rejects.toThrow(AssertionError);
  });

  it('throws: should use custom message', async () => {
    await expect(throws(() => Promise.resolve(), 'custom')).rejects.toThrow('custom');
  });

  it('doesNotThrow: should pass for resolving functions', async () => {
    await expect(doesNotThrow(() => Promise.resolve('ok'))).resolves.toBeUndefined();
  });

  it('doesNotThrow: should throw for rejecting functions', async () => {
    await expect(doesNotThrow(() => Promise.reject(new Error('boom')))).rejects.toThrow(
      AssertionError
    );
  });
});

// ─── Numeric Assertions ──────────────────────────────────────────────────────

describe('Numeric assertions', () => {
  it('equalNum: should pass for equal numbers', () => {
    expect(() => equalNum(5, 5)).not.toThrow();
  });

  it('equalNum: should throw for different numbers', () => {
    expect(() => equalNum(5, 6)).toThrow(AssertionError);
  });

  it('greaterThan: should pass when a > b', () => {
    expect(() => greaterThan(5, 3)).not.toThrow();
  });

  it('greaterThan: should throw when a <= b', () => {
    expect(() => greaterThan(3, 5)).toThrow(AssertionError);
    expect(() => greaterThan(5, 5)).toThrow(AssertionError);
  });

  it('atLeast: should pass when a >= b', () => {
    expect(() => atLeast(5, 3)).not.toThrow();
    expect(() => atLeast(5, 5)).not.toThrow();
  });

  it('atLeast: should throw when a < b', () => {
    expect(() => atLeast(3, 5)).toThrow(AssertionError);
  });

  it('lessThan: should pass when a < b', () => {
    expect(() => lessThan(3, 5)).not.toThrow();
  });

  it('lessThan: should throw when a >= b', () => {
    expect(() => lessThan(5, 3)).toThrow(AssertionError);
    expect(() => lessThan(5, 5)).toThrow(AssertionError);
  });

  it('closeTo: should pass within epsilon', () => {
    expect(() => closeTo(1.001, 1.0, 0.01)).not.toThrow();
  });

  it('closeTo: should throw outside epsilon', () => {
    expect(() => closeTo(1.1, 1.0, 0.01)).toThrow(AssertionError);
  });
});

// ─── String Assertions ───────────────────────────────────────────────────────

describe('String assertions', () => {
  it('contains: should pass when substring exists', () => {
    expect(() => contains('hello world', 'world')).not.toThrow();
  });

  it('contains: should throw when substring missing', () => {
    expect(() => contains('hello', 'world')).toThrow(AssertionError);
  });

  it('notContains: should pass when substring missing', () => {
    expect(() => notContains('hello', 'world')).not.toThrow();
  });

  it('notContains: should throw when substring exists', () => {
    expect(() => notContains('hello world', 'world')).toThrow(AssertionError);
  });

  it('matches: should pass when regex matches', () => {
    expect(() => matches('test-123', /test-\d{3}/)).not.toThrow();
  });

  it('matches: should throw when regex does not match', () => {
    expect(() => matches('hello', /\d{3}/)).toThrow(AssertionError);
  });
});

// ─── Tool Assertions ────────────────────────────────────────────────────────

describe('toolTextEquals', () => {
  it('should pass when text matches exactly', () => {
    expect(() => toolTextEquals(textResult('hello'), 'hello')).not.toThrow();
  });

  it('should throw when text does not match', () => {
    expect(() => toolTextEquals(textResult('hello'), 'world')).toThrow(AssertionError);
  });

  it('should pass when no expected value (has any text)', () => {
    expect(() => toolTextEquals(textResult('anything'))).not.toThrow();
  });

  it('should throw when result has no text content', () => {
    expect(() => toolTextEquals(noTextResult(), 'hello')).toThrow(AssertionError);
  });
});

describe('toolTextContains', () => {
  it('should pass when text contains substring', () => {
    expect(() => toolTextContains(textResult('hello world'), 'world')).not.toThrow();
  });

  it('should throw when text does not contain substring', () => {
    expect(() => toolTextContains(textResult('hello'), 'world')).toThrow(AssertionError);
  });

  it('should throw when result has no text content', () => {
    expect(() => toolTextContains(noTextResult(), 'hello')).toThrow(AssertionError);
  });
});

describe('toolNumEquals', () => {
  it('should pass when parsed number matches', () => {
    expect(() => toolNumEquals(textResult('42'), 42)).not.toThrow();
  });

  it('should throw when parsed number does not match', () => {
    expect(() => toolNumEquals(textResult('42'), 43)).toThrow(AssertionError);
  });

  it('should throw when text is not a number', () => {
    expect(() => toolNumEquals(textResult('not a number'), 42)).toThrow(AssertionError);
  });
});

describe('toolNumCloseTo', () => {
  it('should pass when number is within epsilon', () => {
    expect(() => toolNumCloseTo(textResult('1.001'), 1.0, 0.01)).not.toThrow();
  });

  it('should throw when number is outside epsilon', () => {
    expect(() => toolNumCloseTo(textResult('1.1'), 1.0, 0.01)).toThrow(AssertionError);
  });
});

describe('toolJsonEquals', () => {
  it('should pass when parsed JSON matches', () => {
    expect(() => toolJsonEquals(textResult('{"a":1}'), { a: 1 })).not.toThrow();
  });

  it('should throw when parsed JSON does not match', () => {
    expect(() => toolJsonEquals(textResult('{"a":1}'), { a: 2 })).toThrow(AssertionError);
  });

  it('should throw when text is not valid JSON', () => {
    expect(() => toolJsonEquals(textResult('not json'), {})).toThrow(AssertionError);
  });

  it('should throw when result has no text content', () => {
    expect(() => toolJsonEquals(noTextResult(), {})).toThrow(AssertionError);
  });
});

describe('toolIsError / toolIsOk', () => {
  it('toolIsError: should pass when isError flag is true', () => {
    expect(() => toolIsError(textResult('error', true))).not.toThrow();
  });

  it('toolIsError: should pass when text contains "error"', () => {
    expect(() => toolIsError(textResult('An error occurred'))).not.toThrow();
  });

  it('toolIsError: should throw for successful results', () => {
    expect(() => toolIsError(textResult('success'))).toThrow(AssertionError);
  });

  it('toolIsOk: should pass for successful results', () => {
    expect(() => toolIsOk(textResult('success'))).not.toThrow();
  });

  it('toolIsOk: should throw for error results', () => {
    expect(() => toolIsOk(textResult('error', true))).toThrow(AssertionError);
  });
});

describe('toolHasContent', () => {
  it('should pass when content has at least 1 item by default', () => {
    expect(() => toolHasContent(textResult('hello'))).not.toThrow();
  });

  it('should pass with explicit minimum count', () => {
    expect(() => toolHasContent(imageResult(), 2)).not.toThrow();
  });

  it('should throw when content has fewer items than expected', () => {
    expect(() => toolHasContent(textResult('hello'), 5)).toThrow(AssertionError);
  });
});

describe('toolHasImage', () => {
  it('should pass when result contains an image', () => {
    expect(() => toolHasImage(imageResult())).not.toThrow();
  });

  it('should throw when result has no image', () => {
    expect(() => toolHasImage(textResult('hello'))).toThrow(AssertionError);
  });
});

// ─── Resource Assertions ─────────────────────────────────────────────────────

describe('resourceHasContent', () => {
  it('should pass when result has at least 1 content item', () => {
    expect(() => resourceHasContent(resourceResult('text'))).not.toThrow();
  });

  it('should throw when result is empty', () => {
    expect(() => resourceHasContent(emptyResourceResult())).toThrow(AssertionError);
  });
});

describe('resourceTextContains', () => {
  it('should pass when resource text contains substring', () => {
    expect(() => resourceTextContains(resourceResult('hello world'), 'world')).not.toThrow();
  });

  it('should throw when substring not found', () => {
    expect(() => resourceTextContains(resourceResult('hello'), 'world')).toThrow(AssertionError);
  });
});

// ─── Prompt Assertions ───────────────────────────────────────────────────────

describe('promptHasMessages', () => {
  it('should pass when result has at least 1 message', () => {
    expect(() => promptHasMessages(promptResult('hello'))).not.toThrow();
  });

  it('should throw when result has no messages', () => {
    expect(() => promptHasMessages(emptyPromptResult())).toThrow(AssertionError);
  });
});

describe('promptTextContains', () => {
  it('should pass when prompt text contains substring', () => {
    expect(() => promptTextContains(promptResult('hello world'), 'world')).not.toThrow();
  });

  it('should throw when substring not found', () => {
    expect(() => promptTextContains(promptResult('hello'), 'world')).toThrow(AssertionError);
  });
});

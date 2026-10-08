/**
 * Tests for the deterministic edge-case engine (generate-cases.ts).
 */
import { describe, it, expect } from '@jest/globals';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  generateSampleValue,
  generateToolArgs,
  suggestEdgeCases,
  suggestEdgeCasesForTools,
  validateArgsAgainstSchema,
  mergeAndValidateCases,
  caseKey,
} from '../generate-cases.js';
import type { GeneratedCase } from '../generate-cases.js';

function toolWith(schema: Tool['inputSchema'], name = 'my_tool'): Tool {
  return { name, description: 'test tool', inputSchema: schema };
}

const echoSchema = {
  type: 'object' as const,
  properties: { message: { type: 'string' } },
  required: ['message'],
};

describe('generateSampleValue', () => {
  it('generates a string for string schemas', () => {
    expect(generateSampleValue({ type: 'string' })).toBe('example');
  });

  it('uses the first enum value when available', () => {
    expect(generateSampleValue({ type: 'string', enum: ['a', 'b'] })).toBe('a');
  });

  it('prefers examples and defaults over type-based generation', () => {
    expect(generateSampleValue({ type: 'string', examples: ['hi'] })).toBe('hi');
    expect(generateSampleValue({ type: 'number', default: 7 })).toBe(7);
  });

  it('clamps numbers to the declared range', () => {
    expect(generateSampleValue({ type: 'number', minimum: 10, maximum: 100 })).toBe(42);
    expect(generateSampleValue({ type: 'integer', minimum: 50 })).toBe(50);
    expect(generateSampleValue({ type: 'integer', maximum: 10 })).toBe(10);
  });

  it('generates booleans and arrays', () => {
    expect(generateSampleValue({ type: 'boolean' })).toBe(true);
    const arr = generateSampleValue({ type: 'array', items: { type: 'string' }, minItems: 2 });
    expect(Array.isArray(arr)).toBe(true);
    expect(arr).toEqual(['example', 'example']);
  });

  it('generates objects with all required properties', () => {
    const value = generateSampleValue({
      type: 'object',
      properties: { a: { type: 'string' }, b: { type: 'number' } },
      required: ['a', 'b'],
    }) as Record<string, unknown>;
    expect(value).toEqual({});
  });

  it('returns "example" for unknown types', () => {
    expect(generateSampleValue({ type: 'mystery' })).toBe('example');
  });
});

describe('generateToolArgs', () => {
  it('fills required properties only (plus optional defaults)', () => {
    const args = generateToolArgs(
      toolWith({
        type: 'object',
        properties: {
          req: { type: 'string' },
          opt: { type: 'string' },
          def: { type: 'number', default: 3 },
        },
        required: ['req'],
      })
    );
    expect(args).toEqual({ req: 'example', def: 3 });
  });

  it('fills the first property when nothing is required', () => {
    const args = generateToolArgs(
      toolWith({ type: 'object', properties: { opt: { type: 'number' } } })
    );
    expect(args).toEqual({ opt: 42 });
  });

  it('returns an empty object for schemaless tools', () => {
    expect(generateToolArgs(toolWith({ type: 'object' }))).toEqual({});
  });
});

describe('validateArgsAgainstSchema', () => {
  const schema = {
    type: 'object' as const,
    properties: {
      msg: { type: 'string', minLength: 2 },
      n: { type: 'integer', minimum: 0, maximum: 10 },
      mode: { type: 'string', enum: ['fast', 'slow'] },
      tags: { type: 'array', items: { type: 'string' }, minItems: 1 },
    },
    required: ['msg'],
  };

  it('accepts valid args', () => {
    expect(
      validateArgsAgainstSchema({ msg: 'hi', n: 5, mode: 'fast', tags: ['x'] }, schema)
    ).toBeNull();
  });

  it('rejects missing required properties', () => {
    expect(validateArgsAgainstSchema({}, schema)).toContain('required');
  });

  it('rejects wrong types', () => {
    expect(validateArgsAgainstSchema({ msg: 42 }, schema)).toContain('should be string');
  });

  it('rejects minLength violations', () => {
    expect(validateArgsAgainstSchema({ msg: 'x' }, schema)).toContain('minLength');
  });

  it('rejects maxLength violations', () => {
    const s = {
      type: 'object' as const,
      properties: { msg: { type: 'string', maxLength: 3 } },
    };
    expect(validateArgsAgainstSchema({ msg: 'toolong' }, s)).toContain('maxLength');
  });

  it('rejects out-of-bounds numbers', () => {
    expect(validateArgsAgainstSchema({ msg: 'hi', n: -1 }, schema)).toContain('minimum');
    expect(validateArgsAgainstSchema({ msg: 'hi', n: 11 }, schema)).toContain('maximum');
  });

  it('rejects non-integer values for integer properties', () => {
    expect(validateArgsAgainstSchema({ msg: 'hi', n: 1.5 }, schema)).toContain('integer');
  });

  it('rejects values outside an enum', () => {
    expect(validateArgsAgainstSchema({ msg: 'hi', mode: 'medium' }, schema)).toContain(
      'must be one of'
    );
  });

  it('rejects arrays below minItems', () => {
    expect(validateArgsAgainstSchema({ msg: 'hi', tags: [] }, schema)).toContain('minItems');
  });

  it('rejects properties when additionalProperties is false', () => {
    const s = {
      type: 'object' as const,
      properties: { a: { type: 'string' } },
      required: ['a'],
      additionalProperties: false,
    };
    expect(validateArgsAgainstSchema({ a: 'ok', extra: 1 }, s)).toContain('unknown property');
  });

  it('allows unknown properties when additionalProperties is not false', () => {
    expect(validateArgsAgainstSchema({ msg: 'hi', extra: 1 }, schema)).toBeNull();
  });
});

describe('suggestEdgeCases', () => {
  it('returns nothing for schemaless tools', () => {
    expect(suggestEdgeCases(toolWith({ type: 'object' }))).toEqual([]);
  });

  it('produces a missing-required case for each required property', () => {
    const cases = suggestEdgeCases(
      toolWith({
        type: 'object',
        properties: { a: { type: 'string' }, b: { type: 'number' } },
        required: ['a', 'b'],
      })
    );
    const missing = cases.filter((c) => c.source === 'rule:required');
    expect(missing.length).toBe(2);
    for (const c of missing) {
      expect(c.expectation).toBe('error');
      expect(Object.keys(c.args)).toHaveLength(1); // sibling required prop still present
    }
  });

  it('produces a wrong-type case for typed properties', () => {
    const cases = suggestEdgeCases(
      toolWith({ type: 'object', properties: { msg: { type: 'string' } }, required: ['msg'] })
    );
    const typeCase = cases.find((c) => c.source === 'rule:type');
    expect(typeCase).toBeDefined();
    expect(typeCase!.args['msg']).toBe(12345);
    expect(typeCase!.expectation).toBe('error');
  });

  it('produces boundary cases for min/maxLength', () => {
    const cases = suggestEdgeCases(
      toolWith({
        type: 'object',
        properties: { msg: { type: 'string', minLength: 3, maxLength: 5 } },
      })
    );
    const sources = cases.map((c) => c.source);
    expect(sources).toContain('rule:min-length');
    expect(sources).toContain('rule:max-length');
    expect(cases.find((c) => c.source === 'rule:min-length')!.args['msg']).toHaveLength(2);
    expect(cases.find((c) => c.source === 'rule:max-length')!.args['msg']).toHaveLength(6);
  });

  it('produces an invalid-enum case', () => {
    const cases = suggestEdgeCases(
      toolWith({
        type: 'object',
        properties: { mode: { type: 'string', enum: ['a', 'b'] } },
      })
    );
    const enumCase = cases.find((c) => c.source === 'rule:enum');
    expect(enumCase).toBeDefined();
    expect(enumCase!.args['mode']).toBe('__mcp_tester_invalid__');
    expect(enumCase!.expectation).toBe('error');
  });

  it('produces a below-minimum bounds case (error expectation)', () => {
    const cases = suggestEdgeCases(
      toolWith({
        type: 'object',
        properties: { n: { type: 'integer', minimum: 1, maximum: 10 } },
      })
    );
    const bounds = cases.filter((c) => c.source === 'rule:bounds');
    expect(bounds).toHaveLength(2);
    expect(bounds.map((c) => c.args['n']).sort((a, b) => (a as number) - (b as number))).toEqual([
      0, 11,
    ]);
    for (const c of bounds) expect(c.expectation).toBe('error');
  });

  it('produces a minItems case for array properties', () => {
    const cases = suggestEdgeCases(
      toolWith({
        type: 'object',
        properties: { tags: { type: 'array', items: { type: 'string' }, minItems: 2 } },
      })
    );
    const arrCase = cases.find((c) => c.source === 'rule:min-items');
    expect(arrCase).toBeDefined();
    expect(arrCase!.args['tags']).toEqual([]);
  });

  it('produces an error case when additionalProperties is false', () => {
    const cases = suggestEdgeCases(
      toolWith({
        type: 'object',
        properties: { a: { type: 'string' } },
        additionalProperties: false,
      })
    );
    const extra = cases.find((c) => c.source === 'rule:additional-properties');
    expect(extra).toBeDefined();
    expect(extra!.expectation).toBe('error');
    expect(extra!.args['__mcp_tester_unknown__']).toBe(true);
  });

  it('produces an observe case one past maxLength', () => {
    const cases = suggestEdgeCases(
      toolWith({ type: 'object', properties: { msg: { type: 'string', maxLength: 3 } } })
    );
    const maxCase = cases.find((c) => c.source === 'rule:max-length');
    expect(maxCase).toBeDefined();
    expect(maxCase!.expectation).toBe('observe');
    expect(maxCase!.args['msg']).toHaveLength(4);
  });

  it('uses typed wrong-values per target type', () => {
    const cases = suggestEdgeCases(
      toolWith({
        type: 'object',
        properties: {
          s: { type: 'string' },
          n: { type: 'integer' },
          b: { type: 'boolean' },
          a: { type: 'array', items: { type: 'string' } },
        },
        required: ['s', 'n', 'b', 'a'],
      })
    );
    const byKey = new Map(cases.filter((c) => c.source === 'rule:type').map((c) => [c.args, c]));
    // Each wrong-type case replaces exactly one property with a wrong-typed value.
    const typeCases = cases.filter((c) => c.source === 'rule:type');
    expect(typeCases).toHaveLength(4);
    for (const c of typeCases) expect(c.expectation).toBe('error');
    expect(byKey.size).toBe(4); // distinct arg sets
  });

  it('tags every case with a rationale and rule source', () => {
    const cases = suggestEdgeCases(
      toolWith({ type: 'object', properties: { msg: { type: 'string' } }, required: ['msg'] })
    );
    expect(cases.length).toBeGreaterThan(0);
    for (const c of cases) {
      expect(c.rationale.length).toBeGreaterThan(5);
      expect(c.source).toMatch(/^rule:/);
      expect(c.title.length).toBeGreaterThan(5);
    }
  });
});

describe('suggestEdgeCasesForTools', () => {
  it('concatenates cases across tools', () => {
    const cases = suggestEdgeCasesForTools([
      toolWith(echoSchema, 'echo'),
      toolWith(
        {
          type: 'object',
          properties: { a: { type: 'number' }, b: { type: 'number' } },
          required: ['a', 'b'],
        },
        'add'
      ),
    ]);
    expect(cases.filter((c) => c.tool === 'echo').length).toBeGreaterThan(0);
    expect(cases.filter((c) => c.tool === 'add').length).toBeGreaterThan(0);
  });
});

describe('caseKey', () => {
  it('is stable and distinct per tool/args', () => {
    const a: GeneratedCase = {
      tool: 'echo',
      title: 't',
      args: { message: 'x' },
      expectation: 'error',
      rationale: 'r',
      source: 'rule:required',
    };
    expect(caseKey(a)).toBe(caseKey({ ...a, title: 'different' }));
    expect(caseKey(a)).not.toBe(caseKey({ ...a, args: { message: 'y' } }));
    expect(caseKey(a)).not.toBe(caseKey({ ...a, tool: 'add' }));
  });
});

describe('mergeAndValidateCases', () => {
  const schemas = new Map([['echo', toolWith(echoSchema, 'echo')]]);

  const ruleCase: GeneratedCase = {
    tool: 'echo',
    title: 'rejects missing message',
    args: { message: undefined },
    expectation: 'error',
    rationale: 'required',
    source: 'rule:required',
  };

  it('keeps rule cases and drops AI cases that violate the schema', () => {
    const aiCase: GeneratedCase = {
      tool: 'echo',
      title: 'hallucinated arg',
      args: { not_a_real_arg: 'x' },
      expectation: 'success',
      rationale: 'made up',
      source: 'ai:test-model',
    };
    const { cases, rejected } = mergeAndValidateCases([[ruleCase], [aiCase]], schemas);
    expect(cases).toHaveLength(1);
    expect(cases[0].source).toBe('rule:required');
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toContain('message');
  });

  it('drops AI cases that reference unknown tools', () => {
    const aiCase: GeneratedCase = {
      tool: 'nope',
      title: 'unknown tool',
      args: {},
      expectation: 'success',
      rationale: 'hallucination',
      source: 'ai:test-model',
    };
    const { cases, rejected } = mergeAndValidateCases([[], [aiCase]], schemas);
    expect(cases).toHaveLength(0);
    expect(rejected[0].reason).toContain('unknown tool');
  });

  it('keeps valid AI cases and dedupes identical cases', () => {
    const aiCase: GeneratedCase = {
      tool: 'echo',
      title: 'unicode round-trip',
      args: { message: 'héllo' },
      expectation: 'success',
      rationale: 'unicode',
      source: 'ai:test-model',
    };
    const { cases, rejected } = mergeAndValidateCases(
      [[ruleCase], [aiCase, { ...aiCase, title: 'duplicate' }]],
      schemas
    );
    expect(rejected).toHaveLength(0);
    expect(cases).toHaveLength(2);
    expect(cases.map((c) => c.source)).toEqual(['rule:required', 'ai:test-model']);
  });

  it('does not schema-validate error-expectation AI cases', () => {
    const aiCase: GeneratedCase = {
      tool: 'echo',
      title: 'wrong type on purpose',
      args: { message: 42 },
      expectation: 'error',
      rationale: 'type abuse',
      source: 'ai:test-model',
    };
    const { cases, rejected } = mergeAndValidateCases([[], [aiCase]], schemas);
    expect(cases).toHaveLength(1);
    expect(rejected).toHaveLength(0);
  });

  it('leaves cases alone when the tool has no schema registered', () => {
    const schemaless = new Map([['free', toolWith({ type: 'object' }, 'free')]]);
    const c: GeneratedCase = {
      tool: 'free',
      title: 'anything goes',
      args: { whatever: [1, 2, 3] },
      expectation: 'success',
      rationale: 'schemaless',
      source: 'ai:test-model',
    };
    const { cases, rejected } = mergeAndValidateCases([[], [c]], schemaless);
    expect(cases).toHaveLength(1);
    expect(rejected).toHaveLength(0);
  });
});

describe('suggestEdgeCases: new rules', () => {
  it('emits a case when schema declares a pattern', () => {
    const tool = toolWith({
      type: 'object',
      properties: { code: { type: 'string', pattern: '^[A-Z]{3}$' } },
      required: ['code'],
    });
    const cases = suggestEdgeCases(tool);
    const patternCase = cases.find((c) => c.source === 'rule:pattern');
    expect(patternCase).toBeDefined();
    expect(patternCase?.args['code']).toBe('__mcp_tester_invalid__');
    expect(patternCase?.expectation).toBe('error');
  });

  it('emits a case for exclusiveMinimum / exclusiveMaximum', () => {
    const tool = toolWith({
      type: 'object',
      properties: {
        low: { type: 'number', exclusiveMinimum: 0 },
        high: { type: 'number', exclusiveMaximum: 100 },
      },
      required: ['low', 'high'],
    });
    const cases = suggestEdgeCases(tool);
    const sources = cases.map((c) => c.source);
    expect(sources.filter((s) => s === 'rule:bounds').length).toBeGreaterThanOrEqual(2);
    const lowCase = cases.find((c) => c.args['low'] === 0);
    const highCase = cases.find((c) => c.args['high'] === 100);
    expect(lowCase?.expectation).toBe('error');
    expect(highCase?.expectation).toBe('error');
  });

  it('emits a case for maxItems', () => {
    const tool = toolWith({
      type: 'object',
      properties: { tags: { type: 'array', maxItems: 2, items: { type: 'string' } } },
      required: ['tags'],
    });
    const cases = suggestEdgeCases(tool);
    const maxCase = cases.find((c) => c.source === 'rule:max-items');
    expect(maxCase).toBeDefined();
    expect(Array.isArray(maxCase?.args['tags'])).toBe(true);
    expect((maxCase?.args['tags'] as unknown[]).length).toBeGreaterThan(2);
  });

  it('emits a case for uniqueItems with duplicates', () => {
    const tool = toolWith({
      type: 'object',
      properties: { ids: { type: 'array', uniqueItems: true, items: { type: 'string' } } },
      required: ['ids'],
    });
    const cases = suggestEdgeCases(tool);
    const dupCase = cases.find((c) => c.source === 'rule:unique-items');
    expect(dupCase).toBeDefined();
    const ids = dupCase?.args['ids'] as unknown[];
    expect(ids?.length).toBe(2);
    expect(ids?.[0]).toBe(ids?.[1]);
  });

  it('emits a case for additionalProperties as a schema', () => {
    const tool = toolWith({
      type: 'object',
      properties: { name: { type: 'string' } },
      additionalProperties: { type: 'string' },
    });
    const cases = suggestEdgeCases(tool);
    const schemaCase = cases.find((c) => c.source === 'rule:additional-properties-schema');
    expect(schemaCase).toBeDefined();
    // extra prop is a number, but additionalProperties says string
    expect(schemaCase?.args['__mcp_tester_unknown__']).toBe(12345);
  });
});

describe('validateArgsAgainstSchema: new rules', () => {
  it('rejects when pattern does not match', () => {
    const schema = {
      type: 'object' as const,
      properties: { code: { type: 'string', pattern: '^A' } },
    };
    expect(validateArgsAgainstSchema({ code: 'B' }, schema)).toMatch(/pattern/);
    expect(validateArgsAgainstSchema({ code: 'A1' }, schema)).toBeNull();
  });

  it('rejects when exclusiveMinimum is not exclusive', () => {
    const schema = {
      type: 'object' as const,
      properties: { x: { type: 'number', exclusiveMinimum: 5 } },
    };
    expect(validateArgsAgainstSchema({ x: 5 }, schema)).toMatch(/exclusive/);
    expect(validateArgsAgainstSchema({ x: 6 }, schema)).toBeNull();
  });

  it('rejects when maxItems is exceeded', () => {
    const schema = {
      type: 'object' as const,
      properties: { arr: { type: 'array', maxItems: 2, items: { type: 'string' } } },
    };
    expect(validateArgsAgainstSchema({ arr: ['a', 'b', 'c'] }, schema)).toMatch(/maxItems/);
    expect(validateArgsAgainstSchema({ arr: ['a'] }, schema)).toBeNull();
  });

  it('rejects duplicates when uniqueItems is true', () => {
    const schema = {
      type: 'object' as const,
      properties: { arr: { type: 'array', uniqueItems: true, items: { type: 'string' } } },
    };
    expect(validateArgsAgainstSchema({ arr: ['a', 'a'] }, schema)).toMatch(/duplicate/);
    expect(validateArgsAgainstSchema({ arr: ['a', 'b'] }, schema)).toBeNull();
  });

  it('validates unknown properties against additionalProperties schema', () => {
    const schema = {
      type: 'object' as const,
      properties: {},
      additionalProperties: { type: 'string' },
    };
    expect(validateArgsAgainstSchema({ extra: 123 }, schema)).toMatch(
      /additionalProperties: type string/
    );
    expect(validateArgsAgainstSchema({ extra: 'ok' }, schema)).toBeNull();
  });

  it('ignores invalid regex patterns in schemas', () => {
    const schema = {
      type: 'object' as const,
      properties: { s: { type: 'string', pattern: '[invalid(' } },
    };
    // Should not throw; should accept anything
    expect(validateArgsAgainstSchema({ s: 'anything' }, schema)).toBeNull();
  });
});

describe('caseKey is order-independent', () => {
  it('produces the same key for the same args in different key order', () => {
    const a: GeneratedCase = {
      tool: 't',
      title: 'x',
      args: { foo: 1, bar: 2 },
      expectation: 'success',
      rationale: '',
      source: 'rule:test',
    };
    const b: GeneratedCase = { ...a, args: { bar: 2, foo: 1 } };
    expect(caseKey(a)).toBe(caseKey(b));
  });

  it('produces different keys for different values', () => {
    const a: GeneratedCase = {
      tool: 't',
      title: 'x',
      args: { foo: 1 },
      expectation: 'success',
      rationale: '',
      source: 'rule:test',
    };
    const b: GeneratedCase = { ...a, args: { foo: 2 } };
    expect(caseKey(a)).not.toBe(caseKey(b));
  });
});

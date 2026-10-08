/**
 * Edge-case engine — derives intelligent test cases from tool JSON Schemas.
 *
 * Two sources of cases:
 * 1. Deterministic rules over `inputSchema` ({@link suggestEdgeCases}) — always
 *    available, no network, no API key.
 * 2. AI-suggested cases (see `src/ai/provider.ts`) — validated against the
 *    same schemas before use.
 *
 * Both produce {@link GeneratedCase} records: plain data, never code. The
 * emitter in `generate-tests.ts` renders them, so LLM output can never become
 * arbitrary code in a generated test file.
 *
 * @module generate-cases
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/** What the generator expects to happen when the case runs. */
export type CaseExpectation =
  /** The call should succeed (no `isError`, no throw). */
  | 'success'
  /** The call should be rejected by the server (throw or `isError: true`). */
  | 'error'
  /** Behavior is server-defined; the test only records the result. */
  | 'observe';

/** Where a case came from — rendered as a provenance comment. */
export type CaseSource = `rule:${string}` | `ai:${string}` | 'static';

/**
 * A single proposed tool-call test case. Pure data — safe to serialize,
 * validate, cache, and render.
 */
export interface GeneratedCase {
  /** Name of the tool this case calls. */
  tool: string;
  /** Test title (rendered as the `it('...')` name). */
  title: string;
  /** Arguments for the tool call. */
  args: Record<string, unknown>;
  /** What the generator expects to happen. */
  expectation: CaseExpectation;
  /** Why this case exists (rendered as a comment). */
  rationale: string;
  /** Provenance, e.g. `rule:min-length` or `ai:gpt-4o-mini`. */
  source: CaseSource;
  /** Set by `--verify`: what the server actually returned for this case. */
  observed?: CaseExpectation;
}

/**
 * Generate sample arguments from a JSON Schema property.
 */
export function generateSampleValue(schema: Record<string, unknown>): unknown {
  const type = schema.type as string | undefined;
  const examples = schema.examples as unknown[];
  const enumValues = schema['enum'] as unknown[];

  if (enumValues && enumValues.length > 0) return enumValues[0];
  if (examples && examples.length > 0) return examples[0];
  if (schema.default !== undefined) return schema.default;

  switch (type) {
    case 'string':
      return schema.description
        ? `example-${String(schema.description).toLowerCase().replace(/\s+/g, '-')}`
        : 'example';
    case 'number':
    case 'integer': {
      // Keep the sample inside [minimum, maximum] so base arguments remain
      // valid for bounded schemas (42 would break every derived case).
      let value = 42;
      const min = schema.minimum as number | undefined;
      const max = schema.maximum as number | undefined;
      if (typeof max === 'number' && value > max) value = max;
      if (typeof min === 'number' && value < min) value = min;
      return value;
    }
    case 'boolean':
      return true;
    case 'array': {
      // Honor minItems so base arguments satisfy the schema.
      const minItems = typeof schema.minItems === 'number' ? Math.max(schema.minItems, 1) : 1;
      const itemSchema = schema.items as Record<string, unknown> | undefined;
      return Array.from({ length: minItems }, () =>
        itemSchema ? generateSampleValue(itemSchema) : 'example'
      );
    }
    case 'object':
      return {};
    default:
      return 'example';
  }
}

/**
 * Generate valid sample arguments from a tool's input schema.
 */
export function generateToolArgs(tool: Tool): Record<string, unknown> {
  const schema = tool.inputSchema;
  if (!schema || !schema.properties) return {};

  const args: Record<string, unknown> = {};
  const props = schema.properties as Record<string, Record<string, unknown>>;
  const required = new Set((schema.required as string[]) || []);

  // Generate values for all required fields, and optional ones with defaults
  for (const [key, propSchema] of Object.entries(props)) {
    if (required.has(key) || propSchema.default !== undefined) {
      args[key] = generateSampleValue(propSchema);
    }
  }

  // If no required fields, generate at least one so the test is useful
  if (Object.keys(args).length === 0 && Object.keys(props).length > 0) {
    const firstKey = Object.keys(props)[0];
    args[firstKey] = generateSampleValue(props[firstKey]);
  }

  return args;
}

/** JSON type name for a JS value, aligned with JSON Schema type keywords. */
function jsonTypeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  if (typeof value === 'number') return 'number';
  return typeof value; // 'string' | 'boolean' | 'object'
}

/** Does `value` satisfy the schema's `type` keyword (integer ⊂ number)? */
function typeMatches(value: unknown, expected: string | string[] | undefined): boolean {
  if (expected === undefined) return true;
  const actual = jsonTypeOf(value);
  const types = Array.isArray(expected) ? expected : [expected];
  return types.some((t) => t === actual || (t === 'number' && actual === 'integer'));
}

/**
 * Lightweight validation of `args` against a tool's `inputSchema`.
 *
 * Checks top-level properties only (required, type, enum, min/maxLength,
 * minimum/maximum, minItems, additionalProperties). Nested schemas are not
 * traversed — the AI layer uses this as a sanity gate, not a full validator.
 *
 * @returns `null` when the args are acceptable, otherwise a human-readable
 *   reason why they are not.
 */
export function validateArgsAgainstSchema(
  args: Record<string, unknown>,
  schema: Tool['inputSchema']
): string | null {
  if (!schema || typeof schema !== 'object') return null;

  const props = (schema.properties as Record<string, Record<string, unknown>> | undefined) ?? {};
  const required = (schema.required as string[] | undefined) ?? [];

  for (const key of required) {
    if (!(key in args)) return `missing required property "${key}"`;
  }

  for (const [key, value] of Object.entries(args)) {
    const prop = props[key];

    if (!prop) {
      if (schema.additionalProperties === false) {
        return `unknown property "${key}" (additionalProperties is false)`;
      }
      continue;
    }

    if (!typeMatches(value, prop.type as string | string[] | undefined)) {
      return `property "${key}" should be ${String(prop.type)}, got ${jsonTypeOf(value)}`;
    }

    const enumValues = prop['enum'] as unknown[] | undefined;
    if (enumValues && !enumValues.includes(value)) {
      return `property "${key}" must be one of ${JSON.stringify(enumValues)}`;
    }

    if (typeof value === 'string') {
      if (typeof prop.minLength === 'number' && value.length < prop.minLength) {
        return `property "${key}" is shorter than minLength ${prop.minLength}`;
      }
      if (typeof prop.maxLength === 'number' && value.length > prop.maxLength) {
        return `property "${key}" is longer than maxLength ${prop.maxLength}`;
      }
    }

    if (typeof value === 'number') {
      if (typeof prop.minimum === 'number' && value < prop.minimum) {
        return `property "${key}" is below minimum ${prop.minimum}`;
      }
      if (typeof prop.maximum === 'number' && value > prop.maximum) {
        return `property "${key}" is above maximum ${prop.maximum}`;
      }
    }

    if (Array.isArray(value) && typeof prop.minItems === 'number') {
      if (value.length < prop.minItems) {
        return `property "${key}" has fewer than minItems ${prop.minItems}`;
      }
    }
  }

  return null;
}

/** Sentinel value used to violate string enums and string constraints. */
const INVALID_STRING = '__mcp_tester_invalid__';

/**
 * Derive deterministic edge cases for one tool from its `inputSchema`.
 *
 * Rules (each emitted only when the schema actually constrains it):
 * - `required` — omit each required property → error
 * - `enum` — a value outside the enum → error
 * - `min-length` / `max-length` — boundary and one-past-the-bound strings
 * - `bounds` — number/integer at `minimum`/`maximum` and one past
 * - `type` — a value of the wrong JSON type → error
 * - `min-items` — an array shorter than `minItems` → error
 * - `additional-properties` — an unknown property → error (false) or observe
 *
 * @returns One or more cases; may be empty for schemas with no constraints.
 */
export function suggestEdgeCases(tool: Tool): GeneratedCase[] {
  const schema = tool.inputSchema;
  if (!schema || !schema.properties) return [];

  const props = schema.properties as Record<string, Record<string, unknown>>;
  const required = new Set((schema.required as string[]) || []);
  const base = generateToolArgs(tool);
  const cases: GeneratedCase[] = [];

  const withArgs = (
    mutate: (args: Record<string, unknown>) => void,
    title: string,
    expectation: CaseExpectation,
    rationale: string,
    source: `rule:${string}`
  ): void => {
    const args = { ...base };
    mutate(args);
    cases.push({ tool: tool.name, title, args, expectation, rationale, source });
  };

  // Property metadata lookups
  const stringProps = Object.entries(props).filter(([, p]) => p.type === 'string');
  const numberProps = Object.entries(props).filter(
    ([, p]) => p.type === 'number' || p.type === 'integer'
  );
  const arrayProps = Object.entries(props).filter(([, p]) => p.type === 'array');

  // rule:required — omit each required property
  for (const key of required) {
    if (!(key in props)) continue;
    withArgs(
      (args) => delete args[key],
      `rejects call without required "${key}"`,
      'error',
      `"${key}" is required; the server should reject its absence`,
      'rule:required'
    );
  }

  // rule:enum — a value outside the enum
  for (const [key, prop] of Object.entries(props)) {
    const enumValues = prop['enum'] as unknown[] | undefined;
    if (!enumValues || enumValues.length === 0) continue;

    let invalid: unknown;
    if (typeof enumValues[0] === 'string') {
      invalid = enumValues.includes(INVALID_STRING) ? undefined : INVALID_STRING;
    } else if (typeof enumValues[0] === 'number') {
      const max = Math.max(...enumValues.filter((v): v is number => typeof v === 'number'));
      invalid = Number.isFinite(max) ? max + 1 : undefined;
    }
    if (invalid === undefined) continue;

    withArgs(
      (args) => {
        args[key] = invalid;
      },
      `rejects "${key}" outside enum (not in [${enumValues.map(String).join(', ')}])`,
      'error',
      `"${key}" is constrained to enum ${JSON.stringify(enumValues)}`,
      'rule:enum'
    );
  }

  // rule:min-length / rule:max-length — string boundaries
  for (const [key, prop] of stringProps) {
    const minLength = prop.minLength as number | undefined;
    const maxLength = prop.maxLength as number | undefined;

    if (typeof minLength === 'number' && minLength > 0) {
      withArgs(
        (args) => {
          args[key] = 'x'.repeat(Math.max(minLength - 1, 0));
        },
        `rejects "${key}" shorter than minLength ${minLength}`,
        'error',
        `"${key}" requires at least ${minLength} character(s)`,
        'rule:min-length'
      );
    }
    if (typeof maxLength === 'number') {
      withArgs(
        (args) => {
          args[key] = 'x'.repeat(maxLength + 1);
        },
        `behavior of "${key}" longer than maxLength ${maxLength}`,
        'observe',
        `"${key}" allows at most ${maxLength} characters — one past the bound`,
        'rule:max-length'
      );
    }
  }

  // rule:bounds — number boundaries
  for (const [key, prop] of numberProps) {
    const minimum = prop.minimum as number | undefined;
    const maximum = prop.maximum as number | undefined;

    if (typeof minimum === 'number') {
      withArgs(
        (args) => {
          args[key] = minimum - 1;
        },
        `rejects "${key}" below minimum ${minimum}`,
        'error',
        `"${key}" must be >= ${minimum}`,
        'rule:bounds'
      );
    }
    if (typeof maximum === 'number') {
      withArgs(
        (args) => {
          args[key] = maximum + 1;
        },
        `rejects "${key}" above maximum ${maximum}`,
        'error',
        `"${key}" must be <= ${maximum}`,
        'rule:bounds'
      );
    }
  }

  // rule:type — wrong JSON type for each required property
  for (const [key, prop] of Object.entries(props)) {
    if (!required.has(key)) continue;
    const expected = prop.type as string | undefined;
    let wrong: unknown;
    switch (expected) {
      case 'string':
        wrong = 12345;
        break;
      case 'number':
      case 'integer':
        wrong = 'not-a-number';
        break;
      case 'boolean':
        wrong = 'not-a-boolean';
        break;
      case 'array':
        wrong = 'not-an-array';
        break;
      case 'object':
        wrong = 'not-an-object';
        break;
      default:
        continue;
    }
    withArgs(
      (args) => {
        args[key] = wrong;
      },
      `rejects wrong type for "${key}" (expected ${expected})`,
      'error',
      `"${key}" is typed "${expected}"; a wrongly-typed (${jsonTypeOf(wrong)}) value should be rejected`,
      'rule:type'
    );
  }

  // rule:min-items — array shorter than minItems
  for (const [key, prop] of arrayProps) {
    const minItems = prop.minItems as number | undefined;
    if (typeof minItems === 'number' && minItems > 0) {
      withArgs(
        (args) => {
          args[key] = [];
        },
        `rejects "${key}" with fewer than minItems ${minItems}`,
        'error',
        `"${key}" requires at least ${minItems} item(s)`,
        'rule:min-items'
      );
    }
  }

  // rule:additional-properties — unknown property
  if (schema.additionalProperties === false) {
    withArgs(
      (args) => {
        args['__mcp_tester_unknown__'] = true;
      },
      'rejects an unknown property (additionalProperties: false)',
      'error',
      'schema sets additionalProperties: false; unknown keys should be rejected',
      'rule:additional-properties'
    );
  }

  return cases;
}

/**
 * Derive deterministic edge cases for a set of tools.
 */
export function suggestEdgeCasesForTools(tools: Tool[]): GeneratedCase[] {
  return tools.flatMap((tool) => suggestEdgeCases(tool));
}

/** Two cases collide when they target the same tool with identical args. */
export function caseKey(c: GeneratedCase): string {
  return `${c.tool}::${JSON.stringify(c.args)}`;
}

/**
 * Merge case lists, dropping later duplicates (same tool + args) and cases
 * whose args fail schema validation.
 *
 * @returns Accepted cases plus the number of rejected ones (for logging).
 */
export function mergeAndValidateCases(
  groups: GeneratedCase[][],
  schemas: Map<string, Tool>
): { cases: GeneratedCase[]; rejected: Array<{ c: GeneratedCase; reason: string }> } {
  const seen = new Set<string>();
  const cases: GeneratedCase[] = [];
  const rejected: Array<{ c: GeneratedCase; reason: string }> = [];

  for (const group of groups) {
    for (const c of group) {
      const key = caseKey(c);
      if (seen.has(key)) continue;

      const schema = schemas.get(c.tool)?.inputSchema;
      if (schema) {
        // 'error'-expectation cases intentionally violate the schema; skip
        // validation for them so the rules engine's own output survives.
        if (c.expectation !== 'error') {
          const reason = validateArgsAgainstSchema(c.args, schema);
          if (reason) {
            rejected.push({ c, reason });
            continue;
          }
        }
      } else if (!schemas.has(c.tool)) {
        rejected.push({ c, reason: `unknown tool "${c.tool}"` });
        continue;
      }

      seen.add(key);
      cases.push(c);
    }
  }

  return { cases, rejected };
}

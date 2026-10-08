/**
 * AI test-case provider — pluggable, optional augmentation of the
 * deterministic edge-case engine.
 *
 * The provider speaks the OpenAI-compatible chat-completions protocol
 * (`POST {baseUrl}/chat/completions`), which covers OpenAI, Ollama, LM
 * Studio, vLLM, Groq, Together, and most local gateways. Implemented with
 * plain `fetch` — no SDK dependency.
 *
 * Security model: the LLM returns *data* (JSON test cases), never code.
 * Every case is validated against the tool's real schema by
 * `mergeAndValidateCases` before it can reach a generated file, so prompt
 * injection via server-provided tool descriptions cannot inject code.
 *
 * @module ai/provider
 */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  type GeneratedCase,
  type CaseExpectation,
  mergeAndValidateCases,
} from '../generate-cases.js';

/** Server snapshot handed to a provider. Descriptions are length-capped. */
export interface ServerAnalysis {
  /** Human-readable server label for the prompt. */
  serverLabel?: string;
  /** Tools to reason about. */
  tools: Array<{
    name: string;
    description?: string;
    inputSchema: Record<string, unknown>;
  }>;
}

/** Anything that can propose test cases for a server analysis. */
export interface AIProvider {
  /** Provider/model identity, used for case provenance (`ai:<name>`). */
  readonly name: string;
  /** Propose cases; implementers should tolerate partial failures. */
  suggestCases(analysis: ServerAnalysis): Promise<GeneratedCase[]>;
}

/** Options for {@link OpenAICompatProvider}. */
export interface OpenAICompatOptions {
  /** API base URL. @defaultValue 'https://api.openai.com/v1' */
  baseUrl?: string;
  /** Chat model name. @defaultValue 'gpt-4o-mini' */
  model?: string;
  /** Bearer token; omit for local servers that don't need one. */
  apiKey?: string;
  /** Request timeout in ms. @defaultValue 60000 */
  timeout?: number;
  /** Cap on completion tokens per request. @defaultValue 4096 */
  maxTokens?: number;
  /** Cache directory; `null` disables caching. @defaultValue '.mcp-tester-cache' */
  cacheDir?: string | null;
  /** Injectable fetch for tests. @defaultValue globalThis.fetch */
  fetchImpl?: typeof fetch;
}

export const DEFAULT_AI_BASE_URL = 'https://api.openai.com/v1';
export const DEFAULT_AI_MODEL = 'gpt-4o-mini';

/** Longest tool description (chars) fed to the model. */
const MAX_DESCRIPTION_CHARS = 500;
/** Maximum tools per request. */
const MAX_TOOLS_PER_REQUEST = 40;

const SYSTEM_PROMPT = `You are a test designer for MCP (Model Context Protocol) servers.
Given tool names, descriptions and JSON Schemas, propose edge-case test calls.

Return STRICT JSON: {"cases":[{"tool":"<tool name>","title":"<short test name>","args":{...},"expectation":"success"|"error"|"observe","rationale":"<why>"}]}

Rules:
- "args" MUST use only property names from the tool's inputSchema, with correct JSON types.
- expectation "error": input is clearly invalid per the schema (missing required field, wrong type, out of range/enum).
- expectation "success": valid but unusual input that should still work (empty string if allowed, unicode, boundary values, zero, negative numbers).
- expectation "observe": behavior is server-defined (e.g. truncation past maxLength); do not assert.
- 2-5 cases per tool. No duplicates of the same arguments. Respond with JSON only.`;

/** Raw case shape returned by the model, before validation. */
interface RawCase {
  tool?: unknown;
  title?: unknown;
  args?: unknown;
  expectation?: unknown;
  rationale?: unknown;
}

/** Extract a JSON object from model content, tolerating markdown fences. */
function parseJsonLoose(content: string): { cases?: unknown } | null {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : content;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as { cases?: unknown };
  } catch {
    return null;
  }
}

/** Coerce one raw model case into a {@link GeneratedCase}, or null. */
function coerceCase(raw: unknown, providerName: string): GeneratedCase | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as RawCase;

  if (typeof r.tool !== 'string' || r.tool.length === 0) return null;
  if (typeof r.title !== 'string' || r.title.length === 0) return null;
  if (!r.args || typeof r.args !== 'object' || Array.isArray(r.args)) return null;

  const expectation = r.expectation as CaseExpectation;
  if (expectation !== 'success' && expectation !== 'error' && expectation !== 'observe') {
    return null;
  }

  return {
    tool: r.tool,
    title: r.title.slice(0, 120),
    args: r.args as Record<string, unknown>,
    expectation,
    rationale: typeof r.rationale === 'string' ? r.rationale.slice(0, 300) : 'AI-suggested case',
    source: `ai:${providerName}`,
  };
}

/**
 * OpenAI-compatible chat-completions provider.
 *
 * Works with OpenAI, Ollama (`http://localhost:11434/v1`), LM Studio,
 * vLLM, Groq, and any compatible gateway.
 */
export class OpenAICompatProvider implements AIProvider {
  readonly name: string;

  private readonly baseUrl: string;
  private readonly model: string;
  private readonly apiKey?: string;
  private readonly timeout: number;
  private readonly maxTokens: number;
  private readonly cacheDir: string | null;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenAICompatOptions = {}) {
    this.baseUrl = (options.baseUrl || DEFAULT_AI_BASE_URL).replace(/\/+$/, '');
    this.model = options.model || DEFAULT_AI_MODEL;
    this.apiKey = options.apiKey;
    this.timeout = options.timeout ?? 60_000;
    this.maxTokens = options.maxTokens ?? 4096;
    this.cacheDir = options.cacheDir === undefined ? '.mcp-tester-cache' : options.cacheDir;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.name = this.model;
  }

  async suggestCases(analysis: ServerAnalysis): Promise<GeneratedCase[]> {
    if (analysis.tools.length === 0) return [];

    const cacheKey = this.cacheKeyFor(analysis);
    const cached = this.readCache(cacheKey);
    if (cached) return cached;

    const tools = analysis.tools.slice(0, MAX_TOOLS_PER_REQUEST).map((t) => ({
      name: t.name,
      description: t.description ? t.description.slice(0, MAX_DESCRIPTION_CHARS) : '',
      inputSchema: t.inputSchema,
    }));

    const content = await this.chatCompletion({
      serverLabel: analysis.serverLabel,
      tools,
    });

    const parsed = parseJsonLoose(content);
    const rawCases = parsed && Array.isArray(parsed.cases) ? parsed.cases : [];

    // Coerce + dedupe. Schema validation happens later, in
    // mergeAndValidateCases, where rules and AI cases are merged together.
    const seen = new Set<string>();
    const cases: GeneratedCase[] = [];
    for (const raw of rawCases) {
      const c = coerceCase(raw, this.name);
      if (!c) continue;
      const key = `${c.tool}::${JSON.stringify(c.args)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      cases.push(c);
    }

    this.writeCache(cacheKey, cases);
    return cases;
  }

  /** Single chat-completions round trip. Throws with response context. */
  private async chatCompletion(payload: { serverLabel?: string; tools: unknown }): Promise<string> {
    const userMessage = [
      payload.serverLabel ? `Server: ${payload.serverLabel}` : null,
      'Tools:',
      JSON.stringify(payload.tools, null, 2),
    ]
      .filter(Boolean)
      .join('\n\n');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.2,
          max_tokens: this.maxTokens,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(
          `AI request failed: HTTP ${response.status} from ${this.baseUrl}/chat/completions${body ? ` — ${body.slice(0, 200)}` : ''}`
        );
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        throw new Error('AI response had no message content');
      }
      return content;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`AI request timed out after ${this.timeout}ms`);
      }
      throw error instanceof Error ? error : new Error(String(error));
    } finally {
      clearTimeout(timer);
    }
  }

  private cacheKeyFor(analysis: ServerAnalysis): string {
    const hash = createHash('sha256')
      .update(this.model)
      .update('\u0000')
      .update(JSON.stringify(analysis.tools))
      .digest('hex');
    return `ai-cases-${hash}.json`;
  }

  private readCache(key: string): GeneratedCase[] | null {
    if (!this.cacheDir) return null;
    const file = join(this.cacheDir, key);
    try {
      if (!existsSync(file)) return null;
      const data = JSON.parse(readFileSync(file, 'utf-8')) as { model?: string; cases?: unknown };
      if (data.model !== this.model || !Array.isArray(data.cases)) return null;
      return data.cases
        .map((c) => coerceCase(c, this.name))
        .filter((c): c is GeneratedCase => c !== null);
    } catch {
      return null;
    }
  }

  private writeCache(key: string, cases: GeneratedCase[]): void {
    if (!this.cacheDir) return;
    try {
      mkdirSync(this.cacheDir, { recursive: true });
      writeFileSync(
        join(this.cacheDir, key),
        JSON.stringify({ model: this.model, cases }, null, 2),
        'utf-8'
      );
    } catch {
      // Cache is best-effort; never fail generation over it.
    }
  }
}

/**
 * Build a provider from `MCP_TESTER_AI_*` environment variables.
 *
 * - `MCP_TESTER_AI_API_KEY` — required for hosted APIs; optional for local.
 * - `MCP_TESTER_AI_BASE_URL` — @defaultValue 'https://api.openai.com/v1'
 * - `MCP_TESTER_AI_MODEL` — @defaultValue 'gpt-4o-mini'
 *
 * @returns A provider, or `null` when no API key is configured. A base URL
 *   pointing at localhost counts as configured even without a key (Ollama
 *   and friends don't need auth).
 */
export function createProviderFromEnv(
  env: NodeJS.ProcessEnv = process.env
): OpenAICompatProvider | null {
  const apiKey = env['MCP_TESTER_AI_API_KEY'];
  const baseUrl = env['MCP_TESTER_AI_BASE_URL'];
  const model = env['MCP_TESTER_AI_MODEL'];

  const isLocal = baseUrl ? /\/\/(localhost|127\.0\.0\.1|\[::1\])/.test(baseUrl) : false;
  if (!apiKey && !isLocal) return null;

  return new OpenAICompatProvider({
    apiKey,
    baseUrl,
    model,
  });
}

/**
 * Convenience: ask the AI provider to suggest test cases, then validate them
 * against the tools' real input schemas. Does NOT merge with deterministic
 * rules — callers wanting the union should call {@link suggestEdgeCases} (or
 * `suggestEdgeCasesForTools`) themselves and concatenate.
 *
 * @returns Validated cases, rejected entries with reasons, and the provider
 *   name (for diagnostic logging).
 */
export async function suggestCasesWithAI(
  analysis: ServerAnalysis,
  provider: AIProvider,
  schemas: Map<string, Tool>
): Promise<{ cases: GeneratedCase[]; rejected: string[]; providerName: string }> {
  const aiCases = await provider.suggestCases(analysis);
  const { cases, rejected } = mergeAndValidateCases([aiCases], schemas);
  return {
    cases,
    rejected: rejected.map((r) => `${r.c.tool}/${r.c.title}: ${r.reason}`),
    providerName: provider.name,
  };
}

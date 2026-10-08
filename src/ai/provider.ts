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
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  type GeneratedCase,
  type CaseExpectation,
  caseKey,
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
  /**
   * Injectable fetch for tests. @defaultValue globalThis.fetch
   */
  fetchImpl?: typeof fetch;
  /**
   * Send OpenAI's `response_format: { type: 'json_object' }` flag. Supported
   * by OpenAI, Together, Groq, and most modern gateways; some local servers
   * (Ollama, older vLLM) reject it. Set to `false` if your gateway returns
   * HTTP 400 mentioning `response_format`. When `true` (default), a 400 that
   * explicitly blames `response_format` triggers one automatic retry without
   * the flag.
   * @defaultValue true
   */
  strictJson?: boolean;
  /**
   * Maximum age in ms for cached AI responses. When set, cache files older
   * than this are ignored and re-fetched. Unset (default) means cache never
   * expires; entries are only invalidated when the model or tool set changes.
   * @defaultValue undefined
   */
  cacheMaxAgeMs?: number;
}

export const DEFAULT_AI_BASE_URL = 'https://api.openai.com/v1';
export const DEFAULT_AI_MODEL = 'gpt-4o-mini';

/** Longest tool description (chars) fed to the model. */
const MAX_DESCRIPTION_CHARS = 500;
/** Maximum tools per request. */
const MAX_TOOLS_PER_REQUEST = 40;

/**
 * Wraps `statSync` so a transient FS error doesn't crash cache reads. We
 * return `null` for any failure (missing file, permission, EBUSY) so the
 * caller falls back to a fresh fetch.
 */
function statSyncSafe(file: string): { mtimeMs: number } | null {
  try {
    return statSync(file);
  } catch {
    return null;
  }
}

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

/**
 * Extract a JSON object from model content, tolerating markdown fences and
 * prose around the payload. Uses brace-aware scanning so a `}` inside a
 * string value or in a nested object doesn't truncate the payload.
 *
 * @returns The parsed object, or `null` when no parseable JSON object is
 *   found in the input.
 */
export function parseJsonLoose(content: string): { cases?: unknown } | null {
  if (typeof content !== 'string' || content.length === 0) return null;

  // 1. Prefer a fenced code block (with or without a language hint) if any.
  const fenceRe = /```(?:[a-zA-Z0-9_-]+)?\s*([\s\S]*?)```/g;
  for (const m of content.matchAll(fenceRe)) {
    if (!m[1] || !m[1].includes('{')) continue;
    const fenced = extractLargestJsonObject(m[1]);
    if (fenced) return fenced;
    // Fall through: the fence may hold prose or a non-JSON snippet while the
    // real payload sits outside it, so keep trying other fences/content.
  }

  // 2. Otherwise, scan for the largest parseable JSON object directly.
  return extractLargestJsonObject(content);
}

/**
 * Find the largest top-level JSON object in `text` that parses successfully.
 * Walks every `{` candidate, attempts to parse from there using a brace/quote
 * tracker, and returns the parse with the most characters consumed (longest
 * valid object).
 */
function extractLargestJsonObject(text: string): { cases?: unknown } | null {
  let best: { cases?: unknown } | null = null;
  let bestLen = -1;

  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{') continue;
    const end = scanJsonObjectEnd(text, i);
    if (end === -1) continue;
    const slice = text.slice(i, end + 1);
    try {
      const parsed = JSON.parse(slice) as { cases?: unknown };
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        if (slice.length > bestLen) {
          best = parsed;
          bestLen = slice.length;
        }
        // Any `{` strictly inside this well-formed object can only parse to a
        // shorter object, so skip past it (keeps the scan linear for valid JSON).
        i = end;
      }
    } catch {
      // not a valid object; keep scanning inside it for a nested one
    }
  }

  return best;
}

/**
 * Given the index of an opening `{`, return the index of its matching `}`,
 * honoring strings (including escape sequences) and nested objects/arrays.
 * Returns `-1` if the object is unterminated.
 */
function scanJsonObjectEnd(text: string, start: number): number {
  if (text[start] !== '{') return -1;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === '{' || ch === '[') {
      depth++;
    } else if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) return i;
      if (depth < 0) return -1;
    }
  }
  return -1;
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
  private readonly cacheMaxAgeMs: number | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly strictJson: boolean;
  /** Tracks whether this provider has already observed a `response_format` rejection. */
  private responseFormatDisabled = false;

  constructor(options: OpenAICompatOptions = {}) {
    this.baseUrl = (options.baseUrl || DEFAULT_AI_BASE_URL).replace(/\/+$/, '');
    this.model = options.model || DEFAULT_AI_MODEL;
    this.apiKey = options.apiKey;
    this.timeout = options.timeout ?? 60_000;
    this.maxTokens = options.maxTokens ?? 4096;
    this.cacheDir = options.cacheDir === undefined ? '.mcp-tester-cache' : options.cacheDir;
    this.cacheMaxAgeMs = options.cacheMaxAgeMs;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.strictJson = options.strictJson !== false;
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
      const key = caseKey(c);
      if (seen.has(key)) continue;
      seen.add(key);
      cases.push(c);
    }

    this.writeCache(cacheKey, cases, analysis.serverLabel);
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

    // First attempt: include response_format if strictJson wasn't disabled
    // (either by the user or by a previous rejection from this provider).
    const wantsResponseFormat = this.responseFormatDisabled ? false : this.strictJson !== false;
    const primary = await this.rawChatCompletion(userMessage, wantsResponseFormat);
    if (primary.kind === 'ok') return primary.content;
    if (primary.kind === 'timeout') {
      throw new Error(`AI request timed out after ${primary.ms}ms`);
    }
    if (primary.kind !== 'response_format_rejected') {
      throw new Error(
        `AI request failed: HTTP ${primary.status} from ${this.baseUrl}/chat/completions${primary.body ? ` — ${primary.body.slice(0, 200)}` : ''}`
      );
    }

    // Auto-fallback: server complained about response_format. Disable it
    // for this provider instance and retry once. We won't fall back a
    // second time even if the user explicitly set strictJson=true, because
    // the gateway clearly doesn't support it.
    this.responseFormatDisabled = true;
    const retry = await this.rawChatCompletion(userMessage, false);
    if (retry.kind === 'ok') return retry.content;
    if (retry.kind === 'timeout') {
      throw new Error(`AI request timed out after ${retry.ms}ms`);
    }
    throw new Error(
      `AI request failed after response_format fallback: HTTP ${retry.status} from ${this.baseUrl}/chat/completions${retry.body ? ` — ${retry.body.slice(0, 200)}` : ''}`
    );
  }

  /**
   * One HTTP request to the chat-completions endpoint. Categorises the
   * response so the caller can decide whether to retry without
   * `response_format` or just throw.
   */
  private async rawChatCompletion(
    userMessage: string,
    includeResponseFormat: boolean
  ): Promise<
    | { kind: 'ok'; content: string }
    | { kind: 'timeout'; ms: number }
    | { kind: 'http_error'; status: number; body: string }
    | { kind: 'response_format_rejected'; status: number; body: string }
  > {
    const body: Record<string, unknown> = {
      model: this.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.2,
      max_tokens: this.maxTokens,
    };
    if (includeResponseFormat) {
      body['response_format'] = { type: 'json_object' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (response.ok) {
        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = data.choices?.[0]?.message?.content;
        if (typeof content !== 'string') {
          return { kind: 'http_error', status: 502, body: 'no message content in response' };
        }
        return { kind: 'ok', content };
      }

      const errBody = await response.text().catch(() => '');
      if (includeResponseFormat && response.status === 400 && /response_format/i.test(errBody)) {
        return { kind: 'response_format_rejected', status: 400, body: errBody };
      }
      return { kind: 'http_error', status: response.status, body: errBody };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return { kind: 'timeout', ms: this.timeout };
      }
      const message = error instanceof Error ? error.message : String(error);
      return { kind: 'http_error', status: 0, body: message };
    } finally {
      clearTimeout(timer);
    }
  }

  private cacheKeyFor(analysis: ServerAnalysis): string {
    // Include serverLabel so two servers with identical tool sets don't
    // share an entry. Include the tool set in a stable order.
    const toolsKey = analysis.tools
      .map((t) => ({
        name: t.name,
        description: t.description ? t.description.slice(0, MAX_DESCRIPTION_CHARS) : '',
        inputSchema: t.inputSchema,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const hash = createHash('sha256')
      .update(this.model)
      .update('\u0000')
      .update(analysis.serverLabel ?? '')
      .update('\u0000')
      .update(JSON.stringify(toolsKey))
      .digest('hex');
    return `ai-cases-${hash}.json`;
  }

  private readCache(key: string): GeneratedCase[] | null {
    if (!this.cacheDir) return null;
    const file = join(this.cacheDir, key);
    try {
      if (!existsSync(file)) return null;
      // Honour cacheMaxAgeMs via mtime. statSync errors are treated as a
      // miss so a corrupt FS doesn't lock the user out of fresh fetches.
      if (typeof this.cacheMaxAgeMs === 'number' && this.cacheMaxAgeMs > 0) {
        const stat = statSyncSafe(file);
        if (stat && Date.now() - stat.mtimeMs > this.cacheMaxAgeMs) return null;
      }
      const data = JSON.parse(readFileSync(file, 'utf-8')) as {
        model?: string;
        serverLabel?: string;
        cases?: unknown;
      };
      if (data.model !== this.model || !Array.isArray(data.cases)) return null;
      return data.cases
        .map((c) => coerceCase(c, this.name))
        .filter((c): c is GeneratedCase => c !== null);
    } catch {
      return null;
    }
  }

  private writeCache(key: string, cases: GeneratedCase[], serverLabel?: string): void {
    if (!this.cacheDir) return;
    try {
      mkdirSync(this.cacheDir, { recursive: true });
      writeFileSync(
        join(this.cacheDir, key),
        JSON.stringify({ model: this.model, serverLabel, cases }, null, 2),
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

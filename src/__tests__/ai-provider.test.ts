/**
 * Tests for the AI case-suggestion provider (ai/provider.ts).
 *
 * All HTTP interaction is mocked via the injectable `fetchImpl`, so these
 * tests never touch the network.
 */
import { describe, it, expect, afterEach } from '@jest/globals';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  OpenAICompatProvider,
  createProviderFromEnv,
  suggestCasesWithAI,
  DEFAULT_AI_BASE_URL,
  DEFAULT_AI_MODEL,
} from '../ai/provider.js';
import type { OpenAICompatOptions, ServerAnalysis } from '../ai/provider.js';
import { mergeAndValidateCases } from '../generate-cases.js';
import type { FetchMock } from './helpers/fetch-mock.js';
import { jsonResponse, okResponse, errorResponse } from './helpers/fetch-mock.js';
import { readdirSync } from 'node:fs';

const echoTool: Tool = {
  name: 'echo',
  description: 'Echo a message',
  inputSchema: {
    type: 'object',
    properties: { message: { type: 'string' } },
    required: ['message'],
  },
};

const addTool: Tool = {
  name: 'add',
  description: 'Add two numbers',
  inputSchema: {
    type: 'object',
    properties: { a: { type: 'number' }, b: { type: 'number' } },
    required: ['a', 'b'],
  },
};

const analysis = {
  serverLabel: 'test-server',
  tools: [echoTool, addTool],
};

function casesPayload(cases: unknown[]): Response {
  return jsonResponse({ choices: [{ message: { content: JSON.stringify({ cases }) } }] });
}

describe('OpenAICompatProvider', () => {
  const tempDirs: string[] = [];

  function makeProvider(opts: Partial<OpenAICompatOptions> & { mock?: FetchMock }) {
    const dir = mkdtempSync(join(tmpdir(), 'ai-provider-test-'));
    tempDirs.push(dir);
    const { mock, ...rest } = opts;
    const provider = new OpenAICompatProvider({
      cacheDir: join(dir, 'cache'),
      apiKey: 'test-key',
      baseUrl: 'https://fake.example/v1',
      model: 'test-model',
      ...(mock ? { fetchImpl: mock as typeof fetch } : {}),
      ...rest,
    });
    return { provider, dir };
  }

  afterEach(() => {
    while (tempDirs.length) rmSync(tempDirs.pop()!, { recursive: true, force: true });
  });

  it('posts to /chat/completions with auth header and model', async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    const mock: FetchMock = async (url, init) => {
      captured = { url: String(url), init: init! };
      return casesPayload([]);
    };
    const { provider } = makeProvider({ mock });
    await provider.suggestCases(analysis);
    expect(captured).toBeDefined();
    expect(captured!.url).toBe('https://fake.example/v1/chat/completions');
    expect((captured!.init.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer test-key'
    );
    const body = JSON.parse(String(captured!.init.body)) as { model: string; messages: unknown[] };
    expect(body.model).toBe('test-model');
    expect(body.messages).toHaveLength(2);
  });

  it('parses valid cases from the response content', async () => {
    const mock: FetchMock = async () =>
      casesPayload([
        {
          tool: 'echo',
          title: 'unicode round-trip',
          args: { message: 'héllo 🌍' },
          expectation: 'success',
          rationale: 'unicode should survive',
        },
      ]);
    const { provider } = makeProvider({ mock });
    const cases = await provider.suggestCases(analysis);
    expect(cases).toHaveLength(1);
    expect(cases[0]).toMatchObject({
      tool: 'echo',
      title: 'unicode round-trip',
      args: { message: 'héllo 🌍' },
      expectation: 'success',
      source: 'ai:test-model',
    });
  });

  it('parses JSON wrapped in markdown fences', async () => {
    const content =
      '```json\n{"cases":[{"tool":"echo","title":"fenced","args":{"message":"x"},"expectation":"success","rationale":"why"}]}\n```';
    const mock: FetchMock = async () => jsonResponse({ choices: [{ message: { content } }] });
    const { provider } = makeProvider({ mock });
    const cases = await provider.suggestCases(analysis);
    expect(cases).toHaveLength(1);
    expect(cases[0].title).toBe('fenced');
  });

  it('drops malformed and incomplete case objects', async () => {
    const mock: FetchMock = async () =>
      casesPayload([
        { tool: 'echo', args: { message: 'x' } }, // missing title/rationale/expectation
        'not an object',
        null,
        {
          tool: 'echo',
          title: 'bad expectation',
          args: { message: 'x' },
          expectation: 'maybe',
          rationale: 'r',
        },
        {
          tool: 'echo',
          title: 'valid',
          args: { message: 'x' },
          expectation: 'success',
          rationale: 'r',
        },
      ]);
    const { provider } = makeProvider({ mock });
    const cases = await provider.suggestCases(analysis);
    expect(cases).toHaveLength(1);
    expect(cases[0].title).toBe('valid');
  });

  it('throws a descriptive error on HTTP failure', async () => {
    const mock: FetchMock = async () => errorResponse(500, 'boom');
    const { provider } = makeProvider({ mock });
    await expect(provider.suggestCases(analysis)).rejects.toThrow(/HTTP 500.*boom/s);
  });

  it('throws when the response has no content', async () => {
    const mock: FetchMock = async () => jsonResponse({ choices: [] });
    const { provider } = makeProvider({ mock });
    await expect(provider.suggestCases(analysis)).rejects.toThrow(/no message content/);
  });

  it('returns empty immediately for a tool-less analysis', async () => {
    const mock: FetchMock = async () => {
      throw new Error('should not be called');
    };
    const { provider } = makeProvider({ mock });
    expect(await provider.suggestCases({ tools: [] })).toEqual([]);
  });

  it('caches responses on disk and skips the second fetch', async () => {
    let calls = 0;
    const mock: FetchMock = async () => {
      calls += 1;
      return casesPayload([
        {
          tool: 'add',
          title: 'negative operands',
          args: { a: -1, b: -2 },
          expectation: 'success',
          rationale: 'negatives sum',
        },
      ]);
    };
    const { provider, dir } = makeProvider({ mock });
    const first = await provider.suggestCases(analysis);
    expect(calls).toBe(1);
    expect(existsSync(join(dir, 'cache'))).toBe(true);

    const second = await provider.suggestCases(analysis);
    expect(calls).toBe(1); // served from cache
    expect(second).toEqual(first);
  });

  it('invalidates the cache when the model changes', async () => {
    let calls = 0;
    const mock: FetchMock = async () => {
      calls += 1;
      return casesPayload([]);
    };
    const { provider, dir } = makeProvider({ mock });
    await provider.suggestCases(analysis);
    const other = new OpenAICompatProvider({
      cacheDir: join(dir, 'cache'),
      apiKey: 'test-key',
      model: 'other-model',
      fetchImpl: mock,
    });
    await other.suggestCases(analysis);
    expect(calls).toBe(2);
  });

  it('works with cacheDir: null (no cache writes)', async () => {
    const mock: FetchMock = async () => casesPayload([]);
    const provider = new OpenAICompatProvider({ cacheDir: null, fetchImpl: mock });
    await provider.suggestCases(analysis);
    // No assertion beyond "does not throw/write"; the cache dir would be CWD-relative.
  });

  it('exposes the model name as provider name', () => {
    const { provider } = makeProvider({});
    expect(provider.name).toBe('test-model');
  });

  it('uses default base URL and model when unset', () => {
    const provider = new OpenAICompatProvider({ fetchImpl: async () => okResponse() });
    expect(provider.name).toBe(DEFAULT_AI_MODEL);
    expect(DEFAULT_AI_BASE_URL).toBe('https://api.openai.com/v1');
  });

  it('aborts when the fetch takes longer than the timeout', async () => {
    const mock: FetchMock = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
        );
      });
    const { provider } = makeProvider({ mock, timeout: 50 });
    await expect(provider.suggestCases(analysis)).rejects.toThrow(/timed out after 50ms/);
  });
});

describe('createProviderFromEnv', () => {
  const ORIGINAL = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL };
  });

  it('returns null without an API key or local base URL', () => {
    delete process.env['MCP_TESTER_AI_API_KEY'];
    delete process.env['MCP_TESTER_AI_BASE_URL'];
    expect(createProviderFromEnv({})).toBeNull();
  });

  it('creates a provider when an API key is present', () => {
    const p = createProviderFromEnv({ MCP_TESTER_AI_API_KEY: 'k' } as NodeJS.ProcessEnv);
    expect(p).not.toBeNull();
    expect(p!.name).toBe(DEFAULT_AI_MODEL);
  });

  it('counts localhost base URLs as configured without a key', () => {
    for (const url of [
      'http://localhost:11434/v1',
      'http://127.0.0.1:8080/v1',
      'http://[::1]:1234/v1',
    ]) {
      const p = createProviderFromEnv({ MCP_TESTER_AI_BASE_URL: url } as NodeJS.ProcessEnv);
      expect(p).not.toBeNull();
    }
    expect(
      createProviderFromEnv({ MCP_TESTER_AI_BASE_URL: 'https://x.example' } as NodeJS.ProcessEnv)
    ).toBeNull();
  });

  it('picks up the model from the environment', () => {
    const p = createProviderFromEnv({
      MCP_TESTER_AI_API_KEY: 'k',
      MCP_TESTER_AI_MODEL: 'llama3',
    } as NodeJS.ProcessEnv);
    expect(p!.name).toBe('llama3');
  });
});

describe('suggestCasesWithAI', () => {
  it('merges, validates, and reports rejections', async () => {
    const provider: OpenAICompatProvider = new OpenAICompatProvider({
      fetchImpl: async () =>
        casesPayload([
          {
            tool: 'echo',
            title: 'valid case',
            args: { message: 'hi' },
            expectation: 'success',
            rationale: 'ok',
          },
          {
            tool: 'echo',
            title: 'missing required arg',
            args: {},
            expectation: 'success',
            rationale: 'invalid',
          },
          {
            tool: 'ghost',
            title: 'unknown tool',
            args: {},
            expectation: 'success',
            rationale: 'hallucinated',
          },
        ]),
    });
    const schemas = new Map([
      ['echo', echoTool],
      ['add', addTool],
    ]);
    const { cases, rejected, providerName } = await suggestCasesWithAI(analysis, provider, schemas);
    expect(cases).toHaveLength(1);
    expect(rejected).toHaveLength(2);
    expect(rejected[0]).toContain('missing required');
    expect(rejected[1]).toContain('unknown tool');
    expect(providerName).toBe(DEFAULT_AI_MODEL);
  });

  it('composes with mergeAndValidateCases for rules+AI', () => {
    // Sanity: mergeAndValidateCases is exported and usable with the schemas map.
    const schemas = new Map([['echo', echoTool]]);
    const { cases } = mergeAndValidateCases(
      [
        [
          {
            tool: 'echo',
            title: 'rule case',
            args: { message: undefined },
            expectation: 'error',
            rationale: 'required',
            source: 'rule:required',
          },
        ],
      ],
      schemas
    );
    expect(cases).toHaveLength(1);
  });

  it('writes human-readable cache files', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ai-cache-'));
    try {
      const provider = new OpenAICompatProvider({
        cacheDir: join(dir, 'cache'),
        model: 'm',
        fetchImpl: async () =>
          casesPayload([
            {
              tool: 'echo',
              title: 't',
              args: { message: 'x' },
              expectation: 'success',
              rationale: 'r',
            },
          ]),
      });
      await provider.suggestCases(analysis);
      const files = readdirSync(join(dir, 'cache')) as string[];
      expect(files.some((f) => f.startsWith('ai-cases-') && f.endsWith('.json'))).toBe(true);
      const raw = readFileSync(join(dir, 'cache', files[0]), 'utf-8');
      expect(JSON.parse(raw)).toMatchObject({ model: 'm' });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('parseJsonLoose', () => {
  // Re-import for direct unit testing.
  const { parseJsonLoose } = require('../ai/provider.js') as typeof import('../ai/provider.js');

  it('parses a bare JSON object', () => {
    expect(parseJsonLoose('{"cases":[{"tool":"t","args":{}}]}')).toEqual({
      cases: [{ tool: 't', args: {} }],
    });
  });

  it('parses JSON inside a ```json fence', () => {
    expect(parseJsonLoose('Here you go:\n```json\n{"cases":[]}\n```\nThanks!')).toEqual({
      cases: [],
    });
  });

  it('parses JSON inside a bare ``` fence', () => {
    expect(parseJsonLoose('```\n{"cases":[{"a":1}]}\n```')).toEqual({ cases: [{ a: 1 }] });
  });

  it('handles nested braces inside string values', () => {
    // The string value contains a `{` and `}` that should NOT be mistaken
    // for structural braces.
    const content = 'prefix {"cases":[{"tool":"x","args":{"json":"{not closed}"}}]} suffix';
    expect(parseJsonLoose(content)).toEqual({
      cases: [{ tool: 'x', args: { json: '{not closed}' } }],
    });
  });

  it('chooses the longest valid object when multiple are present', () => {
    const content = '{"a":1} prose {"cases":[{"tool":"t","args":{}}]} more prose';
    expect(parseJsonLoose(content)).toEqual({ cases: [{ tool: 't', args: {} }] });
  });

  it('returns null when no JSON object is present', () => {
    expect(parseJsonLoose('no json here, just text')).toBeNull();
  });

  it('returns null for empty or non-string input', () => {
    expect(parseJsonLoose('')).toBeNull();
    expect(parseJsonLoose(null as unknown as string)).toBeNull();
  });
});

describe('response_format auto-fallback', () => {
  function makeProviderWithFailingFirstThenOk(): {
    provider: OpenAICompatProvider;
    requests: Array<{ url: string; body: string }>;
  } {
    const requests: Array<{ url: string; body: string }> = [];
    let calls = 0;
    const mock: FetchMock = async (url, init) => {
      const body = init?.body ? String(init.body) : '';
      requests.push({ url: String(url), body });
      calls++;
      if (calls === 1) {
        // First call: server rejects response_format.
        return new Response(JSON.stringify({ error: 'response_format is not supported' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"cases":[]}' } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };
    const provider = new OpenAICompatProvider({ apiKey: 'k', fetchImpl: mock, cacheDir: null });
    return { provider, requests };
  }

  it('retries without response_format when the gateway rejects it', async () => {
    const { provider, requests } = makeProviderWithFailingFirstThenOk();
    const result = await provider.suggestCases(analysis);
    expect(result).toEqual([]);
    expect(requests).toHaveLength(2);
    expect(requests[0].body).toContain('response_format');
    expect(requests[1].body).not.toContain('response_format');
  });

  it('skips response_format entirely when strictJson is false', async () => {
    const requests: string[] = [];
    const mock: FetchMock = async (_url, init) => {
      requests.push(String(init?.body ?? ''));
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"cases":[]}' } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };
    const provider = new OpenAICompatProvider({
      apiKey: 'k',
      fetchImpl: mock,
      strictJson: false,
      cacheDir: null, // avoid contamination from other tests' cache
    });
    await provider.suggestCases(analysis);
    expect(requests).toHaveLength(1);
    expect(requests[0]).not.toContain('response_format');
  });
});

describe('cache invalidation', () => {
  it('honours cacheMaxAgeMs by re-fetching stale entries', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-tester-cache-'));
    try {
      let calls = 0;
      const mock: FetchMock = async () => {
        calls++;
        return new Response(
          JSON.stringify({ choices: [{ message: { content: '{"cases":[]}' } }] }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      };
      const provider = new OpenAICompatProvider({
        apiKey: 'k',
        cacheDir: dir,
        cacheMaxAgeMs: 1, // anything older than 1ms is stale
        fetchImpl: mock,
      });
      await provider.suggestCases(analysis);
      // Sleep a bit so mtime is older than 1ms from the next call.
      await new Promise((r) => setTimeout(r, 10));
      await provider.suggestCases(analysis);
      // Second call should have re-fetched because the first cache entry is
      // older than cacheMaxAgeMs.
      expect(calls).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('shares cache entries across requests with identical tool sets and serverLabel', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-tester-cache-'));
    try {
      let calls = 0;
      const mock: FetchMock = async () => {
        calls++;
        return new Response(
          JSON.stringify({ choices: [{ message: { content: '{"cases":[]}' } }] }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      };
      const provider = new OpenAICompatProvider({ apiKey: 'k', cacheDir: dir, fetchImpl: mock });
      const a: ServerAnalysis = { serverLabel: 'svc', tools: [{ name: 't', inputSchema: {} }] };
      await provider.suggestCases(a);
      await provider.suggestCases(a); // second call should hit cache
      expect(calls).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

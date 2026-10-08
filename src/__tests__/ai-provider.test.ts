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
import type { OpenAICompatOptions } from '../ai/provider.js';
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

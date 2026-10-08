# AI-Assisted Test Generation

`mcp-tester` can derive test cases for your MCP server's tools in three ways:

| Mode | Flag | What it does | Needs network? |
|------|------|--------------|:---:|
| `static` | *(default)* | One happy-path call per tool | No |
| `edge` | `--edge-cases` | Deterministic boundary/invalid cases from JSON Schema rules | No |
| `ai` | `--ai-generate` | Edge cases **plus** AI-suggested cases, validated against the real schemas | Yes (or a local model) |

**AI never writes test code.** The model only proposes *structured test-case
data* (tool, arguments, expectation, rationale). A deterministic renderer emits
the final TypeScript, and every AI-proposed case is validated against the
tool's real input schema before it reaches your test file — hallucinated
arguments are dropped, not compiled.

## Quick start

### Deterministic edge cases (offline)

```bash
npx mcp-tester generate node ./server.js --edge-cases -o tests/generated.test.ts
```

The rules engine inspects each tool's `inputSchema` and emits cases per rule:

| Rule | Case | Expectation |
|------|------|-------------|
| `rule:required` | omit each required property | error |
| `rule:enum` | value outside the enum | error |
| `rule:min-length` | string one shorter than `minLength` | error |
| `rule:max-length` | string one longer than `maxLength` | observe |
| `rule:bounds` | number one below `minimum` / above `maximum` | error |
| `rule:type` | wrong JSON type per property | error |
| `rule:min-items` | array shorter than `minItems` | error |
| `rule:additional-properties` | unknown key when `additionalProperties: false` | error |

Expectations:

- **`error`** — the case asserts the call fails (`expect(isToolError(result)).toBe(true)`)
- **`observe`** — the case calls the tool and logs what happened (no hard
  assertion; for behavior that is legitimately server-defined)
- **`success`** — the case asserts the call succeeds

### AI-suggested cases

```bash
export MCP_TESTER_AI_API_KEY=sk-...
npx mcp-tester generate node ./server.js --ai-generate -o tests/generated.test.ts
```

`--ai-generate` includes everything `--edge-cases` produces, then asks the
model for additional interesting cases (unusual-but-valid inputs, realistic
payloads, combinations the rules can't reason about). Each suggestion is
checked against the tool's schema:

```text
mcp-tester: AI suggested cases: 5, kept after schema validation: 4 (dropped 1)
```

Works with any OpenAI-compatible endpoint:

| Provider | Base URL | Key needed |
|----------|----------|:---:|
| OpenAI | `https://api.openai.com/v1` (default) | yes |
| Ollama | `http://localhost:11434/v1` | no |
| LM Studio | `http://localhost:1234/v1` | no |
| vLLM | `http://host:8000/v1` | optional |

```bash
# Ollama — no API key required for localhost
npx mcp-tester generate node ./server.js \
  --ai-generate --ai-base-url http://localhost:11434/v1 --ai-model llama3
```

### Flags

| Flag | Meaning |
|------|---------|
| `--edge-cases` | Add deterministic schema-derived cases (offline) |
| `--ai-generate` | Edge cases + AI suggestions (implies `--edge-cases`) |
| `--ai-model <model>` | Model name (default `gpt-4o-mini` or `MCP_TESTER_AI_MODEL`) |
| `--ai-base-url <url>` | OpenAI-compatible base URL (default `MCP_TESTER_AI_BASE_URL`) |
| `--require-ai` | Fail instead of falling back when AI is unavailable |
| `--verify` | Dry-run every derived case against the live server first |

Passing both `--edge-cases` and `--ai-generate` is an error — `--ai-generate`
already includes the edge cases.

## Verifying derived cases against the real server

Derived expectations are *predictions*. `--verify` dry-runs every case against
the live server before writing the file:

```bash
npx mcp-tester generate node ./server.js --edge-cases --verify -o tests/generated.test.ts
```

- Cases whose prediction **holds** stay as normal assertions.
- Cases where the server **disagrees** (e.g. the rules predicted an error but
  the server returned success) are emitted as `it.skip` blocks with a comment:

```typescript
// rule:required — "message" is required; the server should reject its absence
// verify: expected error but server returned success — adjust manually
it.skip('rejects call without required "message"', async () => { ... });
```

That skip is a signal, not a failure: either the server is too permissive (fix
the server — many MCP servers forget to validate `missing required property`)
or the expectation was wrong (edit the test). Either way you've learned
something concrete about your server.

## Environment variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `MCP_TESTER_AI_API_KEY` | API key for hosted endpoints | *(none)* |
| `MCP_TESTER_AI_BASE_URL` | OpenAI-compatible endpoint | `https://api.openai.com/v1` |
| `MCP_TESTER_AI_MODEL` | Model name | `gpt-4o-mini` |

A base URL pointing at `localhost`/`127.0.0.1`/`[::1]` is considered
configured **without** an API key (local model servers don't need auth).

Without configuration, `--ai-generate` prints a warning and falls back to the
deterministic edge cases. With `--require-ai`, it fails instead.

## Library API

```typescript
import {
  generateTests,
  generateTestsFromClient,
  OpenAICompatProvider,
  suggestEdgeCasesForTools,
} from '@slbdn/mcp-tester';

// Deterministic cases only
await generateTests({ command: 'node', args: ['./server.js'], mode: 'edge' });

// AI-assisted with an explicit provider (no env vars needed)
await generateTests({
  command: 'node',
  args: ['./server.js'],
  mode: 'ai',
  provider: new OpenAICompatProvider({
    baseUrl: 'http://localhost:11434/v1',
    model: 'llama3',
  }),
});

// Rules only, no file emission — inspect the cases yourself
const cases = suggestEdgeCasesForTools(tools);
// → [{ tool, title, args, expectation, rationale, source }, ...]
```

A `GeneratedCase` is plain data — safe to log, diff, and version-control:

```typescript
interface GeneratedCase {
  tool: string;                                // tool name
  title: string;                               // human-readable test title
  args: Record<string, unknown>;               // arguments to send
  expectation: 'success' | 'error' | 'observe';
  rationale: string;                           // why this case exists
  source: `rule:${string}` | `ai:${string}`;   // provenance, e.g. rule:required
}
```

Custom providers implement one method:

```typescript
interface AIProvider {
  name: string;
  suggestCases(analysis: ServerAnalysis): Promise<GeneratedCase[]>;
}
```

`OpenAICompatProvider` accepts `fetchImpl` for testing and custom HTTP
behavior, caches responses in `.mcp-tester-cache/` (set `cacheDir: null` to
disable), truncates long tool descriptions, and batches at most 40 tools per
request.

## Safety and cost notes

- **No code from the model.** AI output is parsed as JSON case data and
  validated; it can never become executable test logic.
- **Prompt-injection resistant.** Tool descriptions are untrusted input; at
  worst they influence *which cases are proposed* — still schema-validated.
- **Caching.** Identical analyses hit the on-disk cache, so re-running
  generation is free and deterministic.
- **Deterministic fallback.** No key, no quota, no network — you still get the
  full rules engine.

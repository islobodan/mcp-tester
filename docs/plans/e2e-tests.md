# Implementation Plan — TODO #27: End-to-End Tests

Status: planned, not started · Owner: development · Estimated: 5–6 h (TODO says 4–6 h)
Companion docs: `AGENTS.md` (testing patterns), `docs/plans/release-automation.md` (P6 gate)

---

## 1. Context & goal

The suite today is deep on **units** (matchers, validation, generators) and broad on **capability
coverage** (`everything-server.test.ts` walks tools/resources/prompts/completion), but nothing
exercises a client through **realistic multi-step workflows against real spawned processes**:
crash mid-session, timeout under a hung tool, 20 parallel calls, 1 MB payloads, restart after
death. Those are exactly the scenarios the library exists for in CI/CD pipelines.

**Goal:** four E2E suites under `src/__tests__/e2e/` — lifecycle, error recovery, concurrency,
large payloads — against real server processes over stdio (plus one multi-client scenario over
HTTP), deterministic, no new runtime deps, wired into the existing `npm test` gate.

### Non-goals

- Distributed / multi-region testing (TODO #38), plugins (#37)
- Browser E2E — `npm run test:browser` already gates bundling
- Performance benchmarking — `src/__tests__/benchmarks.ts` exists (50 runs, separate script)
- Protocol-conformance breadth — `everything-server.test.ts` covers that; E2E covers *workflow depth*
- Changes to `MCPClient`'s public API (if a gap surfaces, e.g. exposing the child pid, file a
  follow-up TODO instead of widening scope)

---

## 2. Asset & gap analysis

### Already exists (reuse, don't rebuild)

| Asset | Used for |
|---|---|
| `examples/mock-server.js` (plain JS, spawnable) | baseline stdio target; `echo`, `add`, `delay`, `error_tool` |
| `@modelcontextprotocol/server-everything` (already a dep, spawned in tests today) | the one **multi-client over HTTP** scenario; port-poll readiness pattern (`http-transport.test.ts`) |
| `MCPClient` API | `start/stop`, `isConnected`, `isHealthy()`, `setNotificationHandlers`, per-call `retries`/`retryDelay`/`timeout`, `MCPTimeoutError`/`MCPServerError`/`MCPNotStartedError` |
| Jest wiring | `testMatch: ['**/__tests__/**/*.test.ts']` → files under `src/__tests__/e2e/` are **automatically** in `npm test` (and therefore in CI's matrix jobs and the release tool's P6 — no workflow edits needed); coverage excludes `src/__tests__/**`; `maxWorkers: 1` already serial |

### Missing (build)

- A **deterministic chaos/payload fixture server** — crash on demand, hang on demand,
  fail-once-then-ok, byte-exact large payloads, call accounting, pid reporting
- Tests for: restart cycle, post-crash behavior, timeout-then-continue, retry semantics,
  fan-out concurrency, interleaved long/short ops, multi-client (HTTP), 100 KB–1 MB payloads,
  unicode/depth round-trips, zombie-process proof

---

## 3. Design decisions

1. **One fixture server, not many.** A single `e2e-server.mjs` hosting every E2E tool, with
   behavior selected via env vars (`E2E_CRASH_ON_TOOL`, `E2E_HANG_ON_TOOL`, `E2E_FAIL_ONCE`).
   One file to maintain, one spawn per scenario, fully deterministic.
2. **Plain `.mjs`, TypeScript-free.** Spawn with `node` — no `tsx`, no compile step, ~200 ms cold
   start (SDK import). Precedent: `examples/mock-server.js`. Placement under
   `src/__tests__/e2e/fixtures/` keeps them out of coverage, out of `tsconfig` (which excludes
   `src/__tests__`), and out of the shipped package (verify in M5: `rm -rf dist && npm run build`
   → no `dist/__tests__`; the current `dist/__tests__` is stale pre-exclude output).
3. **E2E lives in the default `npm test`**, not a separate `test:e2e` gate. Single source of
   truth; CI matrix (Node 20/22), coverage job, and release P6 get it for free. Budget: the
   suites must add **≤ 120 s** wall time (measured in M5). If it blows the budget, the fallback
   is a separate `test:e2e` script added to P6's gate list — decision point, not a default.
4. **Determinism over realism.** No random failure rates (the mock fixture's `failureRate` is
   off-limits). Chaos is env-selected and one-shot. Time assertions use generous bounds
   (e.g. "completed in < 5 s" for a 20 × parallel fan-out), never exact durations. Three
   consecutive green full runs is the stability bar (M5).
5. **No public-API additions.** The zombie check works via the fixture writing its own pid to a
   file (`E2E_PID_FILE`); the test polls `process.kill(pid, 0)` after `stop()`.

---

## 4. Fixture: `src/__tests__/e2e/fixtures/e2e-server.mjs`

Built on the SDK's `McpServer` (same API surface as `examples/mock-server.js`).

**Env switches** (read once at startup; all optional):

| Env | Effect |
|---|---|
| `E2E_CRASH_ON_TOOL=<name>` | `process.exit(70)` when that tool is called (one-shot semantics irrelevant — process dies) |
| `E2E_HANG_ON_TOOL=<name>` | that tool never responds (client timeout is the scenario) |
| `E2E_FAIL_ONCE=<name>` | first call to that tool returns a JSON-RPC error; later calls succeed |
| `E2E_PID_FILE=<path>` | write `process.pid` at startup |
| `E2E_TOKEN=<secret>` | returned by `env_dump` — proves env passthrough through `start({ env })` |

**Tool inventory** (all input-validated server-side; counter is in-memory per process):

| Tool | Purpose |
|---|---|
| `echo { message }` | pairing key for concurrency: echoes the exact message back |
| `echo_large { size }` | returns a deterministic byte string of `size` chars (seeded, so tests compare hashes) |
| `sum_large { numbers[] }` | server-side sum of up to 10 k elements — proves large *structured* args parse |
| `deep_nest { depth }` | returns an object nested `depth` deep (100) — serialization robustness |
| `counter_increment { amount? }` / `counter_get` / `counter_reset` | stateful lifecycle: increments emit `notifications/message` |
| `todo_add` / `todo_list` / `todo_complete` | second stateful surface (mirrors `stateful-server.ts`) |
| `env_dump` | returns `E2E_TOKEN` — env passthrough proof |
| `call_stats` | per-tool call counts — retry accounting ("fail_once then ok" ⇒ 2 calls) |
| `pid_dump` | own pid — cross-check with `E2E_PID_FILE` |
| `crash_now` / `hang_now` / `fail_once_tool` | targets for the env switches (so a single server can be reused in mixed scenarios) |
| `unicode_echo { message }` | emoji / CJK / combining-marks round-trip |

---

## 5. Suites & scenarios

Shared helpers (`src/__tests__/e2e/helpers.ts`): `startE2EClient(env?)` (wraps `new MCPClient` +
`start` with the fixture), `expectEventually`, `waitForPidGone(pid, ms)`, per-file
`jest.setTimeout(60_000)` (spawns on CI runners are slow; the repo default is 30 s).

### 5.1 `lifecycle.e2e.test.ts` (~8 tests)

- start → initialize → `listTools` ≥ 12 → `callTool echo` → `stop` → `isConnected() === false`
- **restart cycle**: client A increments counter to 5, stops; client B (new process) sees `counter_get === 0` — fresh-process state isolation
- `stop()` is safe to call twice (second is a no-op, no throw)
- **zombie proof**: fixture writes pidfile → `stop()` → `kill(pid, 0)` fails within 5 s (retried — process teardown is async)
- env passthrough: `start({ env: { E2E_TOKEN: 'xyz' } })` → `env_dump` returns it
- notifications: `setNotificationHandlers` + `counter_increment` → `notifications/message` received with matching text
- `isHealthy()` true while connected; false after `stop`
- capabilities discovery: tools/resources/prompts lists are stable across two `list*` calls (no drift)

### 5.2 `recovery.e2e.test.ts` (~7 tests)

- **crash mid-session**: `E2E_CRASH_ON_TOOL=crash_now` → calling it kills the server → next `callTool` rejects (connection closed), `isHealthy()` false
- `stop()` after server death is clean (no throw, no hang — the cleanup path)
- **recovery**: new client + `start` against the same command → counter behavior normal (the workflow a CI pipeline actually needs)
- **timeout then continue**: `E2E_HANG_ON_TOOL=hang_now`, `callTool { timeout: 1500 }` → `MCPTimeoutError` with `.timeout === 1500` and `.operation`; server still alive → `echo` works immediately after
- **retry semantics**: `E2E_FAIL_ONCE=fail_once_tool`, `callTool { retries: 1, retryDelay: 50 }` → succeeds; `call_stats` shows exactly 2 calls to that tool
- same call with `retries: 0` → rejects; `call_stats` shows 1 call
- `error_tool`-style server error → `MCPServerError` with `serverCode` preserved

### 5.3 `concurrency.e2e.test.ts` (~6 tests)

- **fan-out**: 20 parallel `echo` calls, each with a unique id embedded in the message → all resolve, every result paired to its own request (echo text matches per-promise)
- **interleaving**: fire `delay(2000)` (use `hang`-free slow tool via a `slow_echo` add? — use `echo` after `counter` ops; spec: one in-flight `echo_large { size: 500_000 }` + 10 quick `echo` calls → the quick ones complete before the big one (assert completion order, not wall clock)
- **counter integrity under fire**: 25 concurrent `counter_increment { amount: 1 }` → `counter_get === 25` (server-side serialization proof over stdio)
- two clients, two processes, interleaved writes → each sees only its own process's counter (process isolation)
- **two clients over one HTTP server** (spawn `server-everything --http`, port-poll like `http-transport.test.ts`; skip-if-binary-missing guard like existing suites): both clients call tools concurrently, results isolated
- `Promise.allSettled` on a batch where one call has invalid args → others unaffected, exactly one rejection

### 5.4 `payloads.e2e.test.ts` (~6 tests)

- 100 KB arg → echoed back byte-identical (length + hash)
- 1 MB result (`echo_large { size: 1_000_000 }`) → intact (hash), completes < 10 s
- 10 k-element number array → `sum_large` exact sum (large *structured* input, not just strings)
- 500 sequential small `echo` calls → all correct, total < 15 s (no degradation/leak signal)
- unicode round-trip: emoji, CJK, combining marks, `\n`/`\t` escapes
- `deep_nest { depth: 100 }` → structure survives at full depth

**Total: ~27 tests, target ≤ 120 s added wall time.**

---

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| CI-runner slowness → flaky spawns | 60 s per-file timeouts; readiness = `start()` itself (it awaits initialize); generous time bounds; stability bar = 3 consecutive green runs (M5) |
| Zombie processes poison the runner | `afterEach` stop-if-connected; fixtures exit on stdin close + SIGTERM handler; lifecycle test *proves* teardown via pidfile |
| Suite bloat slows every release (P6 runs it) | ≤ 120 s budget measured in M5; fallback = separate `test:e2e` gate (decision point §3.3) |
| Fixtures accidentally shipped/compiled | `.mjs` under `src/__tests__/` — excluded by tsconfig & coverage; M5 verifies clean-build `dist` has no `__tests__` |
| `server-everything` binary unavailable (offline CI) | skip-guard pattern already used by `everything-server.test.ts` (`serverAvailable` flag) |
| SDK server-API drift | fixture uses the same high-level `McpServer` API as shipped examples; bump is a compile of examples, not new API surface |

---

## 7. Acceptance criteria

1. Four suites in `src/__tests__/e2e/`, ≥ 24 tests, green locally and in CI on **both** Node 20 and 22
2. Added wall time ≤ 120 s (record the measured number in the wrap-up)
3. Zero new runtime deps; fixture is plain `.mjs` on the existing SDK
4. Deterministic: 3 consecutive full-suite runs green, zero retries needed
5. Zombie proof passes (pidfile process gone ≤ 5 s after `stop()`)
6. Coverage thresholds unaffected (fixtures excluded; E2E only adds covered lines)
7. Release tool P6 green end-to-end (`npm test` now includes E2E)
8. Docs updated: AGENTS.md (file list + an "E2E" pattern section), README testing section, CHANGELOG `[Unreleased]`, TODO #27 ticked with measured-time note

---

## 8. Milestones

| # | Deliverable | Est. |
|---|---|---|
| M1 | `e2e-server.mjs` fixture + helpers + one smoke lifecycle test passing; clean-build check (`dist` has no `__tests__`) | 1 h |
| M2 | `lifecycle.e2e.test.ts` complete | 1–1.5 h |
| M3 | `recovery.e2e.test.ts` complete | 1–1.5 h |
| M4 | `concurrency.e2e.test.ts` + `payloads.e2e.test.ts` complete | 1–1.5 h |
| M5 | Timing measurement, 3× stability runs, docs sweep (AGENTS/README/CHANGELOG/TODO), full gates incl. release dry-run | 0.5–1 h |

Ship as **1.8.0** (Added: test infrastructure, no runtime changes — minor by the repo's own
convention of shipping features on minors) via `npm run release -- minor`.

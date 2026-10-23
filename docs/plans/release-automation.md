# Release Automation — Implementation Plan (TODO #30)

| | |
|---|---|
| **Status** | Ready for implementation |
| **Supersedes** | Original TODO #30 task list (`semantic-release`, `conventional-changelog`) — see Non-Goals |
| **Estimated effort** | 3–5 h (M1–M4) + one real release as the final checkpoint (M5) |
| **Depends on** | Nothing. Built on top of the current `release.yml` / `test.yml` gates as-is |
| **Related commits** | `24fee8d` (verify-job propagation retry), `e38d5a6` (1.6.0, the release this plan's checks are derived from) |

---

## 1. Background — why this exists

The publish pipeline itself is already automated (`.github/workflows/release.yml`: tag push → build → lint → format → test → coverage → audit → publish → GitHub release → verify). What is **not** automated is everything *before* the tag. Every failure below happened **after** the tag was pushed, where a failure costs a public red workflow run and an extra patch release:

| Incident | Root cause | Cost | The check that catches it locally |
|---|---|---|---|
| **v1.5.0** publish failed | `npm audit --audit-level=high` gate blocked (SDK OAuth + proxy-addr advisories) | failed run + 1.5.1 | P5 audit gate |
| **v1.5.1** publish failed | `npm audit fix` run under npm 11 dropped `@emnapi/*` entries from the lockfile; CI's npm 10 `npm ci` failed with `EUSAGE Missing: @emnapi/core` | failed run + entire 1.5.2 release | P4 npm@10 ci dry-run |
| **v1.6.0** (would have failed) | critical `handlebars` advisory + same npm 11 lockfile trap hit a second time | avoided only by manual diligence | P4 + P5 |
| **v1.5.5** (folded) | release cut with an empty `[Unreleased]` section; tag existed only locally; two tag pushes would have raced two concurrent release runs for npm `latest` | history surgery: rebase + conflict + tag deletion | P8 changelog gate + P3 dangling-tag check |
| **verify job red** | npm registry propagation lag (CDN negative caching on a just-published version) | manual re-run of the job | **already fixed** in `24fee8d` |

**Post-publish flake note:** the propagation race is fixed in the workflow (`24fee8d`); a local pre-flight can never cover post-publish behavior. It is listed here only to delimit scope.

Three of the last four releases had a publish-blocking issue that a ~2-minute local pre-flight would have caught.

---

## 2. Goals & Non-Goals

### Goals
1. One command performs: **pre-flight → version bump → CHANGELOG promotion → commit → tag**, producing a ready-to-push state.
2. The pre-flight is a **strict superset of what `release.yml` will run** (so a passing pre-flight ≈ green publish), plus checks CI cannot do (dangling tags, registry state).
3. Deterministic gates, fail-fast, actionable messages. No flags to bypass gates.
4. Zero new runtime dependencies. No changes to `release.yml`.
5. Tested and CI-wired (unit tests for all pure logic + regression tests named after the incidents above).

### Non-Goals (deliberate)
- **`semantic-release`** — it auto-derives versions from commit messages and rewrites history, which conflicts with this repo's deliberate `chore: release` commits and tag discipline. Publishing already works; only local prep is missing.
- **`conventional-changelog`** — the CHANGELOG is hand-curated (Keep a Changelog format) with richer entries than commit-derived bullets. Keep it that way; the script only *promotes* the `[Unreleased]` section verbatim.
- **Auto-push / auto-publish from the local machine** — pushing stays manual (single point of human control, avoids the two-tags-racing-`latest` failure mode).
- **`--force` / skip-gate flags** — gates exist because each one maps to a real incident. If a gate is ever wrong, fix the gate.
- **CI dry-run of the release script** — would double CI runtime for little value (CI already runs the same gates). Possible future work.

---

## 3. Current state (what the implementer must know)

Relevant files and their roles:

| File | Role in this plan |
|---|---|
| `.github/workflows/release.yml` | Publish pipeline. Triggered by tag push `v*.*.*`. Runs on **Node 20 / npm 10**. **Not modified.** Its gates define the pre-flight list (P5–P6). |
| `.github/workflows/test.yml` | PR/push matrix. Gets one new step: `npm run test:release` (§7). |
| `package.json` | `release:patch/minor/major/prerelease/commit` scripts (§6.5 — replaced), `test:release` script (added). |
| `package-lock.json` | Version appears on **two lines**: top-level `"version"` and `packages[""].version`. Bumped by direct edit (§6.4). |
| `CHANGELOG.md` | Keep a Changelog format. Sections: `## [Unreleased]` (always present, may be empty) then `## [x.y.z] - YYYY-MM-DD` newest-first. |
| `docs/releases.md` | Release guide; documents the old `npm run release:*` + manual commit/tag flow. Rewritten in M4. |
| `scripts/*.mjs` | Precedent for Node-only tooling scripts (`smoke-test-package.mjs`, `check-browser-bundle.mjs`). `.mjs` outside `src/` **may** use `import.meta`. |

Repo conventions that apply (from `AGENTS.md`):
- Conventional commits; release commit message is exactly `chore: release <version>`.
- **Lightweight** tags (`git tag vX.Y.Z`, no `-a`), placed on the release commit.
- Push pattern: `git push origin main --tags`, and **never push two new release tags at once**.
- `files: ["docs/*.md", …]` — npm globs don't cross `/`, so `docs/plans/*.md` are **not** shipped in the tarball. This plan doc is internal.
- Pre-commit hook (Husky + lint-staged) may print "could not find any staged files matching configured tasks" for release commits — expected noise, do not use `--no-verify`.
- **npm 10 vs npm 11 lockfile rule:** any lock-touching operation must run under npm 10 (`npx -y npm@10 …`). npm 11's `audit fix` has twice produced lockfiles npm 10 cannot install (`EUSAGE Missing: @emnapi/*`).

---

## 4. Solution overview

```
npm run release -- <patch|minor|major|prerelease> [--dry-run]
        │
        ▼
┌── Pre-flight (read-only, fail-fast) ──────────────────────────────┐
│ P1 clean working tree          P5 npm@10 audit --audit-level=high │
│ P2 in sync with origin/main    P6 local gates (build/lint/format/ │
│ P3 no dangling local tags         tests/coverage/browser/package)│
│ P4 npm@10 ci --dry-run (temp dir)                                  │
│ P7 version sanity (registry + tags + semver order)                │
│ P8 CHANGELOG: [Unreleased] exists, non-empty, version unused      │
└────────────────────────────────────────────────────────────────────┘
        │ all green
        ▼
   bump package.json + both package-lock.json version lines   \
   promote CHANGELOG [Unreleased] → [x.y.z] - YYYY-MM-DD      |  atomic-ish; each write
   verify git diff touches EXACTLY the expected lines         /   is diff-checked (§6.4)
        │
        ▼
   git commit -m "chore: release x.y.z"   (hooks run normally)
        │
        ▼
   git tag vx.y.z   (lightweight)
        │
        ▼
   print: git push origin main --tags  +  "release.yml will publish"
```

Nothing is pushed, nothing is published, nothing is deleted. The script's output state is identical to what 1.6.0's `e38d5a6` looks like today.

---

## 5. Interface specification

### 5.1 CLI

```
npm run release -- <bump-type> [--dry-run]
```

- `<bump-type>`: `patch` | `minor` | `major` | `prerelease` (required, positional).
- `--dry-run`: run **all** pre-flight checks (they are read-only) and print the planned version, date, and CHANGELOG promotion preview; then stop. Write/commit/tag nothing.
- Exit codes: `0` = success (or clean dry-run), `1` = pre-flight or step failure (message printed), `2` = usage error (bad args).
- Output style: one line per check, `✓`/`❌` prefix, `❌` lines end with the failing command to re-run manually. Follow the log style of `scripts/smoke-test-package.mjs`.

### 5.2 Pre-flight checks (exact spec)

All are executed in listed order; first failure aborts.

**P1 — Clean working tree**
```bash
git status --porcelain
```
Pass: empty output. Fail: list the dirty files, tell the user to commit/stash first.

**P2 — In sync with `origin/main`**
```bash
git fetch origin main --tags --quiet
git rev-list --count origin/main..HEAD   # must be 0
git rev-list --count HEAD..origin/main   # must be 0
```
Rationale: releases must be cut on pushed history. (The v1.5.5 fold existed because the tag lived on unpushed commits.)

**P3 — No dangling local tags**
```bash
git ls-remote --tags origin              # remote refs
git tag --list 'v*'                      # local refs (compare resolved SHAs)
```
Pass: every local `v*` tag resolves to a SHA present in the remote list. Fail: print the local-only tags with "delete with `git tag -d <tag>` or push them deliberately".

**P4 — Lockfile installable by CI's npm** (the emnapi trap, hit twice)
```bash
tmpdir=$(mktemp -d)
cp package.json package-lock.json "$tmpdir"
(cd "$tmpdir" && npx -y npm@10 ci --dry-run --ignore-scripts)   # exit 0 required
```
Run in a temp dir so the real `node_modules` is never touched (dry-run in the repo dir is unsafe with npm < 11 quirks; established practice in this repo).

**P5 — Audit gate** (what `release.yml` enforces)
```bash
npx -y npm@10 audit --audit-level=high    # exit 0 required
```

**P6 — Local gates** (superset of `release.yml` + `test.yml`), cheapest first:
```bash
npm run build
npm run lint
npm run format:check
npm run test:browser
npm test
npm run test:coverage
npm run test:package
```
Stream output (inherit stdio) so the developer sees the real failure. Total ≈ 6–8 min; acceptable — this replaces a potential failed publish + extra patch release.

**P7 — Version sanity**
```bash
P=$(npm view @slbdn/mcp-tester version)          # published latest (network required)
V=$(node -p "require('./package.json').version")
N = semverInc(V, <bump-type>)                    # pure function from release-lib (§6)
```
Pass requires all of:
- `N` **strictly greater** than `P` (pure `compareSemver`, handles prerelease ordering).
- No local tag `v{N}`: `git rev-parse -q --verify "v${N}"` must fail.
- Not on the registry: `npm view @slbdn/mcp-tester@${N} version` must fail (E404).
- If `V !== P`: print a warning explaining the tree is behind/ahead of the registry (post-fold state) but continue — `N > P` is the real invariant.

**P8 — CHANGELOG gate** (the anti-v1.5.5 guard)
Read `CHANGELOG.md`, then require:
- a `## [Unreleased]` heading exists;
- its block (lines between that heading and the next `## ` heading) contains **at least one** non-empty content line (`- `/`* ` bullet or a `### ` subsection heading). Empty → **refuse** with "nothing to release: `[Unreleased]` is empty — either add entries or skip this release";
- no section `## [N]` for the would-be version `N` already exists.

### 5.3 Release steps (after pre-flight passes)

**R1 — Compute release date**: `new Date().toISOString().slice(0, 10)` (UTC, matches existing entries).

**R2 — Bump versions by direct edit** (do **not** run `npm version` — it rewrites the lockfile through npm's own machinery and has historically produced churn):
- `package.json`: the top-level `"version": "…"` value → `N`.
- `package-lock.json`: exactly two values → `N`: top-level `version` and `packages[""].version`. Implement as a targeted text replacement anchored on the package name, or parse→mutate→`JSON.stringify(obj, null, 2) + '\n'` (the lock is written with 2-space indent; verify with git).
- **Self-check after write**: `git diff --numstat` must show exactly `package.json` 1/1 and `package-lock.json` 2/2 and nothing else. Any larger diff → `git reset -q HEAD -- <files>` + `git checkout -- <files>`, abort with the diff shown. (The `git reset` matters: after a failed commit the files are already *staged*, and a bare `git checkout --` restores from the index — it would keep the bumped content.) (This guarantees the "version-only diff" property that 1.6.0 was hand-verified for.)

**R3 — Promote CHANGELOG**: replace the `## [Unreleased]` heading with
```markdown
## [Unreleased]

## [N] - YYYY-MM-DD
```
preserving the block content byte-for-byte beneath the new version heading. (Keep a fresh empty `[Unreleased]` heading on top — the file's existing convention.)

**R4 — Commit** exactly the three files:
```bash
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore: release N"
```
Pre-commit hook runs; lint-staged noise is expected. Never `--no-verify`.

**R5 — Tag** (lightweight, on the release commit): `git tag "v${N}"`.

**R6 — Print handoff**:
```
✓ Release N prepared.
Next:  git push origin main --tags
release.yml will: verify tag ↔ version, npm ci, audit, build, lint, format, test,
coverage, publish, create the GitHub release, then verify the install
(now with registry-propagation retries).
```

### 5.4 Resume behavior (interrupted runs)

If the process dies between R4 and R5, a re-run with the same `<bump-type>`… note `V` will already be `N`, so `bump(N, patch)` yields the wrong target. Therefore, **before** P7's bump computation, detect the resume state:
- `package.json` version `V`,
- `CHANGELOG.md` already contains `## [V]`,
- HEAD commit subject is exactly `chore: release V`,
- and tag `v{V}` is missing
→ resume mode: run the pre-flight and R-steps as refined in the implementation note below — detection itself is a cheap local shape check, and only R5 (the tag) is performed.

**Implementation note (hardened during the self-review).** The detection itself is a cheap *local* shape check (`isResumeState()` in `release-lib.mjs` — no network, no gates); the heavy verification still runs in resume mode:
- The full pre-flight runs, **except** P2 (HEAD is necessarily ahead of `origin/main` — the release commit is about to be pushed) and P8 (the changelog is already promoted — that *is* the resume signal).
- `V > P` on the registry is verified in P7, which runs in resume mode with the bump math disabled.
- R2–R4 are skipped: `promoteChangelog()` is **not idempotent** and would insert a duplicate `## [V]` heading. The resume path only creates the tag. Detection prints `resuming interrupted run for v{V} — bump and commit already in place`; the R-step prints `Completing interrupted release {V} — commit in place, tag missing…`.

### 5.5 Refusals are the feature

Every gate prints an actionable message. Examples (write these verbatim):
```
❌ P8: nothing to release — [Unreleased] is empty.
    Add entries to CHANGELOG.md, or skip this release entirely.
❌ P4: the lockfile is not installable by npm 10 (CI's npm):
    <npm output tail>
    Fix lockfile issues with: npx -y npm@10 install / audit fix (NEVER plain npm@11 audit fix).
❌ P3: local tags not on origin: v1.5.5
    Two tag pushes race two release.yml runs for npm 'latest'. Push them or delete with: git tag -d v1.5.5
```

---

## 6. Code structure

New files only (plus §6.5 package.json edits + §7 CI step). No changes to `src/` — the release tool is not library code and must not ship in `dist/`.

### 6.1 `scripts/release-lib.mjs` — pure functions, no I/O, fully unit-tested

```js
/** @returns {string} */ semverInc(version, bumpType)          // patch|minor|major|prerelease
/** @returns {number} */ compareSemver(a, b)                    // -1|0|1, prerelease-aware
/** @returns {{ exists: boolean, nonEmpty: boolean, alreadyReleased: boolean }} */
checkChangelog(text, version)
/** @returns {string} */ promoteChangelog(text, version, date)  // §5.3 R3
/** @returns {{ pkg: string, lock: string }} */
applyVersionEdits(pkgText, lockText, currentVersion, newVersion)
/** @returns {string|null} */ parseCommitSubjectLine(...)        // if needed for resume detection
```
- `semverInc`/`compareSemver` are small hand-rolled implementations (no new deps; prerelease semver ordering per semver.org §11: `1.6.0-beta.1 < 1.6.0`, numeric identifiers compare numerically).
- `applyVersionEdits` anchors replacements so a bare version string can never be replaced somewhere it shouldn't be (e.g., a dependency range).

### 6.2 `scripts/release.mjs` — CLI orchestrator (~150 lines)

- Arg parsing (no dep; yargs-like handling of 2 flags by hand).
- `run(cmd)` helper: `spawnSync` with `shell: true`, `stdio: 'inherit'`, returns status; on failure of a numbered check, print the `❌` block and `process.exit(1)`.
- Check registry `P` once, cache for P7 + resume logic.
- No `import.meta` needed, but allowed here (outside `src/`).

### 6.3 `scripts/release.test.mjs` — unit tests via built-in `node:test`

Run with `node --test scripts/release.test.mjs` (Node ≥ 20 has stable `node:test`; zero new deps; consistent with the repo's script-based tooling). Cover at minimum:

| Test | Incident it regression-guards |
|---|---|
| `semverInc('1.6.0','patch') → '1.6.1'`; minor/major; `prerelease` from `1.6.0` → `1.6.1-beta.0` and from `1.6.1-beta.0` → `1.6.1-beta.1` | — |
| `compareSemver('1.6.0-beta.1','1.6.0') < 0`, `('1.6.10','1.6.9') > 0` (numeric identifiers) | version-order refusals |
| `checkChangelog` with empty `[Unreleased]` → `nonEmpty: false` | **v1.5.5 fold** |
| `checkChangelog` missing `[Unreleased]` heading → `exists: false` | malformed CHANGELOG |
| `checkChangelog` where `## [1.6.1]` already exists → `alreadyReleased: true` | double release |
| `promoteChangelog` preserves block content byte-for-byte, keeps fresh empty `[Unreleased]`, correct date heading | 1.6.0 format |
| `applyVersionEdits` on fixture pkg+lock texts: exactly the 3 version lines change; a lock containing a dep whose range mentions the old version string is left untouched | version-only diff property |
| `applyVersionEdits` on a lock where `packages[""].version` is absent → throws | corrupt lock surfaced early |

### 6.4 package.json script changes

```jsonc
"release": "node scripts/release.mjs",
"release:patch":     "node scripts/release.mjs patch",
"release:minor":     "node scripts/release.mjs minor",
"release:major":     "node scripts/release.mjs major",
"release:prerelease": "node scripts/release.mjs prerelease",
"test:release": "node --test scripts/release.test.mjs"
```
Delete `release:commit` (subsumed — the script commits). The `release:*` aliases keep muscle memory working while `npm run release -- minor` is the canonical form.

### 6.5 Documentation updates (M4)

- `docs/releases.md`: rewrite "Release Process" around `npm run release -- <bump>`; keep the old manual steps as "Manual fallback (discouraged)"; document the pre-flight list and why each gate exists (link the incident table above).
- `README.md` → Development/Contributing blurb: one paragraph.
- `AGENTS.md`: update "Creating a Release" + Key Files (`scripts/release.mjs`), add the npm@10 rule pointer.
- `CHANGELOG.md`: `[Unreleased]` → Added: release script.
- `TODO.md`: tick #30 subtasks; move Progress Tracking.

---

## 7. CI wiring

`test.yml`, in the existing `package` job, after `test:package`:
```yaml
      - name: Release script tests
        run: npm run test:release
```
(Not in the matrix `test` job — version-independent, single run is enough. No `release.yml` changes.)

---

## 8. Acceptance criteria

Demonstrate each in a **scratch clone** (or dry-run) before calling it done:

1. **Anti-1.5.5**: with an empty `[Unreleased]`, `npm run release -- patch` exits 1 and leaves the tree byte-identical (`git status --porcelain` empty).
2. **Anti-fold**: with local-only commits or a local-only `v*` tag, exits 1 with the remediation message.
3. **Anti-1.5.1**: corrupt the lock in a scratch copy (delete an `@emnapi/*` entry), P4 exits 1 with npm's `EUSAGE` in the message.
4. **Anti-1.5.0**: scratch copy with a high advisory (`npm audit --json` gate) → P5 exits 1. (If no live advisory exists, temporarily lower the flag in a scratch copy to prove the plumbing.)
5. **Happy path**: on a tree with real `[Unreleased]` content, produces commit `chore: release N` whose diff is exactly `package.json` (1 line), `package-lock.json` (2 lines), `CHANGELOG.md` (heading lines only), plus lightweight tag `vN`; prints the push command; **nothing pushed**.
6. **Dry-run**: full pre-flight runs, prints planned `N`, date, and CHANGELOG preview; zero writes (`git status --porcelain` empty after).
7. **Resume**: `git reset --soft HEAD~1` + `git commit` a fake `chore: release N` state… (simpler: hand-craft the state: bump files + promote changelog + commit, delete tag) → re-run only creates the missing tag.
8. `npm run test:release` green locally and in CI; `npm run build && npm run lint && npm run format:check` still clean (repo hygiene for the new files — note: ESLint targets `src/**/*.ts` only, so `.mjs` files need no lint config; keep them prettier-formatted anyway).
9. **M5 (final)**: the **next real release** (likely 1.6.1 or 1.7.0) is cut end-to-end with the script and publishes green on the first workflow run.

---

## 9. Implementation milestones

| # | Deliverable | Est. |
|---|---|---|
| M1 | `release-lib.mjs` + full unit tests (§6.1, §6.3) — all incident-named cases green | 1–1.5 h |
| M2 | `release.mjs` pre-flight P1–P8 with verbatim refusal messages | 1–1.5 h |
| M3 | Release steps R1–R6 + diff self-check + resume + `--dry-run` | 0.5–1 h |
| M4 | package.json scripts, CI step, docs (releases.md/README/AGENTS/CHANGELOG/TODO) | 0.5–1 h |
| M5 | Acceptance run-through in a scratch clone, then cut the next real release with it | (release day) |

Commit plan (conventional): `feat(tooling): add release pre-flight and cut script` — or split M1–M3 / M4 into `feat` + `docs` commits.

---

## 10. Appendix — hard-won rules the implementation must respect

1. **Never let npm 11 write the lockfile.** `npx -y npm@10 …` for anything that touches `package-lock.json` (audit fix included). The emnapi trap has fired twice.
2. **Direct version edits + diff self-check** instead of `npm version`. `npm version` is allowed for nothing here; the two-line lock edit is verified with `git diff --numstat` before committing.
3. **Lightweight tags**, `chore: release` commits, push `main --tags`, **one new tag per push** (two tag pushes race `release.yml` runs for npm `latest`).
4. **No `import.meta` in `src/`** (ts-jest TS1343); `.mjs` under `scripts/` is exempt.
5. **lint-staged** only matches `src/**/*.ts` + `package.json`; its "no matching files" output on release commits is normal.
6. `git reset --soft` stages **everything** since the upstream commit — never use it in the script; plain targeted `git add` only.
7. The `verify` job already retries registry propagation (`24fee8d`) — do not "fix" it again in this work.
8. `docs/*.md` ships in the npm tarball; `docs/plans/**` does not. Never move this doc to `docs/` top level.

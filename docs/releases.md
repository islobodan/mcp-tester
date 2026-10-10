# Release Guide

How to create and publish a new release of `mcp-tester`. The release tool (`npm run release`) does the version bump, CHANGELOG promotion, commit, and tag in one command — and runs a strict pre-flight that catches every issue we've shipped broken before (audit failures, npm 11 lockfile traps, dangling local tags, empty `[Unreleased]`).

## Prerequisites (one-time)

1. **NPM Token**
   - Go to <https://www.npmjs.com/settings/tokens> and create an **Automation** token.
   - Add it to the repository as the secret `NPM_TOKEN` (Settings → Secrets and variables → Actions → New repository secret).
2. **GitHub Actions** — `GITHUB_TOKEN` is automatic; `release.yml` already has `contents: write` for releases and `id-token: write` for provenance (if enabled).
3. **Local git** — `git push` permission for `main` and tags. The release script never pushes; you do that after the script finishes.

## The release process

```bash
# 1. Make sure your tree is ready:
#    - the [Unreleased] section of CHANGELOG.md has the entries you want to ship
#    - everything you want in the release is committed and pushed
git push origin main

# 2. Run the release script (add --dry-run first if you want a no-write preview)
npm run release -- minor
#    alias scripts: release:patch, release:minor, release:major, release:prerelease

# 3. The script prints the push command when it succeeds:
#      git push origin main --tags
#    Run that. release.yml takes over from there.
```

The script:

1. Runs a strict pre-flight (next section). If anything is off, it exits 1 with an actionable message and writes nothing.
2. Bumps the version in `package.json` and the two `version` lines in `package-lock.json` (direct JSON edit — **never** `npm version`, which has produced lockfile churn in the past).
3. Promotes `## [Unreleased]` to `## [<version>] - <today>` in `CHANGELOG.md`, byte-for-byte preserving the rest.
4. Verifies the resulting `git diff` is exactly the 3 expected files with the expected line counts.
5. Creates the commit `chore: release <version>` and a lightweight tag `v<version>`.
6. Prints the push handoff.

Nothing is pushed, nothing is published. You can inspect the commit with `git show`, the diff with `git show v<version>`, and the tag with `git tag -l`. If anything looks wrong, abort the release with `git reset --hard HEAD~1 && git tag -d v<version>`.

## The pre-flight gates (P1–P8)

Each gate maps to a real incident. If any fails, the script exits 1 with the failing gate, why it failed, and the manual command to re-run for the real error output.

| Gate | Checks | Incident it would have caught |
|---|---|---|
| **P1** | Working tree is clean | (always; you can't cut a release on dirty code) |
| **P2** | `HEAD` is at the tip of `origin/main` (no unpushed, no unpulled commits) | The 1.6.0 fold — release tag lived on unpushed commits |
| **P3** | Every local `v*` tag exists on `origin` (peeks `^{commit}` to match the remote's peeled entry) | Same — would have caught `v1.5.5` as dangling before publish |
| **P4** | Lockfile is installable by `npm@10` (run in a temp dir; CI's npm) | The 1.5.1 + 1.6.0 emnapi trap — `npm audit fix` under npm 11 has twice produced locks npm 10 cannot install |
| **P5** | `npm@10 audit --audit-level=high` exits 0 | 1.5.0 publish failure (SDK OAuth + proxy-addr) |
| **P6** | Full local gates: `build`, `lint`, `format:check`, `test:browser`, `test`, `test:coverage`, `test:package` | Surfaces anything `release.yml` will run, locally, in ~6 min |
| **P7** | New version `N` is strictly greater than published `P`; no local tag `v{N}`; not on the registry | Re-releasing the same version; double-tagging |
| **P8** | `## [Unreleased]` exists in `CHANGELOG.md` and contains at least one content line | The v1.5.5 fold — release with nothing in it |

Use `npm run release -- <bump> --dry-run` to run every gate and print the planned version / date / diff preview without writing anything.

## How the CI publish works (so you know what to expect)

Pushing `main` + the new `v<x.y.z>` tag triggers `.github/workflows/release.yml`, which:

1. **Verifies** the tag version matches `package.json` (refuses to publish a misaligned tag).
2. **Runs gates on Node 20 / npm 10** — `npm ci`, `npm audit --audit-level=high` (hard gate), `build`, `lint`, `format:check`, `test`, `coverage`.
3. **Publishes** to npm with provenance, creates the GitHub release from the CHANGELOG section that was just promoted, uploads coverage to Codecov.
4. **Verifies** the install from the registry. This job now waits up to 10 minutes for the version to become visible (npm is eventually consistent) and retries the install (see commit `24fee8d`).

If step 2 fails after the tag is pushed, fix the issue and cut a **new** release with the script — do not rewrite the tag, do not re-run the workflow.

## Versioning

[Semantic Versioning](https://semver.org/):

- **MAJOR** — breaking API change. Use sparingly.
- **MINOR** — new capability, backward compatible (browser support, new transport, new matcher).
- **PATCH** — bug fix, no public surface change (workflow fix, lockfile bump, doc fix).
- **PRERELEASE** — opt-in / experimental. The script supports `npm run release -- prerelease` and follows npm's `npm version prerelease` rules: `1.6.0` → `1.6.1-0`, `1.6.1-0` → `1.6.1-1`, `1.6.1-beta.0` → `1.6.1-beta.1`.

## Manual fallback (discouraged)

If the release script can't run for some reason (e.g. you need to do a post-incident hotfix on a fresh clone with no network), the manual equivalent is:

```bash
# 1. Edit package.json "version" and the two version lines in package-lock.json
#    (top-level + packages[""].version). Do NOT run `npm version` — it rewrites
#    the lockfile through npm's own machinery and has produced churn before.
# 2. Promote CHANGELOG.md by hand: `## [Unreleased]` → `## [N] - YYYY-MM-DD`.
# 3. Commit and tag.
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore: release N"
git tag vN
git push origin main --tags
```

If the script's pre-flight then fails on the *next* release, it's usually P4 (lockfile) — fix with `npx -y npm@10 install` (not `npm audit fix` under npm 11).

## Troubleshooting

### Pre-flight says "tree is not clean"

Commit, stash, or unstage the listed files. The script refuses to operate on a dirty tree because the `git diff --numstat` self-check needs a stable baseline.

### Pre-flight says "HEAD is N commit(s) ahead of origin/main"

You have local commits that aren't pushed. Either push them (`git push origin main`) and re-run, or reset them if you don't want them. The 1.5.5 fold was exactly this scenario.

### Pre-flight P4 fails ("lockfile not installable by npm 10")

`npm@10 ci --dry-run` returned non-zero in the temp dir. The most common cause is `npm audit fix` having been run under npm 11. Fix:

```bash
npx -y npm@10 install           # regenerate lock under npm 10
# OR (if you actually want audit fixes)
npx -y npm@10 audit fix
```

Then re-run the release script. See `docs/troubleshooting.md` for the full emnapi history.

### Pre-flight P5 fails (audit)

Same command `release.yml` will run. Run `npx -y npm@10 audit` to see what; bump or replace the offending dependency. If the advisory is in a transitive dep behind a dev-only package, the right fix is to bump the parent (e.g. `ts-jest` was the path that brought in `handlebars` for 1.6.0).

### Pre-flight P8 fails ("nothing to release — [Unreleased] is empty")

Add entries to `CHANGELOG.md` under `## [Unreleased]`, or skip this release. The script refuses to cut a release with an empty changelog because that's exactly the shape of the v1.5.5 fold.

### Resume after an interrupted run

If the script died between the commit and the tag (e.g. lost connection), the next run detects the state — `package.json` is bumped, `CHANGELOG.md` has the new section, HEAD is `chore: release <N>`, but the tag is missing — and just creates the missing tag. The full pre-flight is skipped in resume mode, but `N > published P` is still verified.

### `release.yml` verify job fails

`release.yml`'s verify job now waits up to 10 minutes for npm to propagate and retries the install (commit `24fee8d`). If it still fails, the package genuinely is not installable — check the workflow logs and treat as a real failure.

### Tag exists locally but you want to redo the release

```bash
git tag -d vX.Y.Z
git reset --hard HEAD~1   # undo the release commit
# re-run: npm run release -- patch
```

Never push a deletion of a published tag without first unpublishing or deprecating that version on npm.

## Best practices

1. **Keep `[Unreleased]` flowing.** Add changelog entries with the code change, not in a separate prep step. The script's P8 gate makes this a hard requirement.
2. **Push before you release.** The script's P2 + P3 gates enforce this; respect them.
3. **One tag per push.** Two tag pushes launch two concurrent `release.yml` runs that both `npm publish`; npm `latest` will land on whichever finishes last (potentially the older one). If you accidentally cut two, see [docs/troubleshooting.md](./troubleshooting.md).
4. **Use `--dry-run` on the first cut of a new release line** to sanity-check what would happen without writing anything.
5. **Never run `npm version` against this repo's lockfile.** Use the script (which does direct JSON edits + a diff self-check) or the manual fallback.

## See also

- [`docs/plans/release-automation.md`](./plans/release-automation.md) — the implementation spec, including the incident log that justifies every gate.
- [`docs/troubleshooting.md`](./troubleshooting.md) — common failures and how to fix them.
- [`CHANGELOG.md`](../CHANGELOG.md) — the changelog the script promotes.

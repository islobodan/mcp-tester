#!/usr/bin/env node
/**
 * Release automation CLI.
 *
 * Usage:
 *   npm run release -- <patch|minor|major|prerelease> [--dry-run]
 *
 * Runs a strict pre-flight (clean tree, origin sync, no dangling tags,
 * npm@10 lockfile check, npm@10 audit gate, full local test suite, version
 * + tag + registry sanity, non-empty CHANGELOG [Unreleased]), then on
 * success bumps the version, promotes the changelog, and creates a
 * `chore: release <x.y.z>` commit + lightweight `v<x.y.z>` tag.
 *
 * Nothing is pushed, nothing is published. Push remains manual; publish is
 * the existing `release.yml` workflow (now with registry-propagation
 * retries — see 24fee8d).
 *
 * Spec: docs/plans/release-automation.md
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  semverInc,
  compareSemver,
  checkChangelog,
  promoteChangelog,
  applyVersionEdits,
} from './release-lib.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, '..');

const BUMP_TYPES = ['patch', 'minor', 'major', 'prerelease'];
const PACKAGE_NAME = '@slbdn/mcp-tester';

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

const COLOR = process.stdout.isTTY;
const paint = {
  green: (s) => (COLOR ? `\x1b[32m${s}\x1b[0m` : s),
  red: (s) => (COLOR ? `\x1b[31m${s}\x1b[0m` : s),
  cyan: (s) => (COLOR ? `\x1b[36m${s}\x1b[0m` : s),
  dim: (s) => (COLOR ? `\x1b[2m${s}\x1b[0m` : s),
  bold: (s) => (COLOR ? `\x1b[1m${s}\x1b[0m` : s),
};

const log = {
  ok: (s) => console.log(`${paint.green('✓')} ${s}`),
  fail: (s) => console.log(`${paint.red('❌')} ${s}`),
  info: (s) => console.log(`${paint.cyan('ℹ')} ${s}`),
  warn: (s) => console.log(`${paint.cyan('⚠')} ${s}`),
  step: (s) => console.log(paint.bold(s)),
  dim: (s) => console.log(paint.dim(s)),
};

// ---------------------------------------------------------------------------
// Subprocess helpers
// ---------------------------------------------------------------------------

/** Run a command, optionally capturing stdout. Throws on non-zero status. */
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: REPO_ROOT,
    shell: false,
    stdio: opts.silent ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
    ...opts,
  });
  return r;
}

function capture(cmd, args, opts = {}) {
  const r = run(cmd, args, { ...opts, silent: true });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    throw new Error(
      `${cmd} ${args.join(' ')} exited ${r.status}: ${
        (r.stderr || r.stdout || '').toString().split('\n').slice(0, 5).join('\n')
      }`
    );
  }
  return (r.stdout || '').toString();
}

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printUsage();
    process.exit(args.length === 0 ? 2 : 0);
  }
  const bump = args[0];
  if (!BUMP_TYPES.includes(bump)) {
    log.fail(`Unknown bump type: "${bump}". Use one of: ${BUMP_TYPES.join(', ')}`);
    process.exit(2);
  }
  const dryRun = args.includes('--dry-run');
  return { bump, dryRun };
}

function printUsage() {
  console.log('Usage: npm run release -- <patch|minor|major|prerelease> [--dry-run]');
  console.log('');
  console.log('Runs a strict pre-flight, then bumps the version, promotes the');
  console.log('CHANGELOG, commits "chore: release <version>", and creates a');
  console.log('lightweight tag "v<version>". Nothing is pushed or published.');
}

// ---------------------------------------------------------------------------
// Pre-flight checks P1..P8
// ---------------------------------------------------------------------------

/**
 * P1: Clean working tree.
 */
function p1CleanTree() {
  const out = capture('git', ['status', '--porcelain']);
  if (out.trim()) {
    return `working tree is not clean:\n${out
      .trim()
      .split('\n')
      .map((l) => '    ' + l)
      .join('\n')}\n    Commit, stash, or unstage the changes above.`;
  }
  return null;
}

/**
 * P2: In sync with origin/main (no unpulled, no unpushed).
 */
function p2InSyncWithOrigin() {
  // Fetch silently; this is the same command every CI push would run.
  const fetch = run('git', ['fetch', 'origin', 'main', '--tags', '--quiet']);
  if (fetch.status !== 0) {
    return '`git fetch origin main --tags` failed — check your network / git auth.';
  }
  const ahead = Number(capture('git', ['rev-list', '--count', 'origin/main..HEAD']).trim());
  const behind = Number(capture('git', ['rev-list', '--count', 'HEAD..origin/main']).trim());
  if (ahead > 0) {
    return `HEAD is ${ahead} commit(s) ahead of origin/main. Push first, or this release will land on unpushed history.`;
  }
  if (behind > 0) {
    return `HEAD is ${behind} commit(s) behind origin/main. Pull/rebase first.`;
  }
  return null;
}

/**
 * P3: No dangling local tags (every local v* must exist on origin).
 */
function p3NoDanglingTags() {
  const remoteOut = capture('git', ['ls-remote', '--tags', 'origin']);
  const remoteShas = new Set();
  for (const line of remoteOut.trim().split('\n')) {
    if (!line) continue;
    const [sha] = line.split('\t');
    if (sha) remoteShas.add(sha);
  }
  const localTags = capture('git', ['tag', '--list', 'v*'])
    .trim()
    .split('\n')
    .filter(Boolean);
  const dangling = [];
  for (const t of localTags) {
    // Peek to the commit SHA so annotated tags match `git ls-remote`'s peeled entry.
    const sha = capture('git', ['rev-parse', '--verify', `${t}^{commit}`]).trim();
    if (!remoteShas.has(sha)) dangling.push(t);
  }
  if (dangling.length) {
    return (
      `local tags not on origin: ${dangling.join(', ')}\n` +
      `    Two tag pushes race two release.yml runs for npm 'latest'. Push them deliberately with \`git push origin ${dangling.join(' ')}\`, or delete with \`git tag -d <tag>\`.`
    );
  }
  return null;
}

/**
 * P4: Lockfile installable by CI's npm@10 (the emnapi trap).
 */
function p4LockfileInstallable() {
  const tmp = mkdtempSync(join(tmpdir(), 'mcp-release-'));
  let exitStatus = 1;
  try {
    cpSync(join(REPO_ROOT, 'package.json'), join(tmp, 'package.json'));
    cpSync(join(REPO_ROOT, 'package-lock.json'), join(tmp, 'package-lock.json'));
    log.dim('    (running npx -y npm@10 ci --dry-run in a temp dir — first run may download)');
    const r = run('npx', ['-y', 'npm@10', 'ci', '--dry-run', '--ignore-scripts'], { cwd: tmp });
    exitStatus = r.status ?? 1;
    if (exitStatus !== 0) {
      return (
        `npm@10 ci --dry-run failed (exit ${exitStatus}).\n` +
        `    The lockfile is not installable by CI's npm 10. Fix with: npx -y npm@10 install ...\n` +
        `    NEVER plain \`npm audit fix\` under npm 11 — it has twice produced locks npm 10 cannot install.`
      );
    }
    return null;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/**
 * P5: npm@10 audit --audit-level=high (release.yml's hard gate).
 */
function p5Audit() {
  log.dim('    (running npx -y npm@10 audit --audit-level=high)');
  const r = run('npx', ['-y', 'npm@10', 'audit', '--audit-level=high']);
  if (r.status !== 0) {
    return (
      `npm@10 audit --audit-level=high failed (exit ${r.status}).\n` +
      `    This is the same gate release.yml runs. Fix with: npx -y npm@10 audit fix, or bump the affected dep.`
    );
  }
  return null;
}

/**
 * P6: Full local test suite, cheapest first. Same gates release.yml + test.yml
 * run in CI, plus test:browser and test:package which only this script wires
 * together.
 */
function p6LocalGates() {
  const gates = [
    ['build', 'npm run build'],
    ['lint', 'npm run lint'],
    ['format:check', 'npm run format:check'],
    ['test:browser', 'npm run test:browser'],
    ['test', 'npm test'],
    ['test:coverage', 'npm run test:coverage'],
    ['test:package', 'npm run test:package'],
  ];
  for (const [name, cmd] of gates) {
    log.dim(`    (${cmd})`);
    const r = run('npm', ['run', name]);
    if (r.status !== 0) {
      return `\`${cmd}\` failed (exit ${r.status}). Re-run it manually for the real error output.`;
    }
  }
  return null;
}

/**
 * P7: Version sanity. Returns { N, V, P, warnings } on success.
 *
 *   N = the version the release would produce
 *   V = current package.json version
 *   P = latest published version on the registry
 */
function p7VersionSanity(bumpType) {
  let P;
  try {
    P = capture('npm', ['view', PACKAGE_NAME, 'version']).trim();
  } catch (e) {
    return `npm view ${PACKAGE_NAME} version failed: ${e.message}`;
  }
  const V = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')).version;
  const N = semverInc(V, bumpType);
  const warnings = [];

  if (V !== P) {
    warnings.push(
      `package.json version "${V}" differs from published "${P}" (e.g. post-fold state). Continuing because N > P.`
    );
  }

  if (compareSemver(N, P) <= 0) {
    return `new version ${N} is not strictly greater than the published ${P}. Pick a larger bump.`;
  }

  // Local tag collision
  const tagRef = `v${N}`;
  const tagCheck = run('git', ['rev-parse', '-q', '--verify', `refs/tags/${tagRef}`], {
    silent: true,
  });
  if (tagCheck.status === 0) {
    return `tag ${tagRef} already exists locally. Delete it (git tag -d ${tagRef}) or pick a different bump.`;
  }

  // Registry collision (the version is already published)
  const regCheck = run('npm', ['view', `${PACKAGE_NAME}@${N}`, 'version'], { silent: true });
  if (regCheck.status === 0) {
    return `version ${N} is already on the registry. Pick a different bump.`;
  }

  return { N, V, P, warnings };
}

/**
 * P8: CHANGELOG gate (the anti-v1.5.5 guard).
 */
function p8Changelog(version) {
  const text = readFileSync(join(REPO_ROOT, 'CHANGELOG.md'), 'utf8');
  const r = checkChangelog(text, version);
  if (!r.exists) {
    return 'CHANGELOG.md is missing the `## [Unreleased]` heading.';
  }
  if (r.alreadyReleased) {
    return `CHANGELOG.md already has a \`## [${version}]\` heading — refusing to double-release.`;
  }
  if (!r.nonEmpty) {
    return (
      `nothing to release — \`## [Unreleased]\` is empty.\n` +
      `    Add entries to CHANGELOG.md, or skip this release entirely.`
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Release steps R1..R6
// ---------------------------------------------------------------------------

/**
 * Apply version edits + changelog promotion, write the files, and verify
 * the diff touches exactly the expected lines (3 version lines + the new
 * changelog heading lines).
 */
function rApplyEdits(V, N, date) {
  const pkgPath = join(REPO_ROOT, 'package.json');
  const lockPath = join(REPO_ROOT, 'package-lock.json');
  const changelogPath = join(REPO_ROOT, 'CHANGELOG.md');

  const pkgText = readFileSync(pkgPath, 'utf8');
  const lockText = readFileSync(lockPath, 'utf8');
  const changelogText = readFileSync(changelogPath, 'utf8');

  const { pkg: newPkg, lock: newLock } = applyVersionEdits(pkgText, lockText, V, N);
  const newChangelog = promoteChangelog(changelogText, N, date);

  writeFileSync(pkgPath, newPkg);
  writeFileSync(lockPath, newLock);
  writeFileSync(changelogPath, newChangelog);

  // Self-check: diff must be small and confined to the three files.
  const numstat = capture('git', ['diff', '--numstat', '--', pkgPath, lockPath, changelogPath]);
  // numstat lines are "added\tremoved\tpath"; path is repo-relative.
  const lines = numstat.trim().split('\n').filter(Boolean);
  const touched = new Set();
  for (const line of lines) {
    const [, , p] = line.split('\t');
    touched.add(p);
  }
  const expected = new Set(['package.json', 'package-lock.json', 'CHANGELOG.md']);
  const extra = [...touched].filter((p) => !expected.has(p));
  const missing = [...expected].filter((p) => !touched.has(p));
  if (extra.length || missing.length) {
    return (
      `version-edit self-check failed — diff not as expected.\n` +
      `    extra files touched: ${extra.join(', ') || '(none)'}\n` +
      `    expected files missing: ${missing.join(', ') || '(none)'}\n` +
      `    Diff:\n${capture('git', ['diff', '--', pkgPath, lockPath, changelogPath])
        .split('\n')
        .map((l) => '      ' + l)
        .join('\n')}`
    );
  }
  // Sanity bounds: each version line is replaced 1-for-1 (1+/1-), so for
  // package.json (1 line) and package-lock.json (2 lines) the per-file
  // added and deleted counts must each be ≤ the line count, and equal.
  // The changelog is "+2" (new `## [N] - DATE` heading + blank line) and
  // "-0" (the old `## [Unreleased]` is moved, not deleted). A 0/0 (no
  // change at all) is also acceptable here for robustness.
  const expectations = {
    'package.json': 1,
    'package-lock.json': 2,
    'CHANGELOG.md': 6, // upper bound — promotion adds 2-3 lines
  };
  for (const line of lines) {
    const [add, del, p] = line.split('\t');
    const added = Number(add);
    const deleted = Number(del);
    const limit = expectations[p] ?? 0;
    if (added > limit || deleted > limit) {
      return (
        `${p} diff is larger than expected (${added}+ / ${deleted}-, limit ${limit}).\n` +
        `    Inspect with: git diff -- ${p}\n` +
        `    Refusing to commit a suspect release.`
      );
    }
  }
  return null;
}

/**
 * Commit exactly the three release files.
 */
function rCommit(N) {
  const add = run('git', ['add', 'package.json', 'package-lock.json', 'CHANGELOG.md']);
  if (add.status !== 0) return `git add failed (exit ${add.status})`;
  const commit = run('git', ['commit', '-m', `chore: release ${N}`]);
  if (commit.status !== 0) {
    return `git commit failed (exit ${commit.status}). Run \`git status\` to inspect.`;
  }
  return null;
}

/**
 * Create a lightweight tag.
 */
function rTag(N) {
  const tag = run('git', ['tag', `v${N}`]);
  if (tag.status !== 0) return `git tag failed (exit ${tag.status})`;
  return null;
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

/**
 * Run a check, print pass/fail with consistent formatting. `fn` returns
 *   - null                 → pass
 *   - string               → fail with this message
 *   - { value, warnings }  → pass; warnings are printed (P7 uses this)
 *
 * On fail, exits 1.
 */
function runCheck(label, fn) {
  log.info(`${label}…`);
  const r = fn();
  if (r && typeof r === 'object' && r.warnings) {
    for (const w of r.warnings) log.warn(w);
  } else if (typeof r === 'string') {
    log.fail(`${label}: ${r}`);
    process.exit(1);
  }
  log.ok(label);
  return r;
}

function preflight(bumpType) {
  runCheck('P1 clean working tree', p1CleanTree);
  runCheck('P2 in sync with origin/main', p2InSyncWithOrigin);
  runCheck('P3 no dangling local tags', p3NoDanglingTags);
  runCheck("P4 lockfile installable by CI's npm@10", p4LockfileInstallable);
  runCheck('P5 npm@10 audit --audit-level=high', p5Audit);
  runCheck('P6 local gates (build/lint/format/tests/browser/coverage/package)', p6LocalGates);
  const vinfo = runCheck('P7 version sanity (registry + tags + semver order)', () => p7VersionSanity(bumpType));
  runCheck('P8 CHANGELOG [Unreleased] non-empty', () => p8Changelog(vinfo.N));
  return vinfo;
}

function cutRelease(vinfo) {
  const { N, V } = vinfo;
  const date = new Date().toISOString().slice(0, 10);
  log.step(`\nCutting release ${N} (${date})…`);

  const err = rApplyEdits(V, N, date);
  if (err) {
    log.fail(err);
    // Best-effort: undo any partial writes.
    run('git', ['checkout', '--', 'package.json', 'package-lock.json', 'CHANGELOG.md']);
    process.exit(1);
  }
  log.ok('version bumped, CHANGELOG promoted');

  if (rCommit(N)) {
    log.fail(`commit failed`);
    run('git', ['checkout', '--', 'package.json', 'package-lock.json', 'CHANGELOG.md']);
    process.exit(1);
  }
  log.ok('release commit created');

  if (rTag(N)) {
    log.fail(`tagging failed`);
    process.exit(1);
  }
  log.ok(`tag v${N} created`);
}

/**
 * Detect an interrupted run (commit done, tag missing). If detected,
 * complete only the missing steps.
 */
function detectResume(bumpType) {
  const V = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')).version;
  const changelogText = readFileSync(join(REPO_ROOT, 'CHANGELOG.md'), 'utf8');
  if (!checkChangelog(changelogText, V).alreadyReleased) return null;

  const headSubject = capture('git', ['log', '-1', '--pretty=%s']).trim();
  if (headSubject !== `chore: release ${V}`) return null;

  const tagCheck = run('git', ['rev-parse', '-q', '--verify', `refs/tags/v${V}`], { silent: true });
  if (tagCheck.status === 0) return null; // tag already exists, nothing to resume

  // V must still be > published P.
  let P;
  try {
    P = capture('npm', ['view', PACKAGE_NAME, 'version']).trim();
  } catch {
    return null;
  }
  if (compareSemver(V, P) <= 0) return null;

  // The bump type doesn't matter for resume; force-set to match the existing V.
  return { N: V, V, P, warnings: [`resuming interrupted run for v${V} — skipping bump and commit`] };
}

function main() {
  const { bump, dryRun } = parseArgs();
  log.step(`Release script${dryRun ? ' (dry-run)' : ''} — bump=${bump}`);
  log.dim(`  repo: ${REPO_ROOT}`);

  // Resume case: commit present, tag missing. Skip P1/P2 (might be in
  // post-commit state where the commit just made HEAD ahead of origin),
  // and skip P7's bump logic — just create the tag.
  const resumed = !dryRun ? detectResume(bump) : null;
  let vinfo;
  if (resumed) {
    log.warn(resumed.warnings[0]);
    vinfo = resumed;
  } else {
    vinfo = preflight(bump);
  }

  if (dryRun) {
    const date = new Date().toISOString().slice(0, 10);
    log.step(`\n[DRY RUN] Would cut release ${vinfo.N} (${date})`);
    log.dim('  - bump package.json + lock to ' + vinfo.N);
    log.dim('  - promote CHANGELOG [Unreleased] → [N]');
    log.dim('  - commit "chore: release ' + vinfo.N + '"');
    log.dim('  - lightweight tag v' + vinfo.N);
    log.dim('  - print: git push origin main --tags');
    log.ok('dry-run complete');
    return;
  }

  cutRelease(vinfo);

  log.step(`\nRelease ${vinfo.N} is ready.`);
  log.info('Next:');
  log.ok(`  git push origin main --tags`);
  log.dim('  release.yml will: verify tag↔version, npm ci, audit, build, lint,');
  log.dim('  format, test, coverage, npm publish, GitHub release, then verify');
  log.dim('  the install (now with registry-propagation retries — 24fee8d).');
}

main();

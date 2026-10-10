/**
 * Unit tests for `scripts/release-lib.mjs`.
 *
 * Run with:  npm run test:release
 * (which is `node --test scripts/release.test.mjs`).
 *
 * Each `describe` block groups a function; each test case below is named
 * after the incident or behavior it regression-guards (see
 * `docs/plans/release-automation.md` §1, §6.3).
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  compareSemver,
  semverInc,
  checkChangelog,
  promoteChangelog,
  applyVersionEdits,
} from './release-lib.mjs';

// ---------------------------------------------------------------------------
// compareSemver
// ---------------------------------------------------------------------------

describe('compareSemver', () => {
  test('equal versions are 0', () => {
    assert.equal(compareSemver('1.2.3', '1.2.3'), 0);
  });

  test('major / minor / patch order numerically', () => {
    assert.equal(compareSemver('1.2.3', '2.0.0'), -1);
    assert.equal(compareSemver('2.0.0', '1.2.3'), 1);
    assert.equal(compareSemver('1.2.3', '1.3.0'), -1);
    assert.equal(compareSemver('1.3.0', '1.2.3'), 1);
    assert.equal(compareSemver('1.2.3', '1.2.4'), -1);
    assert.equal(compareSemver('1.2.4', '1.2.3'), 1);
  });

  test('numeric identifier ordering: 1.6.10 > 1.6.9 (NOT lexical)', () => {
    assert.equal(compareSemver('1.6.9', '1.6.10'), -1);
    assert.equal(compareSemver('1.6.10', '1.6.9'), 1);
  });

  test('prerelease has lower precedence than the same version without', () => {
    assert.equal(compareSemver('1.6.0-beta.1', '1.6.0'), -1);
    assert.equal(compareSemver('1.6.0', '1.6.0-beta.1'), 1);
  });

  test('numeric prerelease identifiers compare numerically', () => {
    assert.equal(compareSemver('1.6.0-beta.2', '1.6.0-beta.10'), -1);
  });

  test('numeric identifier < alphanumeric identifier', () => {
    assert.equal(compareSemver('1.6.0-1', '1.6.0-alpha'), -1);
  });

  test('longer prerelease with equal prefix > shorter', () => {
    assert.equal(compareSemver('1.6.0-beta', '1.6.0-beta.0'), -1);
  });

  test('invalid input throws', () => {
    assert.throws(() => compareSemver('not-a-version', '1.0.0'), /Invalid semver/);
  });
});

// ---------------------------------------------------------------------------
// semverInc
// ---------------------------------------------------------------------------

describe('semverInc', () => {
  test('patch bumps the patch segment', () => {
    assert.equal(semverInc('1.2.3', 'patch'), '1.2.4');
  });

  test('minor bumps the minor segment and zeroes the patch', () => {
    assert.equal(semverInc('1.2.3', 'minor'), '1.3.0');
  });

  test('major bumps the major segment and zeroes the rest', () => {
    assert.equal(semverInc('1.2.3', 'major'), '2.0.0');
  });

  test('prerelease on a plain version bumps patch and appends -0', () => {
    assert.equal(semverInc('1.2.3', 'prerelease'), '1.2.4-0');
  });

  test('prerelease on a numeric prerelease increments the numeric', () => {
    assert.equal(semverInc('1.2.4-0', 'prerelease'), '1.2.4-1');
  });

  test('prerelease on a tagged prerelease increments the trailing numeric', () => {
    assert.equal(semverInc('1.2.3-beta.0', 'prerelease'), '1.2.3-beta.1');
  });

  test('prerelease on a tagged prerelease without trailing numeric appends .0', () => {
    assert.equal(semverInc('1.2.3-beta', 'prerelease'), '1.2.3-beta.0');
  });

  test('unknown type throws', () => {
    assert.throws(() => semverInc('1.2.3', 'feature'), /Unknown bump type/);
  });
});

// ---------------------------------------------------------------------------
// checkChangelog  (anti-v1.5.5 fold guard)
// ---------------------------------------------------------------------------

describe('checkChangelog', () => {
  const sample = `# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Fixed
- Some bug.

## [1.6.0] - 2026-10-08

### Added
- Browser support.
`;

  test('returns exists=true when [Unreleased] is present', () => {
    const r = checkChangelog(sample, '1.6.1');
    assert.equal(r.exists, true);
  });

  test('returns exists=false when [Unreleased] is missing', () => {
    const noUnreleased = sample.replace('## [Unreleased]\n\n', '');
    const r = checkChangelog(noUnreleased, '1.6.1');
    assert.equal(r.exists, false);
  });

  test('returns nonEmpty=true when [Unreleased] has at least one bullet', () => {
    const r = checkChangelog(sample, '1.6.1');
    assert.equal(r.nonEmpty, true);
  });

  test('returns nonEmpty=false when [Unreleased] is empty (v1.5.5 fold guard)', () => {
    const empty = `# Changelog

## [Unreleased]

## [1.6.0] - 2026-10-08

### Added
- Browser support.
`;
    const r = checkChangelog(empty, '1.6.1');
    assert.equal(r.exists, true);
    assert.equal(r.nonEmpty, false, 'must refuse an empty [Unreleased] section');
  });

  test('nonEmpty recognizes a `### ` subsection as content', () => {
    const subsection = `# Changelog

## [Unreleased]

### Added
## [1.6.0] - 2026-10-08
`;
    const r = checkChangelog(subsection, '1.6.1');
    assert.equal(r.nonEmpty, true);
  });

  test('alreadyReleased=true when the version heading already exists', () => {
    const r = checkChangelog(sample, '1.6.0');
    assert.equal(r.alreadyReleased, true);
  });

  test('alreadyReleased does NOT false-match a numerically-adjacent version', () => {
    // Heading `## [1.6.0]` must not satisfy a check for `1.6`.
    const r = checkChangelog(sample, '1.6');
    assert.equal(r.alreadyReleased, false);
  });

  test('alreadyReleased=false for an unused version', () => {
    const r = checkChangelog(sample, '9.9.9');
    assert.equal(r.alreadyReleased, false);
  });
});

// ---------------------------------------------------------------------------
// promoteChangelog
// ---------------------------------------------------------------------------

describe('promoteChangelog', () => {
  test('preserves the [Unreleased] heading and content byte-for-byte', () => {
    const before = `# Changelog

## [Unreleased]

### Fixed
- Some bug.

## [1.6.0] - 2026-10-08

### Added
- Browser support.
`;
    const after = promoteChangelog(before, '1.6.1', '2026-10-09');
    // Content below the new heading must be identical to the content below
    // the old [Unreleased] heading (everything past the new heading's
    // trailing newline).
    const oldStart = before.indexOf('## [Unreleased]');
    const oldAfter = before.indexOf('\n', oldStart) + 1;
    const newStart = after.indexOf('## [1.6.1]');
    const newAfter = after.indexOf('\n', newStart) + 1;
    assert.equal(after.slice(newAfter), before.slice(oldAfter));
  });

  test('keeps a fresh empty [Unreleased] heading on top', () => {
    const before = `# Changelog

## [Unreleased]

### Fixed
- Some bug.

## [1.6.0] - 2026-10-08
`;
    const after = promoteChangelog(before, '1.6.1', '2026-10-09');
    assert.match(after, /## \[Unreleased\]\n\n## \[1\.6\.1\] - 2026-10-09\n/);
  });

  test('throws when [Unreleased] is missing', () => {
    const before = `# Changelog

## [1.6.0] - 2026-10-08
`;
    assert.throws(
      () => promoteChangelog(before, '1.6.1', '2026-10-09'),
      /missing the `## \[Unreleased\]` heading/
    );
  });

  test('handles CRLF line endings', () => {
    const before = '# Changelog\r\n\r\n## [Unreleased]\r\n\r\n### Fixed\r\n- x.\r\n';
    const after = promoteChangelog(before, '1.6.1', '2026-10-09');
    assert.match(after, /## \[Unreleased\]\n\n## \[1\.6\.1\] - 2026-10-09\n/);
  });
});

// ---------------------------------------------------------------------------
// applyVersionEdits  (version-only diff property)
// ---------------------------------------------------------------------------

describe('applyVersionEdits', () => {
  const pkgText = JSON.stringify(
    {
      name: '@slbdn/mcp-tester',
      version: '1.6.0',
      description: 'test',
      dependencies: { foo: '^1.6.0' },
    },
    null,
    2
  ) + '\n';

  const lockText = JSON.stringify(
    {
      name: '@slbdn/mcp-tester',
      version: '1.6.0',
      lockfileVersion: 3,
      packages: {
        '': { name: '@slbdn/mcp-tester', version: '1.6.0' },
        'node_modules/foo': { version: '1.6.0' },
      },
    },
    null,
    2
  ) + '\n';

  test('bumps only the top-level version in package.json', () => {
    const { pkg } = applyVersionEdits(pkgText, lockText, '1.6.0', '1.6.1');
    const next = JSON.parse(pkg);
    assert.equal(next.version, '1.6.1');
    // A dependency range happens to mention "1.6.0" — it MUST be preserved.
    assert.equal(next.dependencies.foo, '^1.6.0');
  });

  test('bumps exactly the two version lines in package-lock.json', () => {
    const { lock } = applyVersionEdits(pkgText, lockText, '1.6.0', '1.6.1');
    const next = JSON.parse(lock);
    assert.equal(next.version, '1.6.1');
    assert.equal(next.packages[''].version, '1.6.1');
    // Nested dependency entry must not be touched.
    assert.equal(next.packages['node_modules/foo'].version, '1.6.0');
  });

  test('output formatting is 2-space indent with a trailing newline', () => {
    const { pkg, lock } = applyVersionEdits(pkgText, lockText, '1.6.0', '1.6.1');
    assert.ok(pkg.endsWith('\n'), 'package.json should end with newline');
    assert.ok(lock.endsWith('\n'), 'package-lock.json should end with newline');
    assert.match(pkg, /^\{\n {2}"name":/);
    assert.match(lock, /^\{\n {2}"name":/);
  });

  test('throws when the current version does not match (stale tree)', () => {
    assert.throws(
      () => applyVersionEdits(pkgText, lockText, '1.5.4', '1.6.1'),
      /package\.json version is "1\.6\.0", expected "1\.5\.4"/
    );
  });

  test('throws when package-lock.json top-level version mismatches', () => {
    const staleLock = lockText.replace('"version": "1.6.0"', '"version": "1.5.4"', 1);
    assert.throws(
      () => applyVersionEdits(pkgText, staleLock, '1.6.0', '1.6.1'),
      /package-lock\.json top-level "version" is "1\.5\.4"/
    );
  });

  test('throws when packages[""].version is missing or mismatched', () => {
    const noRootVersion = JSON.stringify(
      {
        name: '@slbdn/mcp-tester',
        version: '1.6.0',
        packages: { '': { name: '@slbdn/mcp-tester' } },
      },
      null,
      2
    ) + '\n';
    assert.throws(
      () => applyVersionEdits(pkgText, noRootVersion, '1.6.0', '1.6.1'),
      /packages\[""\]\.version/
    );
  });
});

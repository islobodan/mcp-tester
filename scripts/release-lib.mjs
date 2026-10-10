/**
 * Release automation — pure functions.
 *
 * No I/O, no subprocesses, no global state. Every function in this file is
 * fully unit-tested in `release.test.mjs`. The CLI orchestrator
 * (`release.mjs`) handles the file system, git, npm, and stdout formatting.
 *
 * See `docs/plans/release-automation.md` for context.
 */

// ---------------------------------------------------------------------------
// Semver (hand-rolled; no new runtime deps; spec: semver.org §11)
// ---------------------------------------------------------------------------

/**
 * Parse a strict semver string into a small object. Throws on invalid input.
 * Build metadata (e.g. `+sha.abc123`) is intentionally not exposed — the
 * release tool never produces or compares build metadata.
 *
 * @param {string} v
 */
function parseVersion(v) {
  if (typeof v !== 'string') throw new Error(`Invalid semver: ${v}`);
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(v);
  if (!m) throw new Error(`Invalid semver: ${v}`);
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    pre: m[4] ? m[4].split('.') : null,
  };
}

/**
 * Compare two single semver identifiers per semver.org §11:
 *   - numeric < alphanumeric
 *   - numeric vs numeric: numeric
 *   - alphanumeric vs alphanumeric: ASCII lexical
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} -1 | 0 | 1
 */
function compareIdentifiers(a, b) {
  if (a === b) return 0;
  const aIsNum = /^[0-9]+$/.test(a);
  const bIsNum = /^[0-9]+$/.test(b);
  if (aIsNum && bIsNum) {
    // BigInt to avoid JS number truncation of huge identifiers.
    const an = BigInt(a);
    const bn = BigInt(b);
    return an < bn ? -1 : 1;
  }
  if (aIsNum) return -1; // numeric < alphanumeric
  if (bIsNum) return 1;
  return a < b ? -1 : 1;
}

/**
 * Three-way semver compare. A version with a prerelease tag has lower
 * precedence than the same version without one (so `1.6.0-beta.1 < 1.6.0`).
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} -1 if a<b, 0 if a==b, 1 if a>b
 */
export function compareSemver(a, b) {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  if (va.major !== vb.major) return va.major < vb.major ? -1 : 1;
  if (va.minor !== vb.minor) return va.minor < vb.minor ? -1 : 1;
  if (va.patch !== vb.patch) return va.patch < vb.patch ? -1 : 1;
  if (va.pre && !vb.pre) return -1;
  if (!va.pre && vb.pre) return 1;
  if (!va.pre && !vb.pre) return 0;
  const len = Math.min(va.pre.length, vb.pre.length);
  for (let i = 0; i < len; i += 1) {
    const c = compareIdentifiers(va.pre[i], vb.pre[i]);
    if (c !== 0) return c;
  }
  return va.pre.length < vb.pre.length ? -1 : 1;
}

/**
 * Bump a version. Mirrors the behavior of `npm version <type>` (which the
 * release tool replaces), including the prerelease rules:
 *   - no prerelease: increment patch, append `-0`             (1.2.3 → 1.2.4-0)
 *   - prerelease ending in numeric: increment that numeric     (1.2.3-0 → 1.2.3-1, 1.2.3-beta.0 → 1.2.3-beta.1)
 *   - prerelease ending in alphanumeric: append `.0`           (1.2.3-beta → 1.2.3-beta.0)
 *
 * @param {string} version
 * @param {'major'|'minor'|'patch'|'prerelease'} type
 * @returns {string}
 */
export function semverInc(version, type) {
  const v = parseVersion(version);
  switch (type) {
    case 'major':
      return `${v.major + 1}.0.0`;
    case 'minor':
      return `${v.major}.${v.minor + 1}.0`;
    case 'patch':
      return `${v.major}.${v.minor}.${v.patch + 1}`;
    case 'prerelease': {
      if (!v.pre) {
        return `${v.major}.${v.minor}.${v.patch + 1}-0`;
      }
      const pre = v.pre.slice();
      const last = pre.pop();
      if (/^[0-9]+$/.test(last)) {
        pre.push(String(Number(last) + 1));
      } else {
        pre.push(`${last}.0`);
      }
      return `${v.major}.${v.minor}.${v.patch}-${pre.join('.')}`;
    }
    default:
      throw new Error(`Unknown bump type: ${type}`);
  }
}

// ---------------------------------------------------------------------------
// CHANGELOG (Keep a Changelog format used by this repo)
// ---------------------------------------------------------------------------

/**
 * Inspect `## [Unreleased]` and the would-be version. Returns three flags:
 *   - exists:           the `[Unreleased]` heading is present
 *   - nonEmpty:         the block below it has at least one content line
 *                       (bullet or `### ` subsection) before the next `## `
 *   - alreadyReleased:  a `## [<version>]` heading is already present
 *
 * The nonEmpty check is the anti-v1.5.5 guard — refusing to cut a release
 * when there is literally nothing to release.
 *
 * @param {string} text  full CHANGELOG.md contents
 * @param {string} version  the version the release would produce (e.g. "1.6.1")
 */
export function checkChangelog(text, version) {
  const exists = /^## \[Unreleased\]\s*$/m.test(text);
  // alreadyReleased: anchor on `## [<version>]` and require the next char
  // NOT be a digit, so `## [1.6.1]` doesn't match `## [1.6.10]`.
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const alreadyReleased = new RegExp(`^## \\[${escaped}\\](?![\\d])`, 'm').test(text);

  let nonEmpty = false;
  if (exists) {
    const start = text.indexOf('## [Unreleased]');
    const afterHeader = text.indexOf('\n', start) + 1;
    const rest = text.slice(afterHeader);
    // The block ends at the next non-`[Unreleased]` `## ` heading.
    const nextHeading = /^(?!## \[Unreleased\] )## /m.exec(rest);
    const block = nextHeading ? rest.slice(0, nextHeading.index) : rest;
    nonEmpty = /^\s*(?:- |\* |### )/m.test(block);
  }

  return { exists, nonEmpty, alreadyReleased };
}

/**
 * Promote `## [Unreleased]` in-place: keep the heading (with a fresh empty
 * block above), insert `## [<version>] - <date>` immediately after it, and
 * preserve all content byte-for-byte below.
 *
 * Throws if the `[Unreleased]` heading is missing.
 *
 * @param {string} text   full CHANGELOG.md contents
 * @param {string} version
 * @param {string} date    ISO `YYYY-MM-DD`
 */
export function promoteChangelog(text, version, date) {
  const marker = /^## \[Unreleased\][ \t]*\r?\n/m;
  if (!marker.test(text)) {
    throw new Error('CHANGELOG.md is missing the `## [Unreleased]` heading');
  }
  return text.replace(marker, `## [Unreleased]\n\n## [${version}] - ${date}\n`);
}

// ---------------------------------------------------------------------------
// Version edits for package.json + package-lock.json
// ---------------------------------------------------------------------------

/**
 * Bump version in `package.json` and `package-lock.json`, returning new
 * file contents. Only the top-level `version` and `packages[""].version`
 * fields are touched — never a dependency's range.
 *
 * Throws if either file's current top-level `version` does not match
 * `currentVersion` (so the caller can detect a stale or out-of-sync tree
 * before we silently rewrite the wrong number).
 *
 * Both outputs are JSON.stringify with 2-space indent + trailing newline,
 * matching the format that `npm@10` writes on this machine.
 *
 * @param {string} pkgText
 * @param {string} lockText
 * @param {string} currentVersion
 * @param {string} newVersion
 * @returns {{ pkg: string, lock: string }}
 */
export function applyVersionEdits(pkgText, lockText, currentVersion, newVersion) {
  // --- package.json ---
  const pkg = JSON.parse(pkgText);
  if (pkg.version !== currentVersion) {
    throw new Error(
      `package.json version is "${pkg.version}", expected "${currentVersion}"`
    );
  }
  pkg.version = newVersion;
  const newPkg = JSON.stringify(pkg, null, 2) + '\n';

  // --- package-lock.json ---
  const lock = JSON.parse(lockText);
  if (lock.version !== currentVersion) {
    throw new Error(
      `package-lock.json top-level "version" is "${lock.version}", expected "${currentVersion}"`
    );
  }
  lock.version = newVersion;

  if (lock.packages && typeof lock.packages[''] === 'object') {
    const root = lock.packages[''];
    if (root.version !== currentVersion) {
      throw new Error(
        `package-lock.json packages[""].version is "${root.version}", expected "${currentVersion}"`
      );
    }
    root.version = newVersion;
  }

  const newLock = JSON.stringify(lock, null, 2) + '\n';
  return { pkg: newPkg, lock: newLock };
}

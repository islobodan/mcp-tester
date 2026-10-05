import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';

const PACKAGE_NAME = '@slbdn/mcp-tester';

/**
 * Read `version` from a package.json if it belongs to this package.
 */
function readVersionFrom(packageJsonPath: string): string | undefined {
  try {
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as {
      name?: string;
      version?: string;
    };
    if (pkg.name === PACKAGE_NAME && typeof pkg.version === 'string') {
      return pkg.version;
    }
  } catch {
    // Ignore missing/invalid files and keep searching.
  }
  return undefined;
}

/**
 * Walk up from `start` looking for this package's package.json.
 */
function findVersionAbove(start: string): string | undefined {
  let dir = start;
  const root = parse(dir).root;
  for (;;) {
    const version = readVersionFrom(join(dir, 'package.json'));
    if (version) return version;
    if (dir === root) return undefined;
    dir = dirname(dir);
  }
}

let cachedVersion: string | undefined;

/**
 * Resolve the version of the installed `@slbdn/mcp-tester` package.
 *
 * Resolution order:
 * 1. The package installed as a dependency of the current project
 *    (works for consumers, using Node's resolution rather than `cwd`).
 * 2. Walking up from `process.cwd()` (works when running from the repo).
 * 3. Walking up from the running script (works for global CLI installs).
 *
 * Falls back to `'0.0.0'` if the version cannot be determined.
 */
export function getPackageVersion(): string {
  if (cachedVersion) return cachedVersion;

  // 1) Installed dependency of the current project.
  try {
    const requireFromCwd = createRequire(join(process.cwd(), 'noop.js'));
    const resolved = requireFromCwd.resolve(`${PACKAGE_NAME}/package.json`);
    const version = readVersionFrom(resolved);
    if (version) {
      cachedVersion = version;
      return cachedVersion;
    }
  } catch {
    // Not resolvable (e.g. running inside the repo itself) — keep looking.
  }

  // 2) Search upward from the current working directory.
  const fromCwd = findVersionAbove(process.cwd());
  if (fromCwd) {
    cachedVersion = fromCwd;
    return cachedVersion;
  }

  // 3) Search upward from the entry script (global CLI installs).
  const entry = process.argv[1];
  if (entry) {
    const fromEntry = findVersionAbove(dirname(entry));
    if (fromEntry) {
      cachedVersion = fromEntry;
      return cachedVersion;
    }
  }

  cachedVersion = '0.0.0';
  return cachedVersion;
}

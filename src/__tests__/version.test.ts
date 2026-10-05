import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getPackageVersion } from '../utils/version.js';

describe('getPackageVersion', () => {
  it('returns the version declared in this package.json', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8')) as {
      version: string;
    };
    expect(getPackageVersion()).toBe(pkg.version);
  });

  it('returns a semver-looking string', () => {
    expect(getPackageVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('is memoized across calls', () => {
    expect(getPackageVersion()).toBe(getPackageVersion());
  });
});

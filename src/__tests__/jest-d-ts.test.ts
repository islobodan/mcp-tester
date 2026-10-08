/**
 * Guard for the shipped consumer augmentation file.
 *
 * TypeScript does not type-check files outside `tsconfig.include`, so the
 * package-root `jest.d.ts` has no compiler coverage in this repo. This test
 * protects the two failure modes we have actually hit:
 *
 *   1. A glob such as `tests/**\/*.ts` in the JSDoc contains `*\/`, which
 *      closes the block comment early and makes the whole file a syntax error.
 *   2. A relative import (`./dist/matchers`) that only resolves in-repo and
 *      breaks as soon as a consumer copies the file into their project.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function findPackageRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 6; i++) {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8')) as {
        name?: string;
      };
      if (pkg.name === '@slbdn/mcp-tester') return dir;
    } catch {
      // keep walking up
    }
    dir = join(dir, '..');
  }
  throw new Error('could not locate @slbdn/mcp-tester package root');
}

const root = findPackageRoot(process.cwd());
const source = readFileSync(join(root, 'jest.d.ts'), 'utf-8');

describe('shipped jest.d.ts', () => {
  it('has exactly one block comment (no glob closes it early)', () => {
    expect(source.match(/\/\*\*/g) ?? []).toHaveLength(1);
    expect(source.match(/\*\//g) ?? []).toHaveLength(1);
  });

  it('imports MCPMatchers via the package specifier so copying works', () => {
    expect(source).toContain("from '@slbdn/mcp-tester/dist/matchers'");
    expect(source).not.toContain("from './dist/matchers'");
  });

  it('declares the expect augmentation', () => {
    expect(source).toContain("declare module 'expect'");
    expect(source).toContain('interface Matchers<');
  });

  it('is published (listed in package.json files)', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8')) as {
      files?: string[];
    };
    expect(pkg.files).toContain('jest.d.ts');
  });
});

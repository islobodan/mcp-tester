#!/usr/bin/env node
/**
 * Smoke-test the published artifact.
 *
 * Packs the package, installs the tarball into a clean temporary project, and
 * verifies that the documented root import resolves and exposes its public API.
 *
 * This catches packaging regressions (e.g. files omitted from the `files`
 * allowlist) that the Jest suite cannot, because tests run against `src/` via
 * ts-jest rather than the packed `dist/` output.
 *
 * Usage: `npm run test:package`
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: 'pipe', encoding: 'utf8' });

const root = process.cwd();
const work = mkdtempSync(join(tmpdir(), 'mcp-tester-pack-'));

try {
  console.log('▶ Building...');
  run('npm', ['run', 'build'], root);

  console.log('▶ Packing...');
  const packOutput = run('npm', ['pack', '--json', '--pack-destination', work], root);
  const [packed] = JSON.parse(packOutput);
  const tarball = join(work, packed.filename);
  console.log(`  packed ${packed.filename} (${packed.files.length} files)`);

  console.log('▶ Installing tarball into a clean project...');
  run('npm', ['init', '-y'], work);
  run('npm', ['install', '--no-audit', '--no-fund', tarball], work);

  console.log('▶ Importing @slbdn/mcp-tester...');
  const check = `
    const expected = [
      'MCPClient',
      'generateTests',
      'generateTypes',
      'generateTestsFromClient',
      'generateTypesFromClient',
      'setupJestMatchers',
      'setupVitestMatchers',
      'assert',
      'getPackageVersion',
      'generateToolArgs',
      'suggestEdgeCases',
      'suggestEdgeCasesForTools',
      'validateArgsAgainstSchema',
      'mergeAndValidateCases',
      'OpenAICompatProvider',
      'createProviderFromEnv',
      'suggestCasesWithAI',
    ];
    const mod = await import('@slbdn/mcp-tester');
    const missing = expected.filter((name) => !(name in mod));
    if (missing.length > 0) {
      console.error('✗ Missing exports: ' + missing.join(', '));
      process.exit(1);
    }
    const version = mod.getPackageVersion();
    console.log('  version ' + version + ', ' + expected.length + ' key exports present');
  `;
  const result = run('node', ['--input-type=module', '-e', check], work);
  console.log(result.trim());

  console.log('▶ Scaffolding a template via the packed CLI...');
  run('npx', ['mcp-tester', 'create', 'minimal-jest', 'scaffolded', '--no-install'], work);
  const scaffoldedPkg = readFileSync(join(work, 'scaffolded', 'package.json'), 'utf8');
  if (!scaffoldedPkg.includes('"name": "scaffolded"')) {
    throw new Error('Scaffolded package.json was not name-substituted from the destination dir');
  }
  console.log('  create minimal-jest → scaffolded OK (name substituted)');

  console.log('✔ Package smoke test passed');
} catch (error) {
  console.error('✗ Package smoke test failed');
  if (error.stdout) console.error(error.stdout.toString());
  if (error.stderr) console.error(error.stderr.toString());
  process.exitCode = 1;
} finally {
  rmSync(work, { recursive: true, force: true });
}

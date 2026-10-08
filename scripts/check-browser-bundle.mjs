#!/usr/bin/env node
/**
 * Browser bundle smoke test.
 *
 * Verifies that `@slbdn/mcp-tester` can be bundled for the browser without
 * pulling in Node built-ins. It simulates a real consumer by installing the
 * package into a throwaway project (via a symlink) and importing it by name,
 * then bundles with esbuild using `platform: 'browser'`.
 *
 * This exercises the `browser` field in `package.json`:
 *   - `./dist/index.js`            → `./dist/browser.js`
 *   - `./dist/utils/stdio-transport.js` → `false` (empty stub)
 *
 * Run after `npm run build`:
 *   npm run test:browser
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const browserEntry = join(root, 'dist', 'browser.js');

if (!existsSync(browserEntry)) {
  console.error('❌ dist/browser.js not found. Run `npm run build` first.');
  process.exit(1);
}

const consumerDir = mkdtempSync(join(tmpdir(), 'mcp-tester-browser-'));

try {
  // Simulate a consumer installing @slbdn/mcp-tester.
  const scopedDir = join(consumerDir, 'node_modules', '@slbdn');
  mkdirSync(scopedDir, { recursive: true });
  symlinkSync(root, join(scopedDir, 'mcp-tester'), 'dir');

  writeFileSync(
    join(consumerDir, 'entry.js'),
    [
      "import { MCPClient } from '@slbdn/mcp-tester';",
      "if (typeof MCPClient !== 'function') {",
      "  throw new Error('MCPClient export missing from browser entry');",
      '}',
      'export { MCPClient };',
      '',
    ].join('\n')
  );

  const outfile = join(consumerDir, 'bundle.js');
  await build({
    absWorkingDir: consumerDir,
    entryPoints: [join(consumerDir, 'entry.js')],
    bundle: true,
    platform: 'browser',
    format: 'esm',
    outfile,
    logLevel: 'silent',
  });

  const bundle = readFileSync(outfile, 'utf8');

  const problems = [];
  if (/node:[a-z_/]+/.test(bundle)) {
    problems.push(`bundle references Node built-ins: ${bundle.match(/node:[a-z_/]+/g).join(', ')}`);
  }
  if (bundle.includes('cross-spawn')) {
    problems.push('bundle includes the Node-only stdio transport (cross-spawn)');
  }
  if (!bundle.includes('WebSocket')) {
    problems.push('bundle does not include the WebSocket transport');
  }

  if (problems.length > 0) {
    console.error('❌ Browser bundle check failed:');
    for (const problem of problems) console.error(`   - ${problem}`);
    process.exit(1);
  }

  console.log(`✅ Browser bundle OK (${(bundle.length / 1024).toFixed(0)} KiB, no Node built-ins)`);
} finally {
  rmSync(consumerDir, { recursive: true, force: true });
}

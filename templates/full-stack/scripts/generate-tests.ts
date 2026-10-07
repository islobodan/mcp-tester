/**
 * Generate a fresh test file from the running server.
 *
 * Usage:
 *   1. Start your server in another terminal, OR
 *   2. Adjust the config below and run: `npm run gen:tests`
 *
 * Output is written to `tests/generated.test.ts`.
 */

import { generateTests } from '@slbdn/mcp-tester';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, '..', 'tests', 'generated.test.ts');

const code = await generateTests({
  command: 'node',
  args: ['./examples/mock-server.js'],
  framework: 'jest',
  description: 'Generated test suite',
  includeResources: true,
  includePrompts: true,
  includeTools: true,
  includeMatchers: true,
});

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, code, 'utf-8');
console.log(`✓ Wrote ${outPath}`);
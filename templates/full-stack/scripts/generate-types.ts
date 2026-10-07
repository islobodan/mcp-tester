/**
 * Generate TypeScript types from the server's tool schemas.
 *
 * Usage: `npm run gen:types`
 *
 * Output is written to `src/generated-types.ts`.
 *
 * After generation, you can import the typed tool map and call:
 *   import { ToolArgsMap } from './generated-types.js';
 *   await client.callTool<ToolArgsMap['sum']>({ name: 'sum', arguments: { numbers: [1,2,3] } });
 */

import { generateTypes } from '@slbdn/mcp-tester';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, '..', 'src', 'generated-types.ts');

const code = await generateTypes({
  command: 'node',
  args: ['./examples/mock-server.js'],
});

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, code, 'utf-8');
console.log(`✓ Wrote ${outPath}`);
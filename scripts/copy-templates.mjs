#!/usr/bin/env node
/**
 * Copies `templates/` to `dist/templates/` so the published CLI can find
 * starter templates via fileURL resolution relative to dist/cli/index.js.
 *
 * Idempotent; safe to run repeatedly.
 */

import { cpSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');
const src = join(repoRoot, 'templates');
const dest = join(repoRoot, 'dist', 'templates');

if (!existsSync(src)) {
  console.warn(`templates/ not found at ${src}; skipping copy.`);
  process.exit(0);
}

// Wipe and re-copy so deletes in source propagate to dist.
if (existsSync(dest)) {
  rmSync(dest, { recursive: true, force: true });
}
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`✓ Copied templates → ${dest}`);
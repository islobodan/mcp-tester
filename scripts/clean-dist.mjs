#!/usr/bin/env node
/**
 * Remove dist/ before a build (npm prebuild hook).
 *
 * `tsc` never cleans stale output, so files removed from src/ (e.g. tests that
 * were once compiled into dist/__tests__) would otherwise linger in dist/ and
 * get shipped in the npm package. Cross-platform (no `rm -rf`).
 */

import { rmSync } from 'node:fs';

rmSync(new URL('../dist', import.meta.url), { recursive: true, force: true });

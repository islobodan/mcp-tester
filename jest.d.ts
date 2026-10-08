/**
 * Jest type declarations for MCP Tester custom matchers.
 *
 * IMPORTANT: TypeScript does NOT propagate `declare module 'expect' { ... }`
 * augmentations across `node_modules` boundaries. A `.d.ts` file inside a
 * package cannot augment the consumer's `expect` type — the augmentation
 * only takes effect when the declaring file is part of the consumer's own
 * compilation (i.e. included by their tsconfig or referenced from a file
 * the consumer owns).
 *
 * This is a known TypeScript limitation that also affects libraries like
 * `jest-extended`. See https://github.com/microsoft/TypeScript/issues/15031
 *
 * Setup (pick one):
 *
 *   1. Copy this file into your project root (or `tests/`) and include it
 *      in your `tsconfig.json`:
 *        "include": ["jest.d.ts", "tests/**/*.ts"]
 *
 *   2. Inline the augmentation in your own `tests.d.ts` / `global.d.ts`:
 *        import type { MCPMatchers } from '@slbdn/mcp-tester/dist/matchers';
 *        declare module 'expect' {
 *          interface Matchers<R extends void | Promise<void>, T = unknown> extends MCPMatchers<R> {}
 *        }
 *
 *   3. Use Vitest instead (the `vitest` package's module structure accepts
 *      the augmentation directly; just install vitest and import
 *      `setupVitestMatchers`).
 *
 * Without one of these, the matchers still RUN at runtime (via
 * `expect.extend`) but will not be type-checked by `tsc`.
 *
 * Then in your test setup:
 *   import { setupJestMatchers } from '@slbdn/mcp-tester';
 *   beforeAll(() => setupJestMatchers());
 */

import type { MCPMatchers } from './dist/matchers';

declare module 'expect' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars -- module augmentation requires an interface; T matches `expect`'s arity
  interface Matchers<R extends void | Promise<void>, T = unknown> extends MCPMatchers<R> {}
}

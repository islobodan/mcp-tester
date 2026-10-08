/**
 * Type-level smoke test: verifies the Jest matchers' `declare module 'expect'`
 * augmentation works when the file is part of the consumer's compilation
 * (mirroring what real consumers must do — see `jest.d.ts` for details).
 *
 * The augmentation block is inlined here to make the test self-contained and
 * exercise the exact contract a consumer sees after copying `jest.d.ts` into
 * their project.
 *
 * @ts-expect-error -- intentional inline augmentation; this file is type-only and never executed
 */

import { describe, it, expect } from '@jest/globals';
import type { MCPMatchers } from '../matchers.js';
import { setupJestMatchers } from '../index.js';

declare module 'expect' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars -- module augmentation requires an interface; T matches `expect`'s arity
  interface Matchers<R extends void | Promise<void>, T = unknown> extends MCPMatchers<R> {}
}

setupJestMatchers();

describe('jest matchers augmentation (inline)', () => {
  it('type-checks every MCP matcher', () => {
    const tools = [{ name: 'echo', description: '', inputSchema: { type: 'object' as const } }];
    const resources = [{ uri: 'config://x', name: 'x' }];
    const prompts = [{ name: 'greet', arguments: [{ name: 'who', required: false }] }];
    const result = { content: [{ type: 'text' as const, text: 'hi' }], isError: true };
    const resResult = { contents: [{ uri: 'x', text: 'y' }] };
    const promptResult = {
      messages: [{ role: 'user' as const, content: { type: 'text' as const, text: 'hi' } }],
    };

    // All 20 matchers should type-check
    expect(tools).toHaveTool('echo');
    expect(tools).toHaveToolWithSchema('echo');
    expect(tools).toHaveToolCount(1);
    expect(resources).toHaveResource('config://x');
    expect(resources).toHaveResourceByName('x');
    expect(resources).toHaveResourceCount(1);
    expect(prompts).toHavePrompt('greet');
    expect(prompts).toHavePromptWithArgs('greet');
    expect(prompts).toHavePromptCount(1);
    expect(result).toReturnText('hi');
    expect(result).toReturnTextContaining('hi');
    expect(result).toReturnError();
    expect({ ...result, isError: false }).toReturnOk();
    expect({ ...result, content: [{ type: 'text' as const, text: '{"ok":true}' }] }).toReturnJson({
      ok: true,
    });
    expect(result).toReturnContentCount(1);
    expect({
      content: [{ type: 'image' as const, data: 'x', mimeType: 'image/png' }],
    }).toReturnImage();
    expect(resResult).toReturnResourceText('y');
    expect(resResult).toReturnResourceTextContaining('y');
    expect(promptResult).toReturnPromptTextContaining('hi');
    expect(promptResult).toReturnPromptMessageCount(1);
  });
});

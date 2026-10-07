/**
 * Prompt tests.
 */

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { MCPClient } from '@slbdn/mcp-tester';
import { createConnectedClient } from './helpers.js';

describe('Prompts', () => {
  let client: MCPClient;

  beforeAll(async () => {
    client = await createConnectedClient('prompts-test');
  });

  afterAll(async () => {
    if (client?.isConnected()) {
      await client.stop();
    }
  });

  it('lists available prompts', async () => {
    const prompts = await client.listPrompts();
    expect(prompts.map((p) => p.name)).toContain('greet');
  });

  it('gets the greet prompt with arguments', async () => {
    const result = await client.getPrompt('greet', { user: 'Alice' });
    expect(result.messages.length).toBeGreaterThan(0);
    const text = result.messages[0].content.text;
    expect(text).toContain('Alice');
  });

  it('rejects unknown prompts', async () => {
    await expect(client.getPrompt('unknown-prompt')).rejects.toThrow();
  });
});
/**
 * Example test file demonstrating use of test helpers and matchers
 *
 * Run: npm test helpers-example.test.ts
 */

import { MCPClient } from '../client/MCPClient.js';
import { createTestClient } from './helpers.js';
import { MockMCPServer } from './fixtures/mock-server.js';
import { toHaveTool, toHaveResource, toHavePrompt } from './matchers.js';

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Register custom matchers
expect.extend({ toHaveTool, toHaveResource, toHavePrompt });

describe('Example Test - Using Helpers and Matchers', () => {
  let mockServer: MockMCPServer;

  beforeEach(() => {
    mockServer = new MockMCPServer();
  });

  it('should list tools using helper', async () => {
    const result = await mockServer.handleToolsList();

    expect(result.tools).toBeDefined();
    expect(result.tools.length).toBeGreaterThan(0);

    // Using custom matcher
    // @ts-ignore - Custom matcher
    expect(result.tools).toHaveTool('echo');
  });

  it('should list resources using helper', async () => {
    const result = await mockServer.handleResourcesList();

    expect(result.resources).toBeDefined();
    expect(result.resources.length).toBeGreaterThan(0);

    // Using custom matcher
    // @ts-ignore - Custom matcher
    expect(result.resources).toHaveResource('text://example');
  });

  it('should list prompts using helper', async () => {
    const result = await mockServer.handlePromptsList();

    expect(result.prompts).toBeDefined();
    expect(result.prompts.length).toBeGreaterThan(0);

    // Using custom matcher
    // @ts-ignore - Custom matcher
    expect(result.prompts).toHavePrompt('greet');
  });

  it('should call tool using mock server', async () => {
    const result = await mockServer.handleToolCall('echo', { message: 'test' });

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content[0].text).toBe('Echo: test');
  });
});

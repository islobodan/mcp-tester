/**
 * Example test file demonstrating use of test helpers and matchers
 *
 * Run: npm test helpers-example.test.ts
 */

import { MCPClient } from '../client/MCPClient.js';
import {
  createTestSuite,
  createMockServerConfig,
  callTool,
} from './helpers.js';

// Note: Custom matchers are auto-registered in matchers.ts
import { toHaveTool, toHaveResource, toHavePrompt } from './matchers.js';

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('Example Test - Using Helpers and Matchers', () => {
  const testSuite = createTestSuite(
    createMockServerConfig(['./fixtures/mock-server.js'])
  );

  beforeEach(async () => {
    await testSuite.setup();
  });

  afterEach(async () => {
    await testSuite.teardown();
  });

  it('should list tools using helper', async () => {
    const tools = await testSuite.client.listTools();

    expect(tools).toBeDefined();
    expect(tools.length).toBeGreaterThan(0);

    // Using custom matcher (type assertion for demonstration)
    // @ts-ignore - Custom matcher not recognized by TypeScript
    expect(tools).toHaveTool('echo');
  });

  it('should list resources using helper', async () => {
    const resources = await testSuite.client.listResources();

    expect(resources).toBeDefined();
    expect(resources.length).toBeGreaterThan(0);

    // Using custom matcher (type assertion for demonstration)
    // @ts-ignore - Custom matcher not recognized by TypeScript
    expect(resources).toHaveResource('text://example');
  });

  it('should list prompts using helper', async () => {
    const prompts = await testSuite.client.listPrompts();

    expect(prompts).toBeDefined();
    expect(prompts.length).toBeGreaterThan(0);

    // Using custom matcher (type assertion for demonstration)
    // @ts-ignore - Custom matcher not recognized by TypeScript
    expect(prompts).toHavePrompt('greeting');
  });

  it('should call tool using helper', async () => {
    const result = await callTool(testSuite.client, 'echo', {
      message: 'test',
    });

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
  });
});

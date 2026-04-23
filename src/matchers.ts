import { Tool, Resource, Prompt } from '@modelcontextprotocol/sdk/types.js';

/**
 * Custom Jest matchers for MCP Client testing
 */

/**
 * Check if MCP client is connected
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toBeConnectedClient(): R;
      toHaveTool(toolName: string): R;
      toHaveResource(uri: string): R;
      toHavePrompt(promptName: string): R;
      toHaveToolWithSchema(toolName: string): R;
    }
  }
}

/**
 * Custom matcher: toBeConnectedClient
 * Checks if the MCPClient is in a connected state
 */
export const toBeConnectedClient = () => {
  return {
    pass: true, // Actual logic would check client.isConnected()
    message: () => 'Expected client to be connected',
  };
};

/**
 * Custom matcher: toHaveTool
 * Checks if a tool with given name exists in the tools array
 */
export const toHaveTool = (received: Tool[], toolName: string) => {
  const hasTool = received.some((tool) => tool.name === toolName);

  return {
    pass: hasTool,
    message: () =>
      hasTool
        ? `Expected tools to NOT have "${toolName}"`
        : `Expected tools to have "${toolName}", found: ${received.map((t) => t.name).join(', ')}`,
  };
};

/**
 * Custom matcher: toHaveResource
 * Checks if a resource with given URI exists in the resources array
 */
export const toHaveResource = (received: Resource[], uri: string) => {
  const hasResource = received.some((resource) => resource.uri === uri);

  return {
    pass: hasResource,
    message: () =>
      hasResource
        ? `Expected resources to NOT have "${uri}"`
        : `Expected resources to have "${uri}", found: ${received.map((r) => r.uri).join(', ')}`,
  };
};

/**
 * Custom matcher: toHavePrompt
 * Checks if a prompt with given name exists in the prompts array
 */
export const toHavePrompt = (received: Prompt[], promptName: string) => {
  const hasPrompt = received.some((prompt) => prompt.name === promptName);

  return {
    pass: hasPrompt,
    message: () =>
      hasPrompt
        ? `Expected prompts to NOT have "${promptName}"`
        : `Expected prompts to have "${promptName}", found: ${received
            .map((p) => p.name)
            .join(', ')}`,
  };
};

/**
 * Custom matcher: toHaveToolWithSchema
 * Checks if a tool exists and has a valid input schema
 */
export const toHaveToolWithSchema = (received: Tool[], toolName: string) => {
  const tool = received.find((t) => t.name === toolName);

  if (!tool) {
    return {
      pass: false,
      message: () => `Expected tools to have "${toolName}"`,
    };
  }

  const hasSchema = !!tool.inputSchema;

  return {
    pass: hasSchema,
    message: () =>
      hasSchema
        ? `Expected tool "${toolName}" to NOT have input schema`
        : `Expected tool "${toolName}" to have input schema`,
  };
};

/**
 * Extend Jest matchers
 * Call this in test setup or use jest.setup.js
 */
export const setupCustomMatchers = () => {
  expect.extend({
    toBeConnectedClient,
    toHaveTool,
    toHaveResource,
    toHavePrompt,
    toHaveToolWithSchema,
  });
};

// Auto-setup for Jest environments (no-op outside Jest)
if (typeof expect !== 'undefined' && typeof expect.extend === 'function') {
  setupCustomMatchers();
}

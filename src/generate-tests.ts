/**
 * Test code generator — connects to an MCP server, inspects its capabilities,
 * and generates a ready-to-run Jest/Vitest test file.
 *
 * @module generate-tests
 */

import { MCPClient } from './client/MCPClient.js';
import type { ServerConfig, StdioServerConfig } from './client/MCPClient.js';
import type { Tool, Resource, Prompt } from '@modelcontextprotocol/sdk/types.js';
import { getPackageVersion } from './utils/version.js';

/**
 * Options for test generation.
 */
export interface GenerateTestOptions {
  /** Command to run the MCP server. */
  command: string;
  /** Arguments for the server command. */
  args?: string[];
  /** Test framework to target. @defaultValue 'jest' */
  framework?: 'jest' | 'vitest';
  /** Include resource tests. @defaultValue true */
  includeResources?: boolean;
  /** Include prompt tests. @defaultValue true */
  includePrompts?: boolean;
  /** Include tool call tests. @defaultValue true */
  includeTools?: boolean;
  /** Include matchers import. @defaultValue true */
  includeMatchers?: boolean;
  /** Timeout in ms for connecting to the server. @defaultValue 30000 */
  timeout?: number;
  /** Description for the test suite. */
  description?: string;
}

/**
 * Generate sample arguments from a JSON Schema property.
 */
function generateSampleValue(schema: Record<string, unknown>): unknown {
  const type = schema.type as string | undefined;
  const examples = schema.examples as unknown[];
  const enumValues = schema['enum'] as unknown[];

  if (enumValues && enumValues.length > 0) return enumValues[0];
  if (examples && examples.length > 0) return examples[0];
  if (schema.default !== undefined) return schema.default;

  switch (type) {
    case 'string':
      return schema.description
        ? `example-${String(schema.description).toLowerCase().replace(/\s+/g, '-')}`
        : 'example';
    case 'number':
    case 'integer':
      return 42;
    case 'boolean':
      return true;
    case 'array':
      if (schema.items && typeof schema.items === 'object') {
        return [generateSampleValue(schema.items as Record<string, unknown>)];
      }
      return [];
    case 'object':
      return {};
    default:
      return 'example';
  }
}

/**
 * Generate sample arguments from a tool's input schema.
 */
function generateToolArgs(tool: Tool): Record<string, unknown> {
  const schema = tool.inputSchema;
  if (!schema || !schema.properties) return {};

  const args: Record<string, unknown> = {};
  const props = schema.properties as Record<string, Record<string, unknown>>;
  const required = new Set((schema.required as string[]) || []);

  // Generate values for all required fields, and optional ones with defaults
  for (const [key, propSchema] of Object.entries(props)) {
    if (required.has(key) || propSchema.default !== undefined) {
      args[key] = generateSampleValue(propSchema);
    }
  }

  // If no required fields, generate at least one so the test is useful
  if (Object.keys(args).length === 0 && Object.keys(props).length > 0) {
    const firstKey = Object.keys(props)[0];
    args[firstKey] = generateSampleValue(props[firstKey]);
  }

  return args;
}

/**
 * Build the `client.start({ ... })` config literal for the generated test.
 * Uses JSON.stringify for values so quotes/backslashes are safely escaped.
 */
function formatServerStart(server: ServerConfig): string {
  if (server.transport === 'http' || server.transport === 'sse') {
    const parts = [`transport: '${server.transport}'`, `url: ${JSON.stringify(server.url)}`];
    if (server.headers && Object.keys(server.headers).length > 0) {
      parts.push(`headers: ${JSON.stringify(server.headers)}`);
    }
    return parts.join(',\n      ');
  }

  const stdio = server as StdioServerConfig;
  const parts = [`command: ${JSON.stringify(stdio.command)}`];
  if (stdio.args && stdio.args.length > 0) {
    parts.push(`args: ${JSON.stringify(stdio.args)}`);
  }
  return parts.join(',\n      ');
}

/** Human-readable server target for the generated file header. */
function formatServerLabel(server: ServerConfig): string {
  if (server.transport === 'http' || server.transport === 'sse') {
    return `${server.transport} ${server.url}`;
  }
  const stdio = server as StdioServerConfig;
  return `${stdio.command}${stdio.args && stdio.args.length > 0 ? ' ' + stdio.args.join(' ') : ''}`;
}

/**
 * Generate tool test cases.
 */
function generateToolTests(tools: Tool[]): string {
  if (tools.length === 0) return '';

  const lines: string[] = ["  describe('Tools', () => {"];

  for (const tool of tools) {
    const sampleArgs = generateToolArgs(tool);
    const argsStr = Object.keys(sampleArgs).length > 0 ? JSON.stringify(sampleArgs) : '{}';

    lines.push('');
    lines.push(`    it('should have tool "${tool.name}"', async () => {`);
    lines.push('      const tools = await client.listTools();');
    lines.push(`      expect(tools).toHaveTool('${tool.name}');`);
    lines.push('    });');
    lines.push('');

    // Call test. Generated arguments are guesses, and some tools intentionally
    // return/throw errors — so accept a successful result or a tool-level error.
    lines.push(`    it('should call "${tool.name}"', async () => {`);
    lines.push('      const result = await client.callTool({');
    lines.push(`        name: '${tool.name}',`);
    lines.push(`        arguments: ${argsStr},`);
    lines.push('      }).catch((error: unknown) => error);');
    lines.push('      expect(result).toBeDefined();');
    lines.push('    });');
  }

  lines.push('  });');
  return lines.join('\n');
}

/**
 * Generate resource test cases.
 */
function generateResourceTests(resources: Resource[]): string {
  if (resources.length === 0) return '';

  const lines: string[] = ["  describe('Resources', () => {"];

  for (const resource of resources) {
    lines.push('');
    lines.push(`    it('should have resource "${resource.uri}"', async () => {`);
    lines.push('      const resources = await client.listResources();');
    lines.push(`      expect(resources).toHaveResource('${resource.uri}');`);
    lines.push('    });');
    lines.push('');
    lines.push(`    it('should read resource "${resource.uri}"', async () => {`);
    lines.push(`      const result = await client.readResource('${resource.uri}');`);
    lines.push('      expect(result.contents).toBeDefined();');
    lines.push('      expect(result.contents.length).toBeGreaterThan(0);');
    lines.push('    });');
  }

  lines.push('  });');
  return lines.join('\n');
}

/**
 * Generate prompt test cases.
 */
function generatePromptTests(prompts: Prompt[]): string {
  if (prompts.length === 0) return '';

  const lines: string[] = ["  describe('Prompts', () => {"];

  for (const prompt of prompts) {
    // Generate sample args from prompt arguments
    const promptArgs: Record<string, string> = {};
    if (prompt.arguments && Array.isArray(prompt.arguments)) {
      for (const arg of prompt.arguments) {
        if (arg.required) {
          promptArgs[arg.name] = `example-${arg.name}`;
        }
      }
    }

    const argsStr = Object.keys(promptArgs).length > 0 ? `, ${JSON.stringify(promptArgs)}` : '';

    lines.push('');
    lines.push(`    it('should have prompt "${prompt.name}"', async () => {`);
    lines.push('      const prompts = await client.listPrompts();');
    lines.push(`      expect(prompts).toHavePrompt('${prompt.name}');`);
    lines.push('    });');
    lines.push('');
    lines.push(`    it('should get prompt "${prompt.name}"', async () => {`);
    lines.push(`      const result = await client.getPrompt('${prompt.name}'${argsStr});`);
    lines.push('      expect(result.messages).toBeDefined();');
    lines.push('      expect(result.messages.length).toBeGreaterThan(0);');
    lines.push('    });');
  }

  lines.push('  });');
  return lines.join('\n');
}

/**
 * Options consumed by {@link buildTestFile} (server description is passed separately).
 */
type TestBuildOptions = Pick<
  GenerateTestOptions,
  | 'framework'
  | 'description'
  | 'includeResources'
  | 'includePrompts'
  | 'includeTools'
  | 'includeMatchers'
>;

/**
 * Generate a complete test file.
 */
function buildTestFile(
  tools: Tool[],
  resources: Resource[],
  prompts: Prompt[],
  options: TestBuildOptions,
  server: ServerConfig
): string {
  const framework = options.framework || 'jest';
  const description = options.description || 'MCP Server';
  const startCmd = formatServerStart(server);
  const serverLabel = formatServerLabel(server);
  const includeMatchers = options.includeMatchers !== false;

  // Imports
  const importLines: string[] = [];
  // Triple-slash type directive must appear at the very top of the file.
  let vitestReference = '';

  if (framework === 'vitest') {
    importLines.push(
      "import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';"
    );
    const extraImports = includeMatchers ? ', setupVitestMatchers' : '';
    importLines.push(`import { MCPClient${extraImports} } from '@slbdn/mcp-tester';`);
    if (includeMatchers) {
      vitestReference = '/// <reference types="@slbdn/mcp-tester/vitest" />\n\n';
    }
  } else {
    importLines.push(
      "import { describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';"
    );
    const extraImports = includeMatchers ? ', setupJestMatchers' : '';
    importLines.push(`import { MCPClient${extraImports} } from '@slbdn/mcp-tester';`);
  }

  // Header comment
  const header = [
    '/**',
    ` * Generated test file for: ${description}`,
    ' *',
    ` * Framework: ${framework}`,
    ` * Server: ${serverLabel}`,
    ` * Tools: ${tools.length} | Resources: ${resources.length} | Prompts: ${prompts.length}`,
    ' *',
    ` * Generated by @slbdn/mcp-tester v${getPackageVersion()}`,
    ' * Run: npx jest --testTimeout=30000 (or npx vitest run)',
    ' */',
  ].join('\n');

  // Test sections
  const toolTests = options.includeTools !== false ? generateToolTests(tools) : '';
  const resourceTests = options.includeResources !== false ? generateResourceTests(resources) : '';
  const promptTests = options.includePrompts !== false ? generatePromptTests(prompts) : '';

  // Combine
  const sections = [toolTests, resourceTests, promptTests].filter(Boolean);

  const beforeAllLine = includeMatchers
    ? framework === 'vitest'
      ? 'beforeAll(() => setupVitestMatchers());'
      : 'beforeAll(() => setupJestMatchers());'
    : '';

  return `${vitestReference}${header}

${importLines.join('\n')}

${beforeAllLine}
describe('${description}', () => {
  let client: MCPClient;

  beforeEach(async () => {
    client = new MCPClient({
      name: 'test-client',
      version: '1.0.0',
    });
    await client.start({
      ${startCmd}
    });
  });

  afterEach(async () => {
    if (client.isConnected()) {
      await client.stop();
    }
  });

  it('should connect to the server', () => {
    expect(client.isConnected()).toBe(true);
  });

  it('should list tools', async () => {
    const tools = await client.listTools();
    expect(Array.isArray(tools)).toBe(true);
  });

${sections.join('\n\n')}
});
`;
}

/**
 * Connect to an MCP server, inspect capabilities, and generate a test file.
 *
 * @returns The generated test file content
 */
export async function generateTests(options: GenerateTestOptions): Promise<string> {
  const client = new MCPClient({
    name: 'mcp-tester-generate',
    version: '1.0.0',
    timeout: options.timeout || 30000,
    logLevel: 'none',
  });

  try {
    await client.start({
      command: options.command,
      args: options.args,
    });

    const [tools, resources, prompts] = await Promise.all([
      client.listTools(),
      client.listResources(),
      client.listPrompts(),
    ]);

    const server: StdioServerConfig = { command: options.command, args: options.args };
    return buildTestFile(tools, resources, prompts, options, server);
  } finally {
    await client.stop();
  }
}

/**
 * Options for {@link generateTestsFromClient}.
 */
export type GenerateTestsFromClientOptions = Pick<
  GenerateTestOptions,
  | 'framework'
  | 'description'
  | 'includeResources'
  | 'includePrompts'
  | 'includeTools'
  | 'includeMatchers'
>;

/**
 * Generate a test file from an already-connected client.
 *
 * Unlike {@link generateTests}, this supports any transport (stdio, HTTP, SSE)
 * because the caller owns the connection. The generated test file embeds the
 * supplied `server` config so it can reconnect on its own.
 *
 * @param client - A connected MCPClient instance
 * @param server - The config the generated test should use to connect
 * @param options - Generation options
 * @returns The generated test file content
 */
export async function generateTestsFromClient(
  client: MCPClient,
  server: ServerConfig,
  options: GenerateTestsFromClientOptions = {}
): Promise<string> {
  const [tools, resources, prompts] = await Promise.all([
    options.includeTools === false ? Promise.resolve([]) : client.listTools(),
    options.includeResources === false ? Promise.resolve([]) : client.listResources(),
    options.includePrompts === false ? Promise.resolve([]) : client.listPrompts(),
  ]);

  return buildTestFile(tools, resources, prompts, options, server);
}

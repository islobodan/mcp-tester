/**
 * Test code generator — connects to an MCP server, inspects its capabilities,
 * and generates a ready-to-run Jest/Vitest test file.
 *
 * @module generate-tests
 */

import { MCPClient } from './client/MCPClient.js';
import type { Tool, Resource, Prompt } from '@modelcontextprotocol/sdk/types.js';
import { readFileSync } from 'fs';
import { join } from 'path';

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
 * Build the server start command string for the generated test.
 */
function formatStartCommand(command: string, args?: string[]): string {
  const parts = [`command: '${command}'`];
  if (args && args.length > 0) {
    parts.push(`args: ['${args.join("', '")}']`);
  }
  return parts.join(',\n      ');
}

/**
 * Generate tool test cases.
 */
function generateToolTests(tools: Tool[]): string {
  if (tools.length === 0) return '';

  const lines: string[] = ["  describe('Tools', () => {"];

  for (const tool of tools) {
    const sampleArgs = generateToolArgs(tool);
    const argsStr =
      Object.keys(sampleArgs).length > 0
        ? JSON.stringify(sampleArgs, null, 4).replace(/\n/g, '\n        ')
        : '{}';
    const hasArgs = Object.keys(sampleArgs).length > 0;

    lines.push('');
    lines.push(`    it('should have tool "${tool.name}"', async () => {`);
    lines.push('      const tools = await client.listTools();');
    lines.push(`      expect(tools).toHaveTool('${tool.name}');`);
    lines.push('    });');
    lines.push('');

    // Call test
    lines.push(`    it('should call "${tool.name}" successfully', async () => {`);
    lines.push('      const result = await client.callTool({');
    lines.push(`        name: '${tool.name}',`);
    lines.push(`        arguments: ${argsStr},`);
    lines.push('      });');
    lines.push('      expect(result.content).toBeDefined();');
    lines.push('      expect(result.content.length).toBeGreaterThan(0);');
    lines.push('    });');

    // Add assertion test for tools with known return types
    if (hasArgs) {
      lines.push('');
      lines.push(`    it('should return valid result from "${tool.name}"', async () => {`);
      lines.push('      const result = await client.callTool({');
      lines.push(`        name: '${tool.name}',`);
      lines.push(`        arguments: ${argsStr},`);
      lines.push('      });');
      lines.push('      expect(result).toReturnOk();');
      lines.push('    });');
    }
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
 * Generate a complete test file.
 */
function buildTestFile(
  tools: Tool[],
  resources: Resource[],
  prompts: Prompt[],
  options: GenerateTestOptions
): string {
  const framework = options.framework || 'jest';
  const description = options.description || 'MCP Server';
  const startCmd = formatStartCommand(options.command, options.args);
  const includeMatchers = options.includeMatchers !== false;

  // Imports
  const importLines: string[] = [];

  if (framework === 'vitest') {
    importLines.push(
      "import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';"
    );
    const extraImports = includeMatchers ? ', setupVitestMatchers' : '';
    importLines.push(`import { MCPClient${extraImports} } from '@slbdn/mcp-tester';`);
    if (includeMatchers) {
      importLines.push('// /// <reference types="@slbdn/mcp-tester/vitest" />');
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
    ` * Server: ${options.command}${options.args ? ' ' + options.args.join(' ') : ''}`,
    ` * Tools: ${tools.length} | Resources: ${resources.length} | Prompts: ${prompts.length}`,
    ' *',
    ` * Generated by @slbdn/mcp-tester v${getVersion()}`,
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

  return `${header}

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
 * Get the package version.
 */
function getVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
    if (pkg.name === '@slbdn/mcp-tester') return pkg.version || '1.0.0';
  } catch {
    /* fallback */
  }
  return '1.0.0';
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

    return buildTestFile(tools, resources, prompts, options);
  } finally {
    await client.stop();
  }
}

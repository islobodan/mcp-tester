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
import {
  type GeneratedCase,
  generateToolArgs,
  suggestEdgeCasesForTools,
  mergeAndValidateCases,
} from './generate-cases.js';
import {
  type AIProvider,
  type ServerAnalysis,
  type OpenAICompatOptions,
  createProviderFromEnv,
} from './ai/provider.js';

/**
 * How test cases are derived.
 *
 * - `'static'` — the classic generator: one listing test + one probe call per
 *   tool. @defaultValue
 * - `'edge'` — additionally derives boundary/invalid cases from each tool's
 *   JSON Schema (offline, deterministic).
 * - `'ai'` — edge cases plus AI-suggested cases. Requires a provider (see
 *   {@link GenerateTestOptions.provider} or the `MCP_TESTER_AI_*` env vars);
 *   falls back to `'edge'` with a warning unless {@link GenerateTestOptions.requireAi}
 *   is set.
 */
export type GenerationMode = 'static' | 'edge' | 'ai';

/** AI configuration accepted by the generate functions. */
export interface AIOptions extends OpenAICompatOptions {
  /** Fail instead of falling back to deterministic cases when AI is unavailable. @defaultValue false */
  requireAi?: boolean;
}

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
  /** How test cases are derived. @defaultValue 'static' */
  mode?: GenerationMode;
  /** Pre-built AI provider; overrides env-based discovery. */
  provider?: AIProvider;
  /** AI provider configuration (used when `provider` is not supplied). */
  ai?: AIOptions;
  /** Dry-run every derived case against the live server and annotate the
   *  generated tests with what actually happens. @defaultValue false */
  verify?: boolean;
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
 * Render one derived test case as an `it(...)` block.
 */
function generateCaseTest(c: GeneratedCase): string[] {
  const lines: string[] = [];
  const argsStr = JSON.stringify(c.args);

  lines.push(`    // ${c.source} — ${c.rationale}`);
  // --verify found the server behaving differently than predicted: keep the
  // case for visibility but skip it, and say what actually happened.
  if (c.observed && c.expectation !== 'observe' && c.observed !== c.expectation) {
    lines.push(
      `    // verify: expected ${c.expectation} but server returned ${c.observed} — adjust manually`
    );
    lines.push(`    it.skip('${escapeJsString(c.title)}', async () => {`);
    lines.push('      const result = await client.callTool({');
    lines.push(`        name: '${toolNameLiteral(c.tool)}',`);
    lines.push(`        arguments: ${argsStr},`);
    lines.push('      }).catch((error: unknown) => error);');
    lines.push('      expect(result).toBeDefined();');
    lines.push('    });');
    return lines;
  }

  if (c.expectation === 'observe') {
    lines.push(`    it('${escapeJsString(c.title)}', async () => {`);
    lines.push('      const result = await client.callTool({');
    lines.push(`        name: '${toolNameLiteral(c.tool)}',`);
    lines.push(`        arguments: ${argsStr},`);
    lines.push('      }).catch((error: unknown) => error);');
    lines.push('      // Observation only — record what the server actually does.');
    lines.push('      expect(result).toBeDefined();');
    lines.push('      console.log(`[${c.tool}] ${JSON.stringify(result)}`);');
    lines.push('    });');
  } else if (c.expectation === 'error') {
    lines.push(`    it('${escapeJsString(c.title)}', async () => {`);
    lines.push('      const result = await client.callTool({');
    lines.push(`        name: '${toolNameLiteral(c.tool)}',`);
    lines.push(`        arguments: ${argsStr},`);
    lines.push('      }).catch((error: unknown) => error);');
    lines.push('      expect(isToolError(result)).toBe(true);');
    lines.push('    });');
  } else {
    lines.push(`    it('${escapeJsString(c.title)}', async () => {`);
    lines.push('      const result = await client.callTool({');
    lines.push(`        name: '${toolNameLiteral(c.tool)}',`);
    lines.push(`        arguments: ${argsStr},`);
    lines.push('      }).catch((error: unknown) => error);');
    lines.push('      expect(isToolError(result)).toBe(false);');
    lines.push('    });');
  }
  return lines;
}

/** Escape a string for use inside a single- or double-quoted JavaScript literal. */
export function escapeJsString(s: string, quote: "'" | '"' = "'"): string {
  // Escape backslashes first, then the chosen quote, then newlines/control chars.
  return (
    s
      .replace(/\\/g, '\\\\')
      .replace(new RegExp(quote, 'g'), `\\${quote}`)
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
      // eslint-disable-next-line no-control-regex -- intentional: we want to escape ASCII control chars in user-provided strings
      .replace(/[\u0000-\u001f]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`)
  );
}

/** Emit a safe single-quoted string literal for a tool name. */
function toolNameLiteral(name: string): string {
  return escapeJsString(name, "'");
}

/**
 * Generate tool test cases.
 */
function generateToolTests(tools: Tool[], cases: GeneratedCase[] = []): string {
  if (tools.length === 0) return '';

  const lines: string[] = ["  describe('Tools', () => {"];

  if (cases.length > 0) {
    lines.push('    const isToolError = (res: unknown): boolean =>');
    lines.push('      res instanceof Error ||');
    lines.push(
      '      (typeof res === "object" && res !== null && (res as { isError?: unknown }).isError === true);'
    );
  }

  for (const tool of tools) {
    const sampleArgs = generateToolArgs(tool);
    const argsStr = Object.keys(sampleArgs).length > 0 ? JSON.stringify(sampleArgs) : '{}';

    lines.push('');
    lines.push(`    it('should have tool "${escapeJsString(tool.name, '"')}"', async () => {`);
    lines.push('      const tools = await client.listTools();');
    lines.push(`      expect(tools).toHaveTool('${toolNameLiteral(tool.name)}');`);
    lines.push('    });');
    lines.push('');

    // Call test. Generated arguments are guesses, and some tools intentionally
    // return/throw errors — so accept a successful result or a tool-level error.
    lines.push(`    it('should call "${escapeJsString(tool.name, '"')}"', async () => {`);
    lines.push('      const result = await client.callTool({');
    lines.push(`        name: '${toolNameLiteral(tool.name)}',`);
    lines.push(`        arguments: ${argsStr},`);
    lines.push('      }).catch((error: unknown) => error);');
    lines.push('      expect(result).toBeDefined();');
    lines.push('    });');

    // Derived edge/AI cases for this tool.
    for (const c of cases.filter((c) => c.tool === tool.name)) {
      lines.push('');
      lines.push(...generateCaseTest(c));
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
    lines.push(
      `    it('should have resource "${escapeJsString(resource.uri, '"')}"', async () => {`
    );
    lines.push('      const resources = await client.listResources();');
    lines.push(`      expect(resources).toHaveResource('${escapeJsString(resource.uri, "'")}');`);
    lines.push('    });');
    lines.push('');
    lines.push(
      `    it('should read resource "${escapeJsString(resource.uri, '"')}"', async () => {`
    );
    lines.push(
      `      const result = await client.readResource('${escapeJsString(resource.uri, "'")}');`
    );
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
    lines.push(`    it('should have prompt "${escapeJsString(prompt.name, '"')}"', async () => {`);
    lines.push('      const prompts = await client.listPrompts();');
    lines.push(`      expect(prompts).toHavePrompt('${escapeJsString(prompt.name, "'")}');`);
    lines.push('    });');
    lines.push('');
    lines.push(`    it('should get prompt "${escapeJsString(prompt.name, '"')}"', async () => {`);
    lines.push(
      `      const result = await client.getPrompt('${escapeJsString(prompt.name, "'")}'${argsStr});`
    );
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
 *
 * @internal Exported for testing; consumers should use {@link generateTests}
 * or {@link generateTestsFromClient}.
 */
export function buildTestFile(
  tools: Tool[],
  resources: Resource[],
  prompts: Prompt[],
  options: TestBuildOptions,
  server: ServerConfig,
  cases: GeneratedCase[] = []
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
    ` * Generated test file for: ${description.replace(/\*\//g, '*\\/')}`,
    ' *',
    ` * Framework: ${framework}`,
    ` * Server: ${serverLabel.replace(/\*\//g, '*\\/')}`,
    ` * Tools: ${tools.length} | Resources: ${resources.length} | Prompts: ${prompts.length}`,
    cases.length > 0 ? ` * Derived cases: ${cases.length} (edge/AI)` : null,
    ' *',
    ` * Generated by @slbdn/mcp-tester v${getPackageVersion()}`,
    ' * Run: npx jest --testTimeout=30000 (or npx vitest run)',
    ' */',
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

  // Test sections
  const toolTests = options.includeTools !== false ? generateToolTests(tools, cases) : '';
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
describe('${escapeJsString(description, "'")}', () => {
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

/** Options {@link buildCases} actually needs. */
type CaseBuildOptions = Pick<GenerateTestOptions, 'mode' | 'provider' | 'ai' | 'includeTools'>;

/**
 * Derive test cases for the requested {@link GenerationMode}.
 *
 * - `static` → no extra cases
 * - `edge` → deterministic schema rules
 * - `ai` → rules + AI-suggested cases (validated against the real schemas)
 *
 * @returns The cases, a diagnostics string (or null), and whether AI ran.
 */
async function buildCases(
  tools: Tool[],
  options: CaseBuildOptions,
  serverLabel?: string
): Promise<{ cases: GeneratedCase[]; note: string | null; usedAI: boolean }> {
  const mode = options.mode ?? 'static';
  if (mode === 'static' || options.includeTools === false || tools.length === 0) {
    return { cases: [], note: null, usedAI: false };
  }

  const ruleCases = suggestEdgeCasesForTools(tools);
  if (mode === 'edge') {
    return { cases: ruleCases, note: null, usedAI: false };
  }

  // mode === 'ai'
  const provider = options.provider ?? createProviderFromEnv();
  if (!provider) {
    if (options.ai?.requireAi) {
      throw new Error(
        'AI generation requested with requireAi, but no provider is available. ' +
          'Set MCP_TESTER_AI_API_KEY (and optionally MCP_TESTER_AI_BASE_URL / MCP_TESTER_AI_MODEL), ' +
          'or pass a provider.'
      );
    }
    return {
      cases: ruleCases,
      note:
        'No AI provider configured (set MCP_TESTER_AI_API_KEY); ' +
        'fell back to deterministic edge cases.',
      usedAI: false,
    };
  }

  const analysis: ServerAnalysis = {
    serverLabel,
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  };

  const aiCases = await provider.suggestCases(analysis);
  const schemas = new Map(tools.map((t) => [t.name, t]));
  const { cases, rejected } = mergeAndValidateCases([ruleCases, aiCases], schemas);

  const dropped = rejected.length;
  const note =
    dropped > 0
      ? `AI suggested cases: ${aiCases.length}, kept after schema validation: ${aiCases.length - dropped} (dropped ${dropped})`
      : null;

  return { cases, note, usedAI: true };
}

/**
 * Dry-run every derived case against the live server and record what actually
 * happens in `case.observed`. The renderer turns mismatches into `it.skip`
 * blocks with an explanatory comment.
 */
async function verifyCases(
  client: MCPClient,
  cases: GeneratedCase[],
  timeout: number
): Promise<void> {
  for (const c of cases) {
    if (c.expectation === 'observe') continue;
    try {
      const result = await client.callTool({
        name: c.tool,
        arguments: c.args,
        timeout: Math.min(timeout, 15_000),
      });
      const isError = (result as { isError?: boolean }).isError === true;
      c.observed = isError ? 'error' : 'success';
    } catch {
      c.observed = 'error';
    }
  }
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
      options.includeTools === false ? Promise.resolve([]) : client.listTools(),
      options.includeResources === false ? Promise.resolve([]) : client.listResources(),
      options.includePrompts === false ? Promise.resolve([]) : client.listPrompts(),
    ]);

    const server: StdioServerConfig = { command: options.command, args: options.args };
    const serverLabel = formatServerLabel(server);
    const { cases, note } = await buildCases(tools, options, serverLabel);
    if (note) console.warn(`mcp-tester: ${note}`);
    if (options.verify && cases.length > 0) {
      await verifyCases(client, cases, options.timeout || 30000);
    }
    return buildTestFile(tools, resources, prompts, options, server, cases);
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
  | 'mode'
  | 'provider'
  | 'ai'
  | 'verify'
  | 'timeout'
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

  const { cases, note } = await buildCases(tools, options, formatServerLabel(server));
  if (note) console.warn(`mcp-tester: ${note}`);
  if (options.verify && cases.length > 0) {
    await verifyCases(client, cases, options.timeout || 30000);
  }

  return buildTestFile(tools, resources, prompts, options, server, cases);
}

#!/usr/bin/env node
// CLI entry point - run with: node dist/cli/index.js
import { Command } from 'commander';
import { MCPClient } from '../client/MCPClient.js';
import type { ServerConfig } from '../client/MCPClient.js';
import { MCPConnectionError, MCPTimeoutError, MCPServerError } from '../utils/errors.js';
import { generateTests } from '../generate-tests.js';
import { generateTypes } from '../generate-types.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Read version from package.json (works in both src and dist)
const __dirname = dirname(fileURLToPath(import.meta.url));
function getPackageVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const program = new Command();

program
  .name('mcp-tester')
  .description('CLI tool for testing MCP servers (stdio, HTTP, and SSE transports)')
  .version(getPackageVersion(), '-V, --version');

// Global options (also added per-command via addTransportOptions below)
program
  .option('-t, --timeout <ms>', 'Request timeout in milliseconds', '30000')
  .option('-v, --verbose', 'Enable verbose output')
  .option('-l, --log-level <level>', 'Log level (debug|info|warn|error)', 'info');

/**
 * Add transport options to a command. Commander requires options to be defined
 * on the command itself for them to be recognized during argument parsing.
 */
function withTransport(cmd: Command): Command {
  return cmd
    .option('-T, --transport <type>', 'Transport: stdio (default), http, or sse', undefined)
    .option('--url <url>', 'Server URL for http/sse (e.g. http://localhost:3000/mcp)', undefined)
    .option(
      '--headers <json>',
      'HTTP headers as JSON (e.g. \'{"Authorization":"Bearer x"}\')',
      undefined
    );
}

// ─── Helper: resolve server config from global opts + positional args ──────

/**
 * Build a ServerConfig from the global options and positional command/args.
 *
 * - If `--url` is provided → use HTTP/SSE transport
 * - If `--transport http|sse` without `--url` → treat first positional arg as URL
 * - Otherwise → stdio with command + args
 */
function resolveServerConfig(
  opts: Record<string, unknown>,
  command?: string,
  args?: string[]
): ServerConfig {
  const transport = String(opts['transport'] || '');
  const url = opts['url'] ? String(opts['url']) : undefined;
  const headersRaw = opts['headers'] ? String(opts['headers']) : undefined;

  let headers: Record<string, string> | undefined;
  if (headersRaw) {
    try {
      headers = JSON.parse(headersRaw);
    } catch {
      console.error('❌ Invalid JSON for --headers');
      process.exit(1);
    }
  }

  // HTTP or SSE transport
  if (transport === 'http' || transport === 'sse' || (url && transport)) {
    const actualTransport = (transport || 'http') as 'http' | 'sse';
    const actualUrl = url || command;
    if (!actualUrl) {
      console.error(
        `❌ URL is required for ${actualTransport} transport. Use --url or pass as first argument.`
      );
      process.exit(1);
    }
    return { transport: actualTransport, url: actualUrl, headers } as ServerConfig;
  }

  // Auto-detect: if command looks like a URL, use HTTP
  if (command && (command.startsWith('http://') || command.startsWith('https://'))) {
    return { transport: 'http', url: command, headers } as ServerConfig;
  }

  // Default: stdio
  if (!command) {
    console.error(
      '❌ Command is required for stdio transport. Example: mcp-tester test node ./server.js'
    );
    process.exit(1);
  }
  return { command, args: args || [] };
}

/** Human-readable description of the connection target for logging. */
function describeTarget(config: ServerConfig): string {
  if ('url' in config) {
    return `${config.transport}: ${config.url}`;
  }
  return `stdio: ${config.command} ${(config.args || []).join(' ')}`;
}

/** Create a client with global options. */
function createClient(opts: Record<string, unknown>): MCPClient {
  return new MCPClient({
    name: 'mcp-tester-cli',
    version: '1.0.0',
    timeout: parseInt(String(opts['timeout'] || '30000')),
    logLevel: (opts['verbose'] ? 'debug' : String(opts['logLevel'] || 'info')) as
      | 'debug'
      | 'info'
      | 'warn'
      | 'error',
  });
}

// ─── Commands ────────────────────────────────────────────────────────────

// Test command - connects and verifies server is working
withTransport(
  program
    .command('test')
    .description('Test MCP server connection and list available capabilities')
    .argument('[command]', 'Command to run (stdio) or URL (http/sse)')
    .argument('[args...]', 'Arguments for the server command')
).action(async (command: string | undefined, args: string[], opts: Record<string, unknown>) => {
  const config = resolveServerConfig(opts, command, args);
  const client = createClient(opts);

  try {
    console.log(`🔌 Connecting to MCP server...`);
    console.log(`   ${describeTarget(config)}`);

    await client.start(config);

    console.log(`✅ Connected successfully\n`);

    // Test tools
    console.log(`🛠️  Tools:`);
    const tools = await client.listTools();
    if (tools.length === 0) {
      console.log('   (none)');
    } else {
      tools.forEach((tool) => {
        console.log(`   • ${tool.name}: ${tool.description}`);
      });
    }
    console.log();

    // Test resources
    console.log(`📄 Resources:`);
    const resources = await client.listResources();
    if (resources.length === 0) {
      console.log('   (none)');
    } else {
      resources.forEach((resource) => {
        console.log(`   • ${resource.uri}: ${resource.description || resource.name}`);
      });
    }
    console.log();

    // Test prompts
    console.log(`💬 Prompts:`);
    const prompts = await client.listPrompts();
    if (prompts.length === 0) {
      console.log('   (none)');
    } else {
      prompts.forEach((prompt) => {
        console.log(`   • ${prompt.name}: ${prompt.description}`);
      });
    }
    console.log();

    console.log(`✅ Server test completed successfully!`);
    console.log(
      `   Tools: ${tools.length} | Resources: ${resources.length} | Prompts: ${prompts.length}`
    );
  } catch (error) {
    console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);

    if (error instanceof MCPConnectionError) {
      console.error('   → Connection failed. Check the URL or command.');
    } else if (error instanceof MCPTimeoutError) {
      console.error(`   → Request timed out after ${opts['timeout']}ms`);
    } else if (error instanceof MCPServerError) {
      console.error('   → Server returned an error');
    }

    process.exit(1);
  } finally {
    await client.stop();
  }
});

// List tools command
withTransport(
  program
    .command('list-tools')
    .alias('lt')
    .description('List all available tools from the MCP server')
    .argument('[command]', 'Command to run (stdio) or URL (http/sse)')
    .argument('[args...]', 'Arguments for the server command')
)
  .option('--json', 'Output as JSON')
  .action(async (command: string | undefined, args: string[], opts: Record<string, unknown>) => {
    const config = resolveServerConfig(opts, command, args);
    const client = createClient(opts);

    try {
      await client.start(config);
      const tools = await client.listTools();

      if (opts['json']) {
        console.log(JSON.stringify({ tools }, null, 2));
      } else {
        console.log(`🛠️  Available tools (${tools.length}):\n`);
        tools.forEach((tool) => {
          console.log(`  ${tool.name}`);
          console.log(`    Description: ${tool.description}`);
          if (tool.inputSchema?.properties) {
            const props = Object.keys(tool.inputSchema.properties);
            console.log(`    Parameters: ${props.join(', ') || '(none)'}`);
          }
          console.log();
        });
      }
    } catch (error) {
      console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    } finally {
      await client.stop();
    }
  });

// Call tool command
withTransport(
  program
    .command('call-tool')
    .alias('ct')
    .description('Call a tool on the MCP server')
    .argument('<tool-name>', 'Name of the tool to call')
    .argument('[command]', 'Command to run (stdio) or URL (http/sse)')
    .argument('[args...]', 'Arguments for the server command')
)
  .option('--params <json>', 'Tool parameters as JSON string')
  .option('--json', 'Output as JSON')
  .action(
    async (
      toolName: string,
      command: string | undefined,
      serverArgs: string[],
      opts: Record<string, unknown>
    ) => {
      const config = resolveServerConfig(opts, command, serverArgs);
      const client = createClient(opts);

      let toolArgs: Record<string, unknown> = {};

      if (opts['params']) {
        try {
          toolArgs = JSON.parse(String(opts['params']));
        } catch {
          console.error('❌ Invalid JSON for --params');
          process.exit(1);
        }
      }

      try {
        await client.start(config);

        if (!opts['json']) {
          console.log(`🔧 Calling tool: ${toolName}`);
          if (Object.keys(toolArgs).length > 0) {
            console.log(`   Parameters: ${JSON.stringify(toolArgs)}`);
          }
        }

        const result = await client.callTool({
          name: toolName,
          arguments: toolArgs,
        });

        if (opts['json']) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log('\n✅ Result:');
          result.content.forEach((item) => {
            if ('text' in item) {
              console.log(`   ${item.text}`);
            } else if ('data' in item) {
              console.log(`   ${JSON.stringify(item.data)}`);
            }
          });
        }
      } catch (error) {
        console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      } finally {
        await client.stop();
      }
    }
  );

// Read resource command
withTransport(
  program
    .command('read-resource')
    .alias('rr')
    .description('Read a resource from the MCP server')
    .argument('<uri>', 'URI of the resource to read')
    .argument('[command]', 'Command to run (stdio) or URL (http/sse)')
    .argument('[args...]', 'Arguments for the server command')
)
  .option('--json', 'Output as JSON')
  .action(
    async (
      uri: string,
      command: string | undefined,
      serverArgs: string[],
      opts: Record<string, unknown>
    ) => {
      const config = resolveServerConfig(opts, command, serverArgs);
      const client = createClient(opts);

      try {
        await client.start(config);

        if (!opts['json']) {
          console.log(`📖 Reading resource: ${uri}`);
        }

        const result = await client.readResource(uri);

        if (opts['json']) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          result.contents.forEach((item) => {
            if ('text' in item) {
              console.log('\n📄 Content:');
              console.log(`   ${item.text}`);
            }
          });
        }
      } catch (error) {
        console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      } finally {
        await client.stop();
      }
    }
  );

// Get prompt command
withTransport(
  program
    .command('get-prompt')
    .alias('gp')
    .description('Get a prompt from the MCP server')
    .argument('<name>', 'Name of the prompt')
    .argument('[command]', 'Command to run (stdio) or URL (http/sse)')
    .argument('[args...]', 'Arguments for the server command')
)
  .option('--args <json>', 'Prompt arguments as JSON string')
  .option('--json', 'Output as JSON')
  .action(
    async (
      promptName: string,
      command: string | undefined,
      serverArgs: string[],
      opts: Record<string, unknown>
    ) => {
      const config = resolveServerConfig(opts, command, serverArgs);
      const client = createClient(opts);

      let promptArgs: Record<string, string> = {};

      if (opts['args']) {
        try {
          promptArgs = JSON.parse(String(opts['args']));
        } catch {
          console.error('❌ Invalid JSON for --args');
          process.exit(1);
        }
      }

      try {
        await client.start(config);

        if (!opts['json']) {
          console.log(`💬 Getting prompt: ${promptName}`);
        }

        const result = await client.getPrompt(promptName, promptArgs);

        if (opts['json']) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log('\n📝 Messages:');
          result.messages.forEach((msg) => {
            console.log(`   [${msg.role}]`);
            if ('text' in msg.content) {
              console.log(`   ${msg.content.text}`);
            }
          });
        }
      } catch (error) {
        console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      } finally {
        await client.stop();
      }
    }
  );

// Generate test file command
withTransport(
  program
    .command('generate')
    .alias('gen')
    .description('Generate test file from MCP server inspection')
    .argument('[command]', 'Command to run (stdio) or URL (http/sse)')
    .argument('[args...]', 'Arguments for the server command')
)
  .option('-o, --output <file>', 'Output file path (prints to stdout if omitted)')
  .option('--framework <fw>', 'Test framework: jest or vitest', 'jest')
  .option('--description <desc>', 'Description for the test suite')
  .option('--no-resources', 'Skip resource tests')
  .option('--no-prompts', 'Skip prompt tests')
  .option('--no-tools', 'Skip tool tests')
  .option('--no-matchers', 'Skip custom matchers import')
  .action(
    async (command: string | undefined, serverArgs: string[], opts: Record<string, unknown>) => {
      const framework = String(opts['framework'] || 'jest');
      if (framework !== 'jest' && framework !== 'vitest') {
        console.error('❌ Framework must be "jest" or "vitest"');
        process.exit(1);
      }

      try {
        console.error('🔍 Inspecting MCP server...');

        // generateTests supports stdio only (connects and inspects)
        const config = resolveServerConfig(opts, command, serverArgs);
        const timeout = parseInt(String(opts['timeout'] || '30000'));

        let code: string;
        if ('command' in config) {
          code = await generateTests({
            command: config.command,
            args: config.args || [],
            framework: framework as 'jest' | 'vitest',
            description: opts['description'] as string | undefined,
            includeResources: opts['resources'] !== false,
            includePrompts: opts['prompts'] !== false,
            includeTools: opts['tools'] !== false,
            includeMatchers: opts['matchers'] !== false,
            timeout,
          });
        } else {
          // HTTP/SSE — connect directly
          const client = new MCPClient({ name: 'mcp-tester-gen', version: '1.0.0', timeout });
          try {
            await client.start(config);
            // For HTTP/SSE, generate from connected client
            code = await generateFromClient(client, {
              framework: framework as 'jest' | 'vitest',
              description: opts['description'] as string | undefined,
              includeResources: opts['resources'] !== false,
              includePrompts: opts['prompts'] !== false,
              includeTools: opts['tools'] !== false,
              includeMatchers: opts['matchers'] !== false,
            });
          } finally {
            await client.stop();
          }
        }

        if (opts['output']) {
          const fs = await import('fs');
          const path = await import('path');
          const outputPath = String(opts['output']);
          const dir = path.dirname(outputPath);
          if (dir && dir !== '.') {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(outputPath, code, 'utf-8');
          console.error(`✅ Generated test file: ${outputPath}`);
        } else {
          process.stdout.write(code);
        }
      } catch (error) {
        console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    }
  );

// Generate TypeScript types command
withTransport(
  program
    .command('generate-types')
    .alias('gen-types')
    .description('Generate TypeScript type declarations from MCP server tool schemas')
    .argument('[command]', 'Command to run (stdio) or URL (http/sse)')
    .argument('[args...]', 'Arguments for the server command')
)
  .option('-o, --output <file>', 'Output file path (prints to stdout if omitted)')
  .option('--module-name <name>', 'Module name for import hints', '@slbdn/mcp-tester')
  .option('--no-resources', 'Skip resource URI types')
  .option('--no-prompts', 'Skip prompt argument types')
  .action(
    async (command: string | undefined, serverArgs: string[], opts: Record<string, unknown>) => {
      try {
        console.error('🔍 Inspecting MCP server for type generation...');

        const config = resolveServerConfig(opts, command, serverArgs);
        const timeout = parseInt(String(opts['timeout'] || '30000'));

        let types: string;
        if ('command' in config) {
          types = await generateTypes({
            command: config.command,
            args: config.args || [],
            moduleName: opts['moduleName'] as string | undefined,
            includeResources: opts['resources'] !== false,
            includePrompts: opts['prompts'] !== false,
            timeout,
          });
        } else {
          const client = new MCPClient({ name: 'mcp-tester-gen', version: '1.0.0', timeout });
          try {
            await client.start(config);
            types = await generateTypesFromClient(client, {
              moduleName: opts['moduleName'] as string | undefined,
              includeResources: opts['resources'] !== false,
              includePrompts: opts['prompts'] !== false,
            });
          } finally {
            await client.stop();
          }
        }

        if (opts['output']) {
          const fs = await import('fs');
          const path = await import('path');
          const outputPath = String(opts['output']);
          const dir = path.dirname(outputPath);
          if (dir && dir !== '.') {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(outputPath, types, 'utf-8');
          console.error(`✅ Generated type declarations: ${outputPath}`);
        } else {
          process.stdout.write(types);
        }
      } catch (error) {
        console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    }
  );

// ─── Helpers for HTTP/SSE codegen (inline inspection) ─────────────────────

async function generateFromClient(
  client: MCPClient,
  opts: {
    framework: 'jest' | 'vitest';
    description?: string;
    includeResources: boolean;
    includePrompts: boolean;
    includeTools: boolean;
    includeMatchers: boolean;
  }
): Promise<string> {
  const tools = opts.includeTools ? await client.listTools() : [];
  const resources = opts.includeResources ? await client.listResources() : [];
  const prompts = opts.includePrompts ? await client.listPrompts() : [];

  // Build the test code inline (simplified version for HTTP/SSE)
  const importLine = opts.framework === 'vitest' ? 'vitest' : '@jest/globals';
  const matchersImport = opts.includeMatchers
    ? `import { setup${opts.framework === 'vitest' ? 'Vitest' : 'Jest'}Matchers } from '@slbdn/mcp-tester';\n`
    : '';

  let code = `import { describe, it, expect, beforeAll, afterAll } from '${importLine}';\n`;
  code += `import { MCPClient } from '@slbdn/mcp-tester';\n`;
  if (matchersImport) code += matchersImport;
  code += '\n';

  const desc = opts.description || 'Generated MCP Server Tests';
  code += `describe('${desc}', () => {\n`;
  code += `  let client: MCPClient;\n\n`;
  code += `  beforeAll(async () => {\n`;
  if (matchersImport) {
    code += `    setup${opts.framework === 'vitest' ? 'Vitest' : 'Jest'}Matchers();\n`;
  }
  code += `    client = new MCPClient({ timeout: 30000 });\n`;
  code += `    // Update the URL/command for your server\n`;
  code += `    await client.start({ command: 'node', args: ['./server.js'] });\n`;
  code += `  });\n\n`;
  code += `  afterAll(async () => {\n    if (client.isConnected()) await client.stop();\n  });\n\n`;

  if (opts.includeTools) {
    code += `  // ─── Tools (${tools.length}) ───\n`;
    for (const tool of tools) {
      code += `  it('should have tool: ${tool.name}', async () => {\n`;
      code += `    const tools = await client.listTools();\n`;
      code += `    expect(tools.map(t => t.name)).toContain('${tool.name}');\n`;
      code += `  });\n\n`;
    }
  }

  if (opts.includeResources) {
    code += `  // ─── Resources (${resources.length}) ───\n`;
    code += `  it('should list resources', async () => {\n`;
    code += `    const resources = await client.listResources();\n`;
    code += `    expect(resources.length).toBeGreaterThan(0);\n`;
    code += `  });\n\n`;
  }

  if (opts.includePrompts) {
    code += `  // ─── Prompts (${prompts.length}) ───\n`;
    code += `  it('should list prompts', async () => {\n`;
    code += `    const prompts = await client.listPrompts();\n`;
    code += `    expect(prompts.length).toBeGreaterThan(0);\n`;
    code += `  });\n\n`;
  }

  code += `});\n`;
  return code;
}

async function generateTypesFromClient(
  client: MCPClient,
  opts: {
    moduleName?: string;
    includeResources: boolean;
    includePrompts: boolean;
  }
): Promise<string> {
  const tools = await client.listTools();
  const resources = opts.includeResources ? await client.listResources() : [];
  const prompts = opts.includePrompts ? await client.listPrompts() : [];

  const moduleName = opts.moduleName || '@slbdn/mcp-tester';
  let code = `// Generated by mcp-tester generate-types\n`;
  code += `// Source: MCP server inspection\n\n`;

  code += `// Tool argument types\n`;
  for (const tool of tools) {
    code += `export interface ${toPascalCase(tool.name)}Args {\n`;
    const props = tool.inputSchema?.properties || {};
    const required = tool.inputSchema?.required || [];
    for (const [key, schema] of Object.entries(props)) {
      const s = schema as Record<string, unknown>;
      const tsType = jsonSchemaToTs(s);
      const optional = !required.includes(key) ? '?' : '';
      code += `  ${key}${optional}: ${tsType};\n`;
    }
    code += `}\n\n`;
  }

  code += `export type ToolName = ${tools.map((t) => `'${t.name}'`).join(' | ') || 'string'};\n\n`;

  if (resources.length > 0) {
    code += `export type ResourceUri = ${resources.map((r) => `'${r.uri}'`).join(' | ')};\n\n`;
  }

  if (prompts.length > 0) {
    code += `export type PromptName = ${prompts.map((p) => `'${p.name}'`).join(' | ')};\n\n`;
  }

  code += `// Import the client\n`;
  code += `import { MCPClient, type ToolCall } from '${moduleName}';\n`;

  return code;
}

function toPascalCase(s: string): string {
  return s.replace(/(^|[-_])(.)/g, (_, __, c: string) => c.toUpperCase());
}

function jsonSchemaToTs(schema: Record<string, unknown>): string {
  const type = schema.type as string;
  switch (type) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      return 'unknown[]';
    case 'object':
      return 'Record<string, unknown>';
    default:
      return 'unknown';
  }
}

// ─── Help ────────────────────────────────────────────────────────────────

program.addHelpText(
  'after',
  `
Examples:
  # Stdio transport (default)
  mcp-tester test node ./server.js
  mcp-tester list-tools node ./server.js --json
  mcp-tester call-tool echo node ./server.js --params '{"message":"Hello"}'

  # HTTP transport
  mcp-tester test --transport http --url http://localhost:3000/mcp
  mcp-tester list-tools http://localhost:3000/mcp --json
  mcp-tester call-tool echo http://localhost:3000/mcp --params '{"message":"Hi"}'

  # SSE transport
  mcp-tester test --transport sse --url http://localhost:3000/sse

  # With custom headers
  mcp-tester test --transport http --url https://api.example.com/mcp --headers '{"Authorization":"Bearer token"}'

  # Generate tests and types (stdio)
  mcp-tester generate node ./server.js -o server.test.ts
  mcp-tester generate-types node ./server.js -o server.d.ts

Short aliases: lt (list-tools), ct (call-tool), rr (read-resource), gp (get-prompt), gen (generate)
`
);

// Show help when invoked with no arguments
const args = process.argv.slice(2);
if (args.length === 0) {
  program.outputHelp();
  process.exit(0);
}

program.parse();

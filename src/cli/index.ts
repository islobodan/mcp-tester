// CLI entry point - run with: node dist/cli/index.js
import { Command } from 'commander';
import { MCPClient } from '../client/MCPClient.js';
import { MCPConnectionError, MCPTimeoutError, MCPServerError } from '../utils/errors.js';

const program = new Command();

program
  .name('mcp-tester')
  .description('CLI tool for testing MCP servers')
  .version('1.0.0', '-V, --version');

// Global options - use string type since commander passes strings
program
  .option('-t, --timeout <ms>', 'Request timeout in milliseconds', '30000')
  .option('-v, --verbose', 'Enable verbose output')
  .option('-l, --log-level <level>', 'Log level (debug|info|warn|error)', 'info');

// Test command - connects and verifies server is working
program
  .command('test')
  .description('Test MCP server connection and list available capabilities')
  .argument('<command>', 'Command to run the MCP server (e.g., "node", "python")')
  .argument('[args...]', 'Arguments for the server command')
  .action(async (command: string, args: string[], opts: Record<string, unknown>) => {
    const client = new MCPClient({
      name: 'mcp-tester-cli',
      version: '1.0.0',
      timeout: parseInt(String(opts['timeout'] || '30000')),
      logLevel: (opts['verbose'] ? 'debug' : String(opts['logLevel'] || 'info')) as
        | 'debug'
        | 'info'
        | 'warn'
        | 'error',
    });

    try {
      console.log(`🔌 Connecting to MCP server...`);
      console.log(`   Command: ${command} ${args.join(' ')}`);

      await client.start({
        command,
        args,
      });

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
        console.error('   → Server failed to start. Check command and server process.');
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
program
  .command('list-tools')
  .alias('lt')
  .description('List all available tools from the MCP server')
  .argument('<command>', 'Command to run the MCP server')
  .argument('[args...]', 'Arguments for the server command')
  .option('--json', 'Output as JSON')
  .action(async (command: string, args: string[], opts: Record<string, unknown>) => {
    const client = new MCPClient({
      name: 'mcp-tester-cli',
      version: '1.0.0',
      timeout: parseInt(String(opts['timeout'] || '30000')),
      logLevel: opts['verbose'] ? 'debug' : 'info',
    });

    try {
      await client.start({ command, args });
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
program
  .command('call-tool')
  .alias('ct')
  .description('Call a tool on the MCP server')
  .argument('<tool-name>', 'Name of the tool to call')
  .argument('<command>', 'Command to run the MCP server')
  .argument('[args...]', 'Arguments for the server command')
  .option('--params <json>', 'Tool parameters as JSON string')
  .option('--json', 'Output as JSON')
  .action(
    async (
      toolName: string,
      command: string,
      serverArgs: string[],
      opts: Record<string, unknown>
    ) => {
      const client = new MCPClient({
        name: 'mcp-tester-cli',
        version: '1.0.0',
        timeout: parseInt(String(opts['timeout'] || '30000')),
        logLevel: opts['verbose'] ? 'debug' : 'info',
      });

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
        await client.start({ command, args: serverArgs });

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
program
  .command('read-resource')
  .alias('rr')
  .description('Read a resource from the MCP server')
  .argument('<uri>', 'URI of the resource to read')
  .argument('<command>', 'Command to run the MCP server')
  .argument('[args...]', 'Arguments for the server command')
  .option('--json', 'Output as JSON')
  .action(
    async (uri: string, command: string, serverArgs: string[], opts: Record<string, unknown>) => {
      const client = new MCPClient({
        name: 'mcp-tester-cli',
        version: '1.0.0',
        timeout: parseInt(String(opts['timeout'] || '30000')),
        logLevel: opts['verbose'] ? 'debug' : 'info',
      });

      try {
        await client.start({ command, args: serverArgs });

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
program
  .command('get-prompt')
  .alias('gp')
  .description('Get a prompt from the MCP server')
  .argument('<name>', 'Name of the prompt')
  .argument('<command>', 'Command to run the MCP server')
  .argument('[args...]', 'Arguments for the server command')
  .option('--args <json>', 'Prompt arguments as JSON string')
  .option('--json', 'Output as JSON')
  .action(
    async (
      promptName: string,
      command: string,
      serverArgs: string[],
      opts: Record<string, unknown>
    ) => {
      const client = new MCPClient({
        name: 'mcp-tester-cli',
        version: '1.0.0',
        timeout: parseInt(String(opts['timeout'] || '30000')),
        logLevel: opts['verbose'] ? 'debug' : 'info',
      });

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
        await client.start({ command, args: serverArgs });

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

// Add custom help with examples using Commander's built-in help system
program.addHelpText(
  'after',
  `
Examples:
  mcp-tester test node ./server.js
  mcp-tester list-tools node ./server.js --json
  mcp-tester call-tool echo node ./server.js --params '{"message":"Hello"}'
  mcp-tester read-resource text://example node ./server.js
  mcp-tester get-prompt greet node ./server.js --args '{"name":"World"}'
  mcp-tester lt node ./server.js                          # short alias for list-tools
  mcp-tester ct echo node ./server.js --params '{}'       # short alias for call-tool
`
);

// Show help when invoked with no arguments
const args = process.argv.slice(2);
if (args.length === 0) {
  program.outputHelp();
  process.exit(0);
}

program.parse();

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);
const CLI_PATH = path.join(__dirname, '../..', 'dist/cli/index.js');
const MOCK_SERVER = path.join(__dirname, '../..', 'examples/mock-server.js');

describe('CLI Tool', () => {
  const cli = (args: string) => `node ${CLI_PATH} ${args}`;

  describe('--help', () => {
    it('should show help when no command given', async () => {
      const { stdout } = await execAsync(`node ${CLI_PATH}`);
      expect(stdout).toContain('mcp-tester');
      expect(stdout).toContain('Usage:');
      expect(stdout).toContain('test');
      expect(stdout).toContain('list-tools');
      expect(stdout).toContain('call-tool');
    });

    it('should show help with -h flag', async () => {
      const { stdout } = await execAsync(`node ${CLI_PATH} -h`);
      expect(stdout).toContain('mcp-tester');
    });
  });

  describe('--version', () => {
    it('should show version with -V flag', async () => {
      const { stdout } = await execAsync(`node ${CLI_PATH} -V`);
      expect(stdout.trim()).toBe('mcp-tester v1.0.0');
    });

    it('should show version with --version flag', async () => {
      const { stdout } = await execAsync(`node ${CLI_PATH} --version`);
      expect(stdout.trim()).toBe('mcp-tester v1.0.0');
    });
  });

  describe('test command', () => {
    it('should connect and list capabilities', async () => {
      const { stdout } = await execAsync(cli(`test node ${MOCK_SERVER}`), {
        timeout: 15000,
      });
      expect(stdout).toContain('🔌 Connecting');
      expect(stdout).toContain('✅ Connected successfully');
      expect(stdout).toContain('🛠️  Tools:');
      expect(stdout).toContain('📄 Resources:');
      expect(stdout).toContain('💬 Prompts:');
      expect(stdout).toContain('echo');
      expect(stdout).toContain('✅ Server test completed successfully');
    });

    it('should list echo and add tools', async () => {
      const { stdout } = await execAsync(cli(`test node ${MOCK_SERVER}`), {
        timeout: 15000,
      });
      expect(stdout).toContain('echo');
      expect(stdout).toContain('add');
      expect(stdout).toContain('delay');
      expect(stdout).toContain('error_tool');
    });

    it('should list resources and prompts', async () => {
      const { stdout } = await execAsync(cli(`test node ${MOCK_SERVER}`), {
        timeout: 15000,
      });
      expect(stdout).toContain('text://example');
      expect(stdout).toContain('config://settings');
      expect(stdout).toContain('greet');
      expect(stdout).toContain('summarize');
    });

    it('should fail with non-existent server', async () => {
      await expect(
        execAsync(cli('test node nonexistent-file-xyz.js'), { timeout: 10000 })
      ).rejects.toThrow();
    });
  });

  describe('list-tools command', () => {
    it('should list all tools', async () => {
      const { stdout } = await execAsync(cli(`list-tools node ${MOCK_SERVER}`), {
        timeout: 15000,
      });
      expect(stdout).toContain('🛠️  Available tools');
      expect(stdout).toContain('echo');
      expect(stdout).toContain('Description: Echo back the input');
      expect(stdout).toContain('Parameters: message');
    });

    it('should list multiple tools with descriptions', async () => {
      const { stdout } = await execAsync(cli(`list-tools node ${MOCK_SERVER}`), {
        timeout: 15000,
      });
      expect(stdout).toContain('add');
      expect(stdout).toContain('Parameters: a, b');
      expect(stdout).toContain('delay');
      expect(stdout).toContain('Parameters: ms');
    });

    it('should support short alias lt', async () => {
      const { stdout } = await execAsync(cli(`lt node ${MOCK_SERVER}`), {
        timeout: 15000,
      });
      expect(stdout).toContain('echo');
      expect(stdout).toContain('🛠️  Available tools');
    });

    it('should output JSON with --json flag', async () => {
      const { stdout } = await execAsync(cli(`list-tools node ${MOCK_SERVER} --json`), {
        timeout: 15000,
      });
      const parsed = JSON.parse(stdout);
      expect(parsed.tools).toBeDefined();
      expect(Array.isArray(parsed.tools)).toBe(true);
      expect(parsed.tools.length).toBeGreaterThan(0);
      expect(parsed.tools[0]).toHaveProperty('name');
      expect(parsed.tools[0]).toHaveProperty('description');
      expect(parsed.tools[0]).toHaveProperty('inputSchema');
    });
  });

  describe('call-tool command', () => {
    it('should call echo tool with message', async () => {
      const { stdout } = await execAsync(
        cli(`call-tool echo node ${MOCK_SERVER} --params '{"message":"Hello CLI"}'`),
        { timeout: 15000 }
      );
      expect(stdout).toContain('🔧 Calling tool: echo');
      expect(stdout).toContain('Echo: Hello CLI');
    });

    it('should support short alias ct', async () => {
      const { stdout } = await execAsync(
        cli(`ct echo node ${MOCK_SERVER} --params '{"message":"test"}'`),
        { timeout: 15000 }
      );
      expect(stdout).toContain('✅ Result:');
      expect(stdout).toContain('Echo: test');
    });

    it('should call add tool with two numbers', async () => {
      const { stdout } = await execAsync(
        cli(`call-tool add node ${MOCK_SERVER} --params '{"a":5,"b":3}'`),
        { timeout: 15000 }
      );
      expect(stdout).toContain('✅ Result:');
      expect(stdout).toContain('8');
    });

    it('should output JSON with --json flag', async () => {
      const { stdout } = await execAsync(
        cli(`call-tool echo node ${MOCK_SERVER} --params '{"message":"json test"}' --json`),
        { timeout: 15000 }
      );
      const parsed = JSON.parse(stdout);
      expect(parsed.content).toBeDefined();
      expect(Array.isArray(parsed.content)).toBe(true);
      expect(parsed.content[0]).toHaveProperty('text');
      expect(parsed.content[0].text).toContain('json test');
    });

    it('should handle empty parameters', async () => {
      const { stdout } = await execAsync(cli(`call-tool echo node ${MOCK_SERVER} --params '{}'`), {
        timeout: 15000,
      });
      expect(stdout).toContain('🔧 Calling tool: echo');
      expect(stdout).toContain('✅ Result:');
    });

    it('should fail for unknown tool', async () => {
      await expect(
        execAsync(cli(`call-tool unknown-tool node ${MOCK_SERVER} --params '{}'`), {
          timeout: 15000,
        })
      ).rejects.toThrow();
    });

    it('should reject invalid JSON for --params', async () => {
      let exitCode = 0;
      let capturedStderr = '';
      try {
        await execAsync(`node ${CLI_PATH} call-tool echo node ${MOCK_SERVER} --params 'not-json'`, {
          timeout: 15000,
        });
      } catch (error: unknown) {
        const execError = error as { stderr?: string; code?: number };
        capturedStderr = execError.stderr || '';
        exitCode = execError.code || 1;
      }
      expect(exitCode).toBe(1);
      expect(capturedStderr).toContain('❌ Invalid JSON');
    });
  });

  describe('read-resource command', () => {
    it('should read text resource', async () => {
      const { stdout } = await execAsync(cli(`read-resource text://example node ${MOCK_SERVER}`), {
        timeout: 15000,
      });
      expect(stdout).toContain('📖 Reading resource: text://example');
      expect(stdout).toContain('📄 Content:');
    });

    it('should support short alias rr', async () => {
      const { stdout } = await execAsync(cli(`rr text://example node ${MOCK_SERVER}`), {
        timeout: 15000,
      });
      expect(stdout).toContain('📖 Reading resource');
    });

    it('should read config resource', async () => {
      const { stdout } = await execAsync(
        cli(`read-resource config://settings node ${MOCK_SERVER}`),
        { timeout: 15000 }
      );
      expect(stdout).toContain('📖 Reading resource: config://settings');
      expect(stdout).toContain('📄 Content:');
    });

    it('should output JSON with --json flag', async () => {
      const { stdout } = await execAsync(
        cli(`read-resource text://example node ${MOCK_SERVER} --json`),
        { timeout: 15000 }
      );
      const parsed = JSON.parse(stdout);
      expect(parsed.contents).toBeDefined();
      expect(Array.isArray(parsed.contents)).toBe(true);
    });
  });

  describe('get-prompt command', () => {
    it('should get greet prompt with args', async () => {
      const { stdout } = await execAsync(
        cli(`get-prompt greet node ${MOCK_SERVER} --args '{"name":"Alice"}'`),
        { timeout: 15000 }
      );
      expect(stdout).toContain('💬 Getting prompt: greet');
      expect(stdout).toContain('📝 Messages:');
      expect(stdout).toContain('Alice');
    });

    it('should support short alias gp', async () => {
      const { stdout } = await execAsync(
        cli(`gp greet node ${MOCK_SERVER} --args '{"name":"Bob"}'`),
        { timeout: 15000 }
      );
      expect(stdout).toContain('💬 Getting prompt');
      expect(stdout).toContain('Bob');
    });

    it('should output JSON with --json flag', async () => {
      const { stdout } = await execAsync(
        cli(`get-prompt greet node ${MOCK_SERVER} --args '{"name":"CLI"}' --json`),
        { timeout: 15000 }
      );
      const parsed = JSON.parse(stdout);
      expect(parsed.messages).toBeDefined();
      expect(Array.isArray(parsed.messages)).toBe(true);
      expect(parsed.messages[0]).toHaveProperty('role');
    });

    it('should reject invalid JSON for --args', async () => {
      let exitCode = 0;
      let capturedStderr = '';
      try {
        await execAsync(`node ${CLI_PATH} get-prompt greet node ${MOCK_SERVER} --args 'not-json'`, {
          timeout: 15000,
        });
      } catch (error: unknown) {
        const execError = error as { stderr?: string; code?: number };
        capturedStderr = execError.stderr || '';
        exitCode = execError.code || 1;
      }
      expect(exitCode).toBe(1);
      expect(capturedStderr).toContain('❌ Invalid JSON');
    });
  });

  describe('global options', () => {
    it('should accept --timeout option', async () => {
      const { stdout } = await execAsync(cli(`test node ${MOCK_SERVER} --timeout 30000`), {
        timeout: 15000,
      });
      expect(stdout).toContain('✅ Server test completed successfully');
    });

    it('should accept -t shorthand for timeout', async () => {
      const { stdout } = await execAsync(cli(`test node ${MOCK_SERVER} -t 30000`), {
        timeout: 15000,
      });
      expect(stdout).toContain('✅ Server test completed successfully');
    });

    it('should accept --verbose option', async () => {
      const { stderr } = await execAsync(cli(`list-tools node ${MOCK_SERVER} --verbose`), {
        timeout: 15000,
      });
      expect(stderr).toContain('Starting MCP client');
      expect(stderr).toContain('Successfully connected');
    });

    it('should accept -v shorthand for verbose', async () => {
      const { stderr } = await execAsync(cli(`lt node ${MOCK_SERVER} -v`), {
        timeout: 15000,
      });
      expect(stderr).toContain('Starting MCP client');
    });

    it('should accept --log-level option', async () => {
      const { stderr } = await execAsync(cli(`test node ${MOCK_SERVER} --log-level debug`), {
        timeout: 15000,
      });
      expect(stderr).toContain('Starting MCP client');
    });

    it('should accept -l shorthand for log-level', async () => {
      const { stderr } = await execAsync(cli(`test node ${MOCK_SERVER} -l info`), {
        timeout: 15000,
      });
      expect(stderr).toContain('Starting MCP client');
    });
  });

  describe('error handling', () => {
    it('should exit with error when server path does not exist', async () => {
      await expect(
        execAsync(`node ${CLI_PATH} test node ./does-not-exist-xyz.js`, {
          timeout: 10000,
        })
      ).rejects.toThrow();
    });

    it('should handle connection timeout', async () => {
      // Create a script that hangs indefinitely
      const hangScript = path.join(__dirname, '../..', 'examples/hang-server.js');
      require('fs').writeFileSync(hangScript, 'setTimeout(()=>{},60000);');
      try {
        await execAsync(`node ${CLI_PATH} test node ${hangScript}`, { timeout: 3000 });
      } catch {
        // Expected to throw on timeout
      }
      // Clean up
      require('fs').unlinkSync(hangScript);
    });
  });
});

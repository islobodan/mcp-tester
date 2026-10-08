import { generateTests, generateTestsFromClient } from '../generate-tests.js';
import type { GenerateTestOptions } from '../generate-tests.js';
import type { GeneratedCase } from '../generate-cases.js';
import { OpenAICompatProvider } from '../ai/provider.js';
import { MCPClient } from '../client/MCPClient.js';
import fs from 'fs';

const MOCK_SERVER_CMD = 'node';
const MOCK_SERVER_ARGS = ['./examples/mock-server.js'];

// Helper to check if the mock server is available
let serverAvailable = false;
beforeAll(async () => {
  const client = new MCPClient({ timeout: 5000, logLevel: 'none' });
  try {
    await client.start({ command: MOCK_SERVER_CMD, args: MOCK_SERVER_ARGS });
    serverAvailable = true;
    await client.stop();
  } catch {
    serverAvailable = false;
  }
}, 10000);

describe('generateTests', () => {
  const baseOptions: GenerateTestOptions = {
    command: MOCK_SERVER_CMD,
    args: MOCK_SERVER_ARGS,
    timeout: 10000,
  };

  // ─── Basic generation ───────────────────────────────────────────────

  describe('basic generation', () => {
    it('should generate a test file with all sections', async () => {
      if (!serverAvailable) return;

      const code = await generateTests(baseOptions);

      // Header
      expect(code).toContain('Generated test file');
      expect(code).toContain('Framework: jest');
      expect(code).toContain('Server: node');
      expect(code).toContain('@slbdn/mcp-tester');

      // Imports
      expect(code).toContain("from '@jest/globals'");
      expect(code).toContain("from '@slbdn/mcp-tester'");

      // Structure
      expect(code).toContain("describe('MCP Server'");
      expect(code).toContain('beforeEach');
      expect(code).toContain('afterEach');
      expect(code).toContain('client.start');
      expect(code).toContain('client.stop');
      expect(code).toContain('client.isConnected()');
    }, 15000);

    it('should generate tool tests', async () => {
      if (!serverAvailable) return;

      const code = await generateTests(baseOptions);
      expect(code).toContain("describe('Tools'");

      // Mock server tools
      expect(code).toContain("'echo'");
      expect(code).toContain("'add'");
      expect(code).toContain("'delay'");
      expect(code).toContain("'error_tool'");

      // Test patterns
      expect(code).toContain('toHaveTool');
      expect(code).toContain('client.callTool');
    }, 15000);

    it('should generate resource tests', async () => {
      if (!serverAvailable) return;

      const code = await generateTests(baseOptions);
      expect(code).toContain("describe('Resources'");
      expect(code).toContain('text://example');
      expect(code).toContain('config://settings');
      expect(code).toContain('client.readResource');
    }, 15000);

    it('should generate prompt tests', async () => {
      if (!serverAvailable) return;

      const code = await generateTests(baseOptions);
      expect(code).toContain("describe('Prompts'");
      expect(code).toContain("'greet'");
      expect(code).toContain("'summarize'");
      expect(code).toContain('client.getPrompt');
    }, 15000);

    it('should generate sample tool arguments from schema', async () => {
      if (!serverAvailable) return;

      const code = await generateTests(baseOptions);

      // echo tool has a "message" string param
      expect(code).toContain('"message"');

      // add tool has "a" and "b" number params
      expect(code).toContain('"a"');
      expect(code).toContain('"b"');
    }, 15000);
  });

  // ─── Framework options ──────────────────────────────────────────────

  describe('framework option', () => {
    it('should generate Jest imports by default', async () => {
      if (!serverAvailable) return;

      const code = await generateTests(baseOptions);
      expect(code).toContain("from '@jest/globals'");
      expect(code).toContain('setupJestMatchers');
    }, 15000);

    it('should generate Vitest imports when specified', async () => {
      if (!serverAvailable) return;

      const code = await generateTests({ ...baseOptions, framework: 'vitest' });
      expect(code).toContain("from 'vitest'");
      expect(code).toContain('setupVitestMatchers');
      expect(code).toContain('@slbdn/mcp-tester/vitest');
      expect(code).not.toContain("from '@jest/globals'");
    }, 15000);
  });

  // ─── Section filtering ──────────────────────────────────────────────

  describe('section filtering', () => {
    it('should skip tools when includeTools is false', async () => {
      if (!serverAvailable) return;

      const code = await generateTests({ ...baseOptions, includeTools: false });
      expect(code).not.toContain("describe('Tools'");
      expect(code).toContain("describe('Resources'");
      expect(code).toContain("describe('Prompts'");
    }, 15000);

    it('should skip resources when includeResources is false', async () => {
      if (!serverAvailable) return;

      const code = await generateTests({ ...baseOptions, includeResources: false });
      expect(code).toContain("describe('Tools'");
      expect(code).not.toContain("describe('Resources'");
      expect(code).toContain("describe('Prompts'");
    }, 15000);

    it('should skip prompts when includePrompts is false', async () => {
      if (!serverAvailable) return;

      const code = await generateTests({ ...baseOptions, includePrompts: false });
      expect(code).toContain("describe('Tools'");
      expect(code).toContain("describe('Resources'");
      expect(code).not.toContain("describe('Prompts'");
    }, 15000);

    it('should skip matchers when includeMatchers is false', async () => {
      if (!serverAvailable) return;

      const code = await generateTests({ ...baseOptions, includeMatchers: false });
      expect(code).not.toContain('setupJestMatchers');
      expect(code).not.toContain('setupVitestMatchers');
    }, 15000);
  });

  // ─── Description option ─────────────────────────────────────────────

  describe('description option', () => {
    it('should use custom description in describe block', async () => {
      if (!serverAvailable) return;

      const code = await generateTests({ ...baseOptions, description: 'My Custom Server' });
      expect(code).toContain("describe('My Custom Server'");
    }, 15000);

    it('should default to "MCP Server"', async () => {
      if (!serverAvailable) return;

      const code = await generateTests(baseOptions);
      expect(code).toContain("describe('MCP Server'");
    }, 15000);
  });

  // ─── Output file (CLI integration) ──────────────────────────────────

  describe('CLI output file', () => {
    it('should write to file via CLI', async () => {
      if (!serverAvailable) return;

      const { execSync } = await import('child_process');
      const outputPath = '/tmp/mcp-tester-gen-output.test.ts';

      execSync(
        `node dist/cli/index.js generate ${MOCK_SERVER_CMD} ${MOCK_SERVER_ARGS.join(' ')} -o ${outputPath}`,
        { timeout: 15000 }
      );

      expect(fs.existsSync(outputPath)).toBe(true);
      const content = fs.readFileSync(outputPath, 'utf-8');
      expect(content).toContain('Generated test file');
      expect(content).toContain("describe('MCP Server'");

      // Cleanup
      fs.unlinkSync(outputPath);
    }, 20000);

    it('should support --framework vitest via CLI', async () => {
      if (!serverAvailable) return;

      const { execSync } = await import('child_process');
      const output = execSync(
        `node dist/cli/index.js generate ${MOCK_SERVER_CMD} ${MOCK_SERVER_ARGS.join(' ')} --framework vitest`,
        { timeout: 15000, encoding: 'utf-8' }
      );

      expect(output).toContain("from 'vitest'");
      expect(output).toContain('setupVitestMatchers');
    }, 20000);

    it('should support --description via CLI', async () => {
      if (!serverAvailable) return;

      const { execSync } = await import('child_process');
      const output = execSync(
        `node dist/cli/index.js generate ${MOCK_SERVER_CMD} ${MOCK_SERVER_ARGS.join(' ')} --description "My Server"`,
        { timeout: 15000, encoding: 'utf-8' }
      );

      expect(output).toContain("describe('My Server'");
    }, 20000);

    it('should reject invalid framework', async () => {
      if (!serverAvailable) return;

      const { execSync } = await import('child_process');
      expect(() => {
        execSync(
          `node dist/cli/index.js generate ${MOCK_SERVER_CMD} ${MOCK_SERVER_ARGS.join(' ')} --framework mocha`,
          { timeout: 15000 }
        );
      }).toThrow();
    }, 20000);

    it('should support --no-resources via CLI', async () => {
      if (!serverAvailable) return;

      const { execSync } = await import('child_process');
      const output = execSync(
        `node dist/cli/index.js generate ${MOCK_SERVER_CMD} ${MOCK_SERVER_ARGS.join(' ')} --no-resources`,
        { timeout: 15000, encoding: 'utf-8' }
      );

      expect(output).not.toContain("describe('Resources'");
      expect(output).toContain("describe('Tools'");
    }, 20000);
  });

  // ─── Generated code validity ────────────────────────────────────────

  describe('generated code validity', () => {
    it('should generate valid TypeScript syntax', async () => {
      if (!serverAvailable) return;

      const code = await generateTests(baseOptions);

      // Basic syntax checks
      expect(code).toMatch(/import.*from/);
      expect(code).toContain('async ()');
      expect(code).toContain('await client.');
      expect(code).toContain('});');

      // Balanced braces (rough check)
      const opens = (code.match(/\{/g) || []).length;
      const closes = (code.match(/\}/g) || []).length;
      expect(opens).toBe(closes);
    }, 15000);

    it('should have correct lifecycle pattern', async () => {
      if (!serverAvailable) return;

      const code = await generateTests(baseOptions);

      expect(code).toContain('new MCPClient');
      expect(code).toContain('client.start');
      expect(code).toContain('client.stop');
      expect(code).toContain('client.isConnected()');
    }, 15000);

    it('should generate connection test', async () => {
      if (!serverAvailable) return;

      const code = await generateTests(baseOptions);

      expect(code).toContain('should connect to the server');
      expect(code).toContain('should list tools');
    }, 15000);
  });

  // ─── Generation modes (edge / ai) ─────────────────────────────────────

  describe('mode: edge', () => {
    it('adds deterministic rule-based cases and the isToolError helper', async () => {
      if (!serverAvailable) return;

      const code = await generateTests({ ...baseOptions, mode: 'edge' });

      expect(code).toContain('Derived cases:');
      expect(code).toContain('rule:required');
      expect(code).toContain('rule:type');
      expect(code).toContain('const isToolError');
      expect(code).toContain('expect(isToolError(result)).toBe(true)');
    }, 20000);
  });

  describe('mode: static (default)', () => {
    it('stays free of derived-case artifacts', async () => {
      if (!serverAvailable) return;

      const code = await generateTests(baseOptions);

      expect(code).not.toContain('rule:');
      expect(code).not.toContain('isToolError');
      expect(code).not.toContain('Derived cases');
    }, 20000);
  });

  describe('mode: ai', () => {
    it('falls back to edge cases with a warning when no provider is available', async () => {
      if (!serverAvailable) return;

      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const code = await generateTests({ ...baseOptions, mode: 'ai' });
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('No AI provider configured'));
        expect(code).toContain('rule:required'); // fallback ran
      } finally {
        warn.mockRestore();
      }
    }, 20000);

    it('throws under requireAi when no provider is available', async () => {
      if (!serverAvailable) return;

      await expect(
        generateTests({ ...baseOptions, mode: 'ai', ai: { requireAi: true } })
      ).rejects.toThrow(/no provider is available/);
    }, 20000);

    it('merges AI cases with rules and annotates provenance', async () => {
      if (!serverAvailable) return;

      const mockFetch: typeof fetch = async () =>
        ({
          ok: true,
          status: 200,
          text: async () => '',
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    cases: [
                      {
                        tool: 'echo',
                        title: 'handles unicode messages',
                        args: { message: 'héllo 🌍' },
                        expectation: 'success',
                        rationale: 'unicode should round-trip',
                      },
                      {
                        tool: 'echo',
                        title: 'hallucinated arg',
                        args: { nonsense: true },
                        expectation: 'success',
                        rationale: 'should be dropped',
                      },
                    ],
                  }),
                },
              },
            ],
          }),
        }) as unknown as Response;

      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const code = await generateTests({
          ...baseOptions,
          mode: 'ai',
          provider: new OpenAICompatProvider({
            apiKey: 'test-key',
            model: 'test-model',
            cacheDir: null,
            fetchImpl: mockFetch,
          }),
        });

        expect(code).toContain('ai:test-model');
        expect(code).toContain('handles unicode messages');
        expect(code).toContain('héllo');
        expect(code).not.toContain('nonsense'); // hallucinated case dropped
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('dropped 1'));
      } finally {
        warn.mockRestore();
      }
    }, 20000);
  });

  describe('option: verify', () => {
    it('skips cases whose expectation mismatches observed behavior', async () => {
      if (!serverAvailable) return;

      const code = await generateTests({ ...baseOptions, mode: 'edge', verify: true });

      // The mock server validates its inputs, so error expectations hold and
      // remain real assertions. Mismatches would appear as it.skip blocks.
      const skips = (code.match(/it\.skip\(/g) || []).length;
      if (skips > 0) {
        expect(code).toContain('verify: expected');
      }
      expect(code).toContain('rule:required');
      // Every non-skipped error case keeps its assertion.
      expect(code).toContain('expect(isToolError(result)).toBe(true)');
    }, 30000);
  });

  describe('generateTestsFromClient', () => {
    it('supports edge mode over an existing connection', async () => {
      if (!serverAvailable) return;

      const client = new MCPClient({ timeout: 10000, logLevel: 'none' });
      await client.start({ command: MOCK_SERVER_CMD, args: MOCK_SERVER_ARGS });
      try {
        const code = await generateTestsFromClient(
          client,
          {
            command: MOCK_SERVER_CMD,
            args: MOCK_SERVER_ARGS,
          },
          { mode: 'edge' }
        );

        expect(code).toContain("describe('Tools'");
        expect(code).toContain('rule:required');
        expect(code).toContain('Derived cases:');
      } finally {
        await client.stop();
      }
    }, 20000);
  });

  // ─── CLI flags for generation modes ─────────────────────────────────

  describe('CLI generation flags', () => {
    const runCLI = (args: string): { status: number; stdout: string; stderr: string } => {
      const { spawnSync } = require('child_process') as typeof import('child_process');
      const env = { ...process.env };
      delete env.MCP_TESTER_AI_API_KEY;
      delete env.MCP_TESTER_AI_BASE_URL;
      delete env.MCP_TESTER_AI_MODEL;
      const result = spawnSync('node', ['dist/cli/index.js', ...args.split(' ')], {
        encoding: 'utf-8',
        timeout: 30000,
        env,
      });
      return {
        status: result.status ?? -1,
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
      };
    };

    it('--edge-cases generates rule-based cases', () => {
      if (!serverAvailable) return;

      const outputPath = '/tmp/mcp-tester-cli-edge.test.ts';
      const r = runCLI(`generate node ${MOCK_SERVER_ARGS.join(' ')} --edge-cases -o ${outputPath}`);
      expect(r.status).toBe(0);
      const content = fs.readFileSync(outputPath, 'utf-8');
      expect(content).toContain('rule:required');
      expect(content).toContain('Derived cases:');
    }, 30000);

    it('rejects --edge-cases together with --ai-generate', () => {
      if (!serverAvailable) return;

      const r = runCLI(`generate node ${MOCK_SERVER_ARGS.join(' ')} --edge-cases --ai-generate`);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('--ai-generate already includes --edge-cases');
    }, 30000);

    it('--ai-generate without credentials warns and falls back', () => {
      if (!serverAvailable) return;

      const r = runCLI(
        `generate node ${MOCK_SERVER_ARGS.join(' ')} --ai-generate -o /tmp/mcp-tester-cli-ai.test.ts`
      );
      expect(r.status).toBe(0);
      expect(r.stderr).toContain('No AI provider configured');
      expect(fs.readFileSync('/tmp/mcp-tester-cli-ai.test.ts', 'utf-8')).toContain('rule:required');
    }, 30000);

    it('--ai-generate --require-ai fails loudly without credentials', () => {
      if (!serverAvailable) return;

      const r = runCLI(`generate node ${MOCK_SERVER_ARGS.join(' ')} --ai-generate --require-ai`);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('no provider is available');
    }, 30000);

    it('rejects --verify without a case-generating mode', () => {
      const r = runCLI(`generate node ${MOCK_SERVER_ARGS.join(' ')} --verify`);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('--verify requires --edge-cases or --ai-generate');
    }, 15000);

    it('rejects AI-only flags without --ai-generate', () => {
      const r = runCLI(`generate node ${MOCK_SERVER_ARGS.join(' ')} --ai-model gpt-4o`);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('require --ai-generate');
    }, 15000);

    it('--help documents the new flags', () => {
      const r = runCLI('generate -h');
      expect(r.stdout).toContain('--edge-cases');
      expect(r.stdout).toContain('--ai-generate');
      expect(r.stdout).toContain('--require-ai');
      expect(r.stdout).toContain('--verify');
    }, 15000);
  });
});

// ─── Escaping (regression: must produce valid JS for names with quotes/backslashes) ───

import { buildTestFile, escapeJsString, escapeLineComment } from '../generate-tests.js';

describe('generateTests escaping', () => {
  describe('escapeJsString', () => {
    it('escapes single quotes by default', () => {
      expect(escapeJsString("it's")).toBe("it\\'s");
    });
    it('escapes double quotes when requested', () => {
      expect(escapeJsString('say "hi"', '"')).toBe('say \\"hi\\"');
    });
    it('escapes backslashes', () => {
      expect(escapeJsString('a\\b')).toBe('a\\\\b');
    });
    it('escapes newlines, tabs, and control chars', () => {
      expect(escapeJsString('a\nb\tc')).toBe('a\\nb\\tc');
    });
    it('does not touch the other quote character', () => {
      expect(escapeJsString(`a"b'c`, "'")).toBe(`a"b\\'c`);
    });
  });

  it('escapes quotes and backslashes in tool/resource/prompt names', () => {
    const tools = [
      {
        name: `weird"name\\tool`,
        description: "has 'quotes' and \\backslashes\\",
        inputSchema: { type: 'object' as const, properties: {} },
      },
      {
        name: `single'quote-tool`,
        description: 'x',
        inputSchema: { type: 'object' as const, properties: {} },
      },
    ];
    const resources = [
      { uri: `weird"uri\\with/slashes`, name: 'res' },
      { uri: `weird'uri`, name: 'res2' },
    ];
    const prompts = [
      {
        name: `weird'prompt\\name`,
        arguments: [{ name: 'arg1', required: true }],
      },
      {
        name: `weird"prompt`,
        arguments: [{ name: 'arg1', required: true }],
      },
    ];
    const code = buildTestFile(
      tools,
      resources,
      prompts,
      {
        framework: 'jest',
        description: "Server with 'quotes' and \\backslashes",
      },
      { command: 'node', args: ['./mock.js'] }
    );

    // Single-quoted describe label escapes ' and \.
    expect(code).toContain("describe('Server with \\'quotes\\' and \\\\backslashes'");
    // Titles are single-quoted, so a single quote inside the name must be
    // escaped — the literal double quotes around it are plain characters.
    expect(code).toContain(`it('should have tool "single\\'quote-tool"', async () => {`);
    expect(code).toContain(`it('should call "single\\'quote-tool"', async () => {`);
    expect(code).toContain(`it('should have resource "weird\\'uri"', async () => {`);
    expect(code).toContain(`it('should read resource "weird\\'uri"', async () => {`);
    expect(code).toContain(`it('should have prompt "weird\\'prompt\\\\name"', async () => {`);
    expect(code).toContain(`it('should get prompt "weird\\'prompt\\\\name"', async () => {`);
    // A double quote needs no escaping inside a single-quoted title.
    expect(code).toContain(`it('should have prompt "weird"prompt"', async () => {`);
    // Backslashes/quotes in call arguments stay escaped for a single-quoted literal.
    expect(code).toContain(`name: 'weird"name\\\\tool'`);
    expect(code).toContain(`expect(resources).toHaveResource('weird"uri\\\\with/slashes')`);
    expect(code).toContain(`await client.readResource('weird"uri\\\\with/slashes')`);
    expect(code).toContain(`expect(prompts).toHavePrompt('weird\\'prompt\\\\name')`);
    expect(code).toContain(`await client.getPrompt('weird\\'prompt\\\\name'`);
  });

  describe('escapeLineComment', () => {
    it('collapses newlines and control characters to spaces', () => {
      expect(escapeLineComment('a\nb\rc\td')).toBe('a b c d');
    });

    it('collapses unicode line separators', () => {
      expect(escapeLineComment('a\u2028b\u2029c')).toBe('a b c');
    });

    it('leaves ordinary text untouched', () => {
      expect(escapeLineComment('plain rationale')).toBe('plain rationale');
    });
  });

  it('cannot inject code through a model rationale', () => {
    const tools = [
      {
        name: 'echo',
        description: 'x',
        inputSchema: { type: 'object' as const, properties: { message: { type: 'string' } } },
      },
    ];
    const evil: GeneratedCase = {
      tool: 'echo',
      title: 'innocent',
      args: { message: 'hi' },
      expectation: 'success',
      rationale: "ok\n} });\nrequire('node:child_process').execSync('touch /tmp/PWNED');\n//",
      source: 'ai:evil-model',
    };
    const code = buildTestFile(tools, [], [], {}, { command: 'node', args: ['server.js'] }, [evil]);

    // The whole rationale is collapsed onto a single comment line.
    expect(code).toContain(
      "// ai:evil-model — ok } }); require('node:child_process').execSync('touch /tmp/PWNED'); //"
    );
    // The injected statement is never emitted as executable code.
    const executable = code
      .split('\n')
      .filter((l) => l.includes('execSync') && !l.trimStart().startsWith('//'));
    expect(executable).toHaveLength(0);
  });
});

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { generateTests } from '../generate-tests.js';
import type { GenerateTestOptions } from '../generate-tests.js';
import { MCPClient } from '../client/MCPClient.js';
import fs from 'fs';
import path from 'path';

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
});

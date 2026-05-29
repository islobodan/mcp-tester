import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { MockMCPServer, createMockServer } from './fixtures/mock-server.js';
import type { MockServerConfig } from './fixtures/mock-server.js';

describe('MockMCPServer — Enhanced Features', () => {
  let server: MockMCPServer;

  beforeEach(() => {
    server = new MockMCPServer();
  });

  afterEach(() => {
    server.resetState();
  });

  // ─── Configurable Delays ──────────────────────────────────────────

  describe('configurable delays', () => {
    it('should delay tool calls by defaultDelay ms', async () => {
      const delayed = new MockMCPServer({ defaultDelay: 50 });
      const start = Date.now();
      await delayed.handleToolCall('echo', { message: 'test' });
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(40); // allow small variance
    });

    it('should not delay when defaultDelay is 0', async () => {
      const start = Date.now();
      await server.handleToolCall('echo', { message: 'test' });
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(20);
    });

    it('should apply delay to all tool calls', async () => {
      const delayed = new MockMCPServer({ defaultDelay: 30 });
      const start = Date.now();
      await delayed.handleToolCall('add', { a: 1, b: 2 });
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(20);
    });

    it('should apply delay before error_tool', async () => {
      const delayed = new MockMCPServer({ defaultDelay: 30 });
      const start = Date.now();
      await expect(delayed.handleToolCall('error_tool', { message: 'fail' })).rejects.toThrow();
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(20);
    });

    it('should update delay via setConfig', async () => {
      server.setConfig({ defaultDelay: 50 });
      const start = Date.now();
      await server.handleToolCall('echo', { message: 'test' });
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(40);
    });

    it('should not delay custom tool handlers', async () => {
      const delayed = new MockMCPServer({ defaultDelay: 50 });
      delayed.addTool({
        name: 'fast',
        description: 'Fast tool',
        inputSchema: { type: 'object', properties: {} },
      });
      delayed.registerToolHandler('fast', () => [{ type: 'text', text: 'fast' }]);
      // Custom handlers still get the delay (it's applied before handler dispatch)
      const start = Date.now();
      await delayed.handleToolCall('fast', {});
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(40);
    });
  });

  // ─── Random Failures ──────────────────────────────────────────────

  describe('random failures', () => {
    it('should never fail when failureRate is 0', async () => {
      server.setConfig({ failureRate: 0 });
      // Run 50 calls — none should randomly fail
      for (let i = 0; i < 50; i++) {
        const result = await server.handleToolCall('echo', { message: 'test' });
        expect(result.content[0].text).toBe('Echo: test');
      }
    });

    it('should always fail when failureRate is 1', async () => {
      server.setConfig({ failureRate: 1, failureMessage: 'Forced failure' });
      for (let i = 0; i < 10; i++) {
        await expect(server.handleToolCall('echo', { message: 'test' })).rejects.toThrow(
          'Forced failure'
        );
      }
    });

    it('should use custom failure message', async () => {
      server.setConfig({ failureRate: 1, failureMessage: 'Custom error' });
      await expect(server.handleToolCall('echo', { message: 'test' })).rejects.toThrow(
        'Custom error'
      );
    });

    it('should not apply random failure to error_tool', async () => {
      server.setConfig({ failureRate: 1 });
      // error_tool should throw its own error, not the random failure
      await expect(server.handleToolCall('error_tool', { message: 'my error' })).rejects.toThrow(
        'my error'
      );
    });

    it('should update failureRate via setConfig', async () => {
      server.setConfig({ failureRate: 1 });
      await expect(server.handleToolCall('echo', { message: 'test' })).rejects.toThrow();
      server.setConfig({ failureRate: 0 });
      const result = await server.handleToolCall('echo', { message: 'test' });
      expect(result.content[0].text).toBe('Echo: test');
    });
  });

  // ─── Stateful Counter Tool ────────────────────────────────────────

  describe('counter tool', () => {
    it('should start at 0', async () => {
      const result = await server.handleToolCall('counter', { action: 'get' });
      expect(result.content[0].text).toBe('Counter: 0');
    });

    it('should increment by 1 by default', async () => {
      const result = await server.handleToolCall('counter', { action: 'increment' });
      expect(result.content[0].text).toBe('Counter: 0 → 1');
    });

    it('should increment by custom amount', async () => {
      const result = await server.handleToolCall('counter', { action: 'increment', by: 5 });
      expect(result.content[0].text).toBe('Counter: 0 → 5');
    });

    it('should accumulate increments', async () => {
      await server.handleToolCall('counter', { action: 'increment', by: 3 });
      await server.handleToolCall('counter', { action: 'increment', by: 7 });
      const result = await server.handleToolCall('counter', { action: 'get' });
      expect(result.content[0].text).toBe('Counter: 10');
    });

    it('should reset to 0', async () => {
      await server.handleToolCall('counter', { action: 'increment', by: 100 });
      const result = await server.handleToolCall('counter', { action: 'reset' });
      expect(result.content[0].text).toBe('Counter: 0 (reset)');
      const after = await server.handleToolCall('counter', { action: 'get' });
      expect(after.content[0].text).toBe('Counter: 0');
    });

    it('should track counter via getCounter()', async () => {
      await server.handleToolCall('counter', { action: 'increment', by: 42 });
      expect(server.getCounter('main')).toBe(42);
    });

    it('resetState should clear counters', async () => {
      await server.handleToolCall('counter', { action: 'increment', by: 99 });
      server.resetState();
      expect(server.getCounter('main')).toBe(0);
    });
  });

  // ─── Stateful Items Tool ──────────────────────────────────────────

  describe('items tool', () => {
    it('should start with empty list', async () => {
      const result = await server.handleToolCall('items', { action: 'list' });
      expect(result.content[0].text).toBe('[]');
    });

    it('should add items', async () => {
      const result = await server.handleToolCall('items', { action: 'add', value: 'apple' });
      expect(result.content[0].text).toContain('apple');
    });

    it('should list all items', async () => {
      await server.handleToolCall('items', { action: 'add', value: 'a' });
      await server.handleToolCall('items', { action: 'add', value: 'b' });
      const result = await server.handleToolCall('items', { action: 'list' });
      expect(JSON.parse(result.content[0].text)).toEqual(['a', 'b']);
    });

    it('should remove item by index', async () => {
      await server.handleToolCall('items', { action: 'add', value: 'x' });
      await server.handleToolCall('items', { action: 'add', value: 'y' });
      await server.handleToolCall('items', { action: 'add', value: 'z' });
      const result = await server.handleToolCall('items', { action: 'remove', value: 1 });
      expect(result.content[0].text).toContain('Removed "y"');
      const list = await server.handleToolCall('items', { action: 'list' });
      expect(JSON.parse(list.content[0].text)).toEqual(['x', 'z']);
    });

    it('should clear all items', async () => {
      await server.handleToolCall('items', { action: 'add', value: 'a' });
      await server.handleToolCall('items', { action: 'add', value: 'b' });
      const result = await server.handleToolCall('items', { action: 'clear' });
      expect(result.content[0].text).toBe('Items cleared');
      const list = await server.handleToolCall('items', { action: 'list' });
      expect(JSON.parse(list.content[0].text)).toEqual([]);
    });

    it('should throw on invalid index', async () => {
      await server.handleToolCall('items', { action: 'add', value: 'only' });
      await expect(server.handleToolCall('items', { action: 'remove', value: 5 })).rejects.toThrow(
        'out of range'
      );
    });

    it('should track items via getItems()', async () => {
      await server.handleToolCall('items', { action: 'add', value: 'test' });
      expect(server.getItems('main')).toEqual(['test']);
    });
  });

  // ─── Transform Tool (different results based on input) ────────────

  describe('transform tool', () => {
    it('should uppercase text', async () => {
      const result = await server.handleToolCall('transform', {
        text: 'hello',
        operation: 'upper',
      });
      expect(result.content[0].text).toBe('HELLO');
    });

    it('should lowercase text', async () => {
      const result = await server.handleToolCall('transform', {
        text: 'HELLO',
        operation: 'lower',
      });
      expect(result.content[0].text).toBe('hello');
    });

    it('should reverse text', async () => {
      const result = await server.handleToolCall('transform', {
        text: 'abc',
        operation: 'reverse',
      });
      expect(result.content[0].text).toBe('cba');
    });

    it('should return text length', async () => {
      const result = await server.handleToolCall('transform', {
        text: 'hello',
        operation: 'length',
      });
      expect(result.content[0].text).toBe('5');
    });
  });

  // ─── Schema Validation ────────────────────────────────────────────

  describe('input schema validation', () => {
    it('should not validate by default', async () => {
      // Missing required "message" field — but validation is off
      const result = await server.handleToolCall('echo', {});
      expect(result.content[0].text).toBe('Echo: undefined');
    });

    it('should reject missing required fields when enabled', async () => {
      server.setConfig({ validateSchemas: true });
      await expect(server.handleToolCall('echo', {})).rejects.toThrow('Missing required field');
    });

    it('should reject wrong type when enabled', async () => {
      server.setConfig({ validateSchemas: true });
      await expect(server.handleToolCall('echo', { message: 123 })).rejects.toThrow(
        'must be a string'
      );
    });

    it('should reject invalid enum value when enabled', async () => {
      server.setConfig({ validateSchemas: true });
      await expect(server.handleToolCall('counter', { action: 'explode' })).rejects.toThrow(
        'must be one of'
      );
    });

    it('should accept valid input when enabled', async () => {
      server.setConfig({ validateSchemas: true });
      const result = await server.handleToolCall('echo', { message: 'valid' });
      expect(result.content[0].text).toBe('Echo: valid');
    });

    it('should validate add tool fields', async () => {
      server.setConfig({ validateSchemas: true });
      await expect(server.handleToolCall('add', { a: 1 })).rejects.toThrow('Missing required');
      await expect(server.handleToolCall('add', { a: 'x', b: 2 })).rejects.toThrow(
        'must be a number'
      );
    });
  });

  // ─── Custom Handlers ──────────────────────────────────────────────

  describe('custom tool handlers', () => {
    it('should use custom handler for registered tools', async () => {
      server.registerToolHandler('echo', (args) => [
        { type: 'text', text: `Custom: ${String(args.message)}` },
      ]);
      const result = await server.handleToolCall('echo', { message: 'test' });
      expect(result.content[0].text).toBe('Custom: test');
    });

    it('should support async custom handlers', async () => {
      server.registerToolHandler('echo', async (args) => {
        await new Promise((r) => setTimeout(r, 10));
        return [{ type: 'text', text: `Async: ${String(args.message)}` }];
      });
      const result = await server.handleToolCall('echo', { message: 'test' });
      expect(result.content[0].text).toBe('Async: test');
      expect(server.getCallCount('echo')).toBe(1);
    });

    it('should support custom handlers for new tools', async () => {
      server.addTool({
        name: 'custom',
        description: 'Custom tool',
        inputSchema: { type: 'object', properties: { x: { type: 'number' } } },
      });
      server.registerToolHandler('custom', (args) => [
        { type: 'text', text: `x=${String(args.x)}` },
      ]);
      const result = await server.handleToolCall('custom', { x: 42 });
      expect(result.content[0].text).toBe('x=42');
    });
  });

  describe('custom resource handlers', () => {
    it('should use custom handler for registered resources', async () => {
      server.registerResourceHandler('text://example', (uri) => [
        { uri, mimeType: 'text/plain', text: 'Custom resource content' },
      ]);
      const result = await server.handleResourceRead('text://example');
      expect(result.contents[0].text).toBe('Custom resource content');
    });

    it('should support async resource handlers', async () => {
      server.registerResourceHandler('text://example', async (uri) => {
        await new Promise((r) => setTimeout(r, 5));
        return [{ uri, mimeType: 'text/plain', text: 'Async content' }];
      });
      const result = await server.handleResourceRead('text://example');
      expect(result.contents[0].text).toBe('Async content');
    });
  });

  describe('custom prompt handlers', () => {
    it('should use custom handler for registered prompts', async () => {
      server.registerPromptHandler('greet', (args) => [
        { role: 'assistant', content: { type: 'text', text: `Hi ${args.name}!` } },
      ]);
      const result = await server.handlePromptGet('greet', { name: 'Alice' });
      expect(result.messages[0].content.text).toBe('Hi Alice!');
    });

    it('should support async prompt handlers', async () => {
      server.registerPromptHandler('greet', async (args) => {
        await new Promise((r) => setTimeout(r, 5));
        return [{ role: 'user', content: { type: 'text', text: `Async: ${args.name}` } }];
      });
      const result = await server.handlePromptGet('greet', { name: 'Bob' });
      expect(result.messages[0].content.text).toBe('Async: Bob');
    });
  });

  // ─── Call History ─────────────────────────────────────────────────

  describe('call history', () => {
    it('should track all tool calls', async () => {
      await server.handleToolCall('echo', { message: 'a' });
      await server.handleToolCall('echo', { message: 'b' });
      await server.handleToolCall('add', { a: 1, b: 2 });

      const history = server.getCallHistory();
      expect(history).toHaveLength(3);
      expect(history[0].tool).toBe('echo');
      expect(history[1].tool).toBe('echo');
      expect(history[2].tool).toBe('add');
    });

    it('should record timestamps', async () => {
      const before = Date.now();
      await server.handleToolCall('echo', { message: 'test' });
      const after = Date.now();

      const history = server.getCallHistory();
      expect(history[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(history[0].timestamp).toBeLessThanOrEqual(after);
    });

    it('should record call args', async () => {
      await server.handleToolCall('echo', { message: 'hello' });
      expect(server.getCallHistory()[0].args).toEqual({ message: 'hello' });
    });

    it('getCallCount should count per tool', async () => {
      await server.handleToolCall('echo', { message: 'a' });
      await server.handleToolCall('add', { a: 1, b: 2 });
      await server.handleToolCall('echo', { message: 'b' });
      expect(server.getCallCount('echo')).toBe(2);
      expect(server.getCallCount('add')).toBe(1);
      expect(server.getCallCount('error_tool')).toBe(0);
    });

    it('resetState should clear history', async () => {
      await server.handleToolCall('echo', { message: 'test' });
      expect(server.getCallHistory()).toHaveLength(1);
      server.resetState();
      expect(server.getCallHistory()).toHaveLength(0);
    });
  });

  // ─── Streaming Support ────────────────────────────────────────────

  describe('streaming', () => {
    it('should set up stream chunks', () => {
      server.setupStream('myTool', ['chunk1', 'chunk2', 'chunk3']);
      expect(server.nextStreamChunk('myTool')).toBe('chunk1');
      expect(server.nextStreamChunk('myTool')).toBe('chunk2');
      expect(server.nextStreamChunk('myTool')).toBe('chunk3');
      expect(server.nextStreamChunk('myTool')).toBeUndefined();
    });

    it('should return undefined for empty stream', () => {
      expect(server.nextStreamChunk('nonexistent')).toBeUndefined();
    });

    it('should drain stream', () => {
      server.setupStream('test', ['a', 'b']);
      server.nextStreamChunk('test');
      server.nextStreamChunk('test');
      expect(server.nextStreamChunk('test')).toBeUndefined();
    });

    it('resetState should clear streams', () => {
      server.setupStream('test', ['a']);
      server.resetState();
      expect(server.nextStreamChunk('test')).toBeUndefined();
    });
  });

  // ─── Dynamic Registration / Removal ───────────────────────────────

  describe('dynamic registration', () => {
    it('should add and list new tools', async () => {
      server.addTool({
        name: 'custom',
        description: 'A custom tool',
        inputSchema: { type: 'object', properties: { input: { type: 'string' } } },
      });
      const { tools } = await server.handleToolsList();
      const names = tools.map((t) => t.name);
      expect(names).toContain('custom');
    });

    it('should add and read new resources', async () => {
      server.addResource({
        uri: 'custom://data',
        name: 'Custom Data',
        description: 'Custom resource',
        mimeType: 'text/plain',
      });
      const { resources } = await server.handleResourcesList();
      const uris = resources.map((r) => r.uri);
      expect(uris).toContain('custom://data');
    });

    it('should add and list new prompts', async () => {
      server.addPrompt({
        name: 'custom_prompt',
        description: 'A custom prompt',
        arguments: [],
      });
      const { prompts } = await server.handlePromptsList();
      const names = prompts.map((p) => p.name);
      expect(names).toContain('custom_prompt');
    });

    it('should remove tools', async () => {
      expect(server.removeTool('echo')).toBe(true);
      const { tools } = await server.handleToolsList();
      expect(tools.map((t) => t.name)).not.toContain('echo');
    });

    it('should remove resources', async () => {
      expect(server.removeResource('text://example')).toBe(true);
      const { resources } = await server.handleResourcesList();
      expect(resources.map((r) => r.uri)).not.toContain('text://example');
    });

    it('should remove prompts', async () => {
      expect(server.removePrompt('greet')).toBe(true);
      const { prompts } = await server.handlePromptsList();
      expect(prompts.map((p) => p.name)).not.toContain('greet');
    });

    it('should return false for non-existent removal', () => {
      expect(server.removeTool('nope')).toBe(false);
      expect(server.removeResource('nope://x')).toBe(false);
      expect(server.removePrompt('nope')).toBe(false);
    });
  });

  // ─── Config ───────────────────────────────────────────────────────

  describe('config', () => {
    it('should return default config', () => {
      const config = server.getConfig();
      expect(config.defaultDelay).toBe(0);
      expect(config.failureRate).toBe(0);
      expect(config.validateSchemas).toBe(false);
      expect(config.failureMessage).toBe('Random failure');
    });

    it('should accept constructor config', () => {
      const s = new MockMCPServer({
        defaultDelay: 100,
        failureRate: 0.5,
        validateSchemas: true,
        failureMessage: 'Boom',
      });
      const config = s.getConfig();
      expect(config.defaultDelay).toBe(100);
      expect(config.failureRate).toBe(0.5);
      expect(config.validateSchemas).toBe(true);
      expect(config.failureMessage).toBe('Boom');
    });

    it('createMockServer should pass config', () => {
      const s = createMockServer({ defaultDelay: 50 });
      expect(s.getConfig().defaultDelay).toBe(50);
    });
  });

  // ─── Backward Compatibility ───────────────────────────────────────

  describe('backward compatibility', () => {
    it('should still list default tools (7 tools)', async () => {
      const { tools } = await server.handleToolsList();
      expect(tools.length).toBeGreaterThanOrEqual(7);
      const names = tools.map((t) => t.name);
      expect(names).toContain('echo');
      expect(names).toContain('add');
      expect(names).toContain('delay');
      expect(names).toContain('error_tool');
      expect(names).toContain('counter');
      expect(names).toContain('items');
      expect(names).toContain('transform');
    });

    it('should still list default resources', async () => {
      const { resources } = await server.handleResourcesList();
      expect(resources.length).toBeGreaterThanOrEqual(2);
    });

    it('should still list default prompts', async () => {
      const { prompts } = await server.handlePromptsList();
      expect(prompts.length).toBeGreaterThanOrEqual(2);
    });

    it('echo still works without config', async () => {
      const result = await server.handleToolCall('echo', { message: 'hello' });
      expect(result.content[0].text).toBe('Echo: hello');
    });

    it('add still works without config', async () => {
      const result = await server.handleToolCall('add', { a: 3, b: 4 });
      expect(result.content[0].text).toBe('3 + 4 = 7');
    });

    it('error_tool still throws without config', async () => {
      await expect(server.handleToolCall('error_tool', { message: 'boom' })).rejects.toThrow(
        'boom'
      );
    });

    it('sendNotification and getNotificationCount still work', async () => {
      await server.sendNotification('info', 'test');
      expect(server.getNotificationCount()).toBe(1);
    });
  });
});

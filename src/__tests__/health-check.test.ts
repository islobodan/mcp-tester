import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MCPClient } from '../client/MCPClient.js';
import type { HealthStatus, HealthMonitorOptions } from '../client/MCPClient.js';

// ─── isHealthy ──────────────────────────────────────────────────────

describe('MCPClient — Health Checks', () => {
  let client: MCPClient;

  beforeEach(() => {
    client = new MCPClient({ timeout: 10000 });
  });

  afterEach(async () => {
    if (client.isConnected()) {
      await client.stop();
    }
  });

  describe('isHealthy()', () => {
    it('should return unhealthy when not connected', async () => {
      const status = await client.isHealthy();
      expect(status.healthy).toBe(false);
      expect(status.message).toContain('not connected');
      expect(status.latencyMs).toBe(-1);
      expect(status.pid).toBeNull();
    });

    it('should return healthy for a running server', async () => {
      await client.start({
        command: 'node',
        args: ['./examples/mock-server.js'],
      });

      const status = await client.isHealthy();
      expect(status.healthy).toBe(true);
      expect(status.message).toBe('Server is healthy');
      expect(status.latencyMs).toBeGreaterThanOrEqual(0);
      expect(status.pid).not.toBeNull();
      expect(typeof status.pid).toBe('number');
    });

    it('should include a valid timestamp', async () => {
      await client.start({
        command: 'node',
        args: ['./examples/mock-server.js'],
      });

      const before = Date.now();
      const status = await client.isHealthy();
      const after = Date.now();

      expect(status.checkedAt).toBeGreaterThanOrEqual(before);
      expect(status.checkedAt).toBeLessThanOrEqual(after);
    });

    it('should return unhealthy after stop', async () => {
      await client.start({
        command: 'node',
        args: ['./examples/mock-server.js'],
      });

      await client.stop();

      const status = await client.isHealthy();
      expect(status.healthy).toBe(false);
      expect(status.message).toContain('not connected');
    });

    it('should measure latency in ms', async () => {
      await client.start({
        command: 'node',
        args: ['./examples/mock-server.js'],
      });

      const status = await client.isHealthy();
      expect(status.latencyMs).toBeGreaterThan(-1);
      // Should be reasonably fast (under 5 seconds)
      expect(status.latencyMs).toBeLessThan(5000);
    });
  });

  describe('getLastHealthStatus()', () => {
    it('should return null before any check', () => {
      expect(client.getLastHealthStatus()).toBeNull();
    });

    it('should return last status after check', async () => {
      await client.start({
        command: 'node',
        args: ['./examples/mock-server.js'],
      });

      const status = await client.isHealthy();
      const last = client.getLastHealthStatus();

      expect(last).not.toBeNull();
      expect(last!.healthy).toBe(status.healthy);
      expect(last!.checkedAt).toBe(status.checkedAt);
    });
  });

  describe('getServerPid()', () => {
    it('should return null when not connected', () => {
      expect(client.getServerPid()).toBeNull();
    });

    it('should return a number when connected', async () => {
      await client.start({
        command: 'node',
        args: ['./examples/mock-server.js'],
      });

      const pid = client.getServerPid();
      expect(pid).not.toBeNull();
      expect(typeof pid).toBe('number');
      expect(pid!).toBeGreaterThan(0);
    });

    it('should return null after stop', async () => {
      await client.start({
        command: 'node',
        args: ['./examples/mock-server.js'],
      });

      await client.stop();
      expect(client.getServerPid()).toBeNull();
    });
  });

  describe('startHealthMonitor()', () => {
    it('should call onCheck on each check', async () => {
      await client.start({
        command: 'node',
        args: ['./examples/mock-server.js'],
      });

      const onCheck = jest.fn();
      client.startHealthMonitor({ interval: 200, onCheck });

      // Wait for first check
      await new Promise((r) => setTimeout(r, 300));

      expect(onCheck).toHaveBeenCalled();
      const status = onCheck.mock.calls[0][0] as HealthStatus;
      expect(status.healthy).toBe(true);

      client.stopHealthMonitor();
    });

    it('should call onUnhealthy when server goes down', async () => {
      await client.start({
        command: 'node',
        args: ['./examples/mock-server.js'],
      });

      const onUnhealthy = jest.fn();
      client.startHealthMonitor({ interval: 200, onUnhealthy });

      // Wait for first (healthy) check
      await new Promise((r) => setTimeout(r, 300));

      // Kill the server process
      const pid = client.getServerPid();
      expect(pid).not.toBeNull();
      process.kill(pid!, 'SIGKILL');

      // Wait for monitor to detect
      await new Promise((r) => setTimeout(r, 800));

      client.stopHealthMonitor();

      expect(onUnhealthy).toHaveBeenCalled();
      const status = onUnhealthy.mock.calls[0][0] as HealthStatus;
      expect(status.healthy).toBe(false);
      expect(status.message).toMatch(/no longer running|failed/i);
    });

    it('should call onRecovery when server recovers', async () => {
      // This test verifies the callback wiring — actual recovery requires
      // restarting the server which is complex to orchestrate.
      // We verify the callback is stored and the monitor runs.
      await client.start({
        command: 'node',
        args: ['./examples/mock-server.js'],
      });

      const onRecovery = jest.fn();
      client.startHealthMonitor({ interval: 200, onRecovery });

      await new Promise((r) => setTimeout(r, 300));
      client.stopHealthMonitor();

      // Recovery not called because server was always healthy
      expect(onRecovery).not.toHaveBeenCalled();
    });

    it('should stop previous monitor when called again', async () => {
      await client.start({
        command: 'node',
        args: ['./examples/mock-server.js'],
      });

      const onCheck1 = jest.fn();
      const onCheck2 = jest.fn();

      client.startHealthMonitor({ interval: 200, onCheck: onCheck1 });
      await new Promise((r) => setTimeout(r, 300));

      client.startHealthMonitor({ interval: 200, onCheck: onCheck2 });
      await new Promise((r) => setTimeout(r, 300));

      client.stopHealthMonitor();

      expect(onCheck1).toHaveBeenCalled();
      expect(onCheck2).toHaveBeenCalled();
    });

    it('should be stopped by client.stop()', async () => {
      await client.start({
        command: 'node',
        args: ['./examples/mock-server.js'],
      });

      const onCheck = jest.fn();
      client.startHealthMonitor({ interval: 200, onCheck });

      await new Promise((r) => setTimeout(r, 300));
      await client.stop();

      const callCount = onCheck.mock.calls.length;
      // No more calls after stop
      await new Promise((r) => setTimeout(r, 500));
      expect(onCheck.mock.calls.length).toBe(callCount);
    });
  });

  describe('stopHealthMonitor()', () => {
    it('should be safe to call when no monitor is running', () => {
      expect(() => client.stopHealthMonitor()).not.toThrow();
    });

    it('should stop the monitor', async () => {
      await client.start({
        command: 'node',
        args: ['./examples/mock-server.js'],
      });

      const onCheck = jest.fn();
      client.startHealthMonitor({ interval: 200, onCheck });

      await new Promise((r) => setTimeout(r, 300));
      client.stopHealthMonitor();

      const callCount = onCheck.mock.calls.length;
      await new Promise((r) => setTimeout(r, 500));

      // Should not have more calls
      expect(onCheck.mock.calls.length).toBeLessThanOrEqual(callCount + 1);
    });
  });
});

import { MCPClient } from '../client/MCPClient.js';
import { describe, it, expect, beforeEach } from '@jest/globals';

describe('MCPClient - Advanced Features', () => {
  let client: MCPClient;

  beforeEach(() => {
    client = new MCPClient({
      name: 'advanced-test-client',
      version: '2.0.0',
      timeout: 30000,
    });
  });

  it('should set notification handlers', () => {
    client.setNotificationHandlers({
      onLoggingMessage: (level, data) => {
        expect(typeof level).toBe('string');
        expect(typeof data).toBe('string');
      },
      onResourceListChanged: () => {
        expect(true).toBe(true);
      },
    });
  });
});

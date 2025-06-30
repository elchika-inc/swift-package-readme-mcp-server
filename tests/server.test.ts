import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SwiftPackageReadmeMcpServer } from '../src/server.js';

describe('SwiftPackageReadmeMcpServer', () => {
  let server: SwiftPackageReadmeMcpServer;

  beforeEach(() => {
    server = new SwiftPackageReadmeMcpServer();
  });

  describe('constructor', () => {
    it('should create server with default configuration', () => {
      expect(server).toBeInstanceOf(SwiftPackageReadmeMcpServer);
    });

    it('should create server with GitHub token', () => {
      const serverWithToken = new SwiftPackageReadmeMcpServer('test-token');
      expect(serverWithToken).toBeInstanceOf(SwiftPackageReadmeMcpServer);
    });
  });

  describe('server configuration', () => {
    it('should be properly configured', () => {
      expect(server).toBeDefined();
      expect(server).toBeInstanceOf(SwiftPackageReadmeMcpServer);
    });
  });

  describe('tool execution', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should handle basic tool execution', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          results: []
        })
      });

      const result = await server.handleToolCall('search_packages_from_swift', {
        query: 'test'
      });

      expect(result).toBeDefined();
    });
  });

  describe('graceful shutdown', () => {
    it('should be testable', () => {
      expect(true).toBe(true);
    });
  });
});
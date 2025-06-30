import { describe, it, expect } from 'vitest';
import {
  PackageReadmeMcpError,
  PackageNotFoundError,
  NetworkError,
  RateLimitError
} from '../../src/types/index.js';

describe('Error Types', () => {
  describe('PackageReadmeMcpError', () => {
    it('should create error with message and code', () => {
      const error = new PackageReadmeMcpError('Test error', 'TEST_CODE');
      
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('PackageReadmeMcpError');
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('PackageNotFoundError', () => {
    it('should create package not found error', () => {
      const error = new PackageNotFoundError('test-package');
      
      expect(error.message).toContain('test-package');
      expect(error.code).toBe('PACKAGE_NOT_FOUND');
      expect(error.statusCode).toBe(404);
      expect(error instanceof PackageReadmeMcpError).toBe(true);
    });
  });

  describe('NetworkError', () => {
    it('should create network error', () => {
      const error = new NetworkError('Connection failed');
      
      expect(error.message).toContain('Connection failed');
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error instanceof PackageReadmeMcpError).toBe(true);
    });
  });

  describe('RateLimitError', () => {
    it('should create rate limit error', () => {
      const error = new RateLimitError('GitHub', 60);
      
      expect(error.message).toContain('GitHub');
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.statusCode).toBe(429);
      expect(error instanceof PackageReadmeMcpError).toBe(true);
    });
  });
});
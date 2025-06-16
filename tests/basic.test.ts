import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { swiftPackageIndexApiService } from '../src/services/swift-package-index-api.js';
import { githubApiService } from '../src/services/github-api.js';
import { cacheManager } from '../src/services/cache.js';
import { PackageNameValidator, SearchQueryValidator } from '../src/utils/validators.js';

describe('Swift Package README MCP Server', () => {
  beforeEach(() => {
    cacheManager.clearAll();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('PackageNameValidator', () => {
    it('should validate package names correctly', () => {
      expect(() => PackageNameValidator.validatePackageName('SwiftUI')).not.toThrow();
      expect(() => PackageNameValidator.validatePackageName('swift-argument-parser')).not.toThrow();
      expect(() => PackageNameValidator.validatePackageName('Foundation')).not.toThrow();
      expect(() => PackageNameValidator.validatePackageName('')).toThrow();
      expect(() => PackageNameValidator.validatePackageName('a'.repeat(300))).toThrow();
    });
  });

  describe('SearchQueryValidator', () => {
    it('should validate search queries correctly', () => {
      expect(() => SearchQueryValidator.validateSearchQuery('networking')).not.toThrow();
      expect(() => SearchQueryValidator.validateSearchQuery('swift ui')).not.toThrow();
      expect(() => SearchQueryValidator.validateSearchQuery('')).toThrow();
      expect(() => SearchQueryValidator.validateSearchQuery('a'.repeat(300))).toThrow();
    });
  });

  describe('CacheManager', () => {
    it('should store and retrieve package info correctly', () => {
      const packageName = 'test-package';
      const version = '1.0.0';
      const value = { test: 'data' };
      
      cacheManager.setPackageInfo(packageName, version, value);
      const retrieved = cacheManager.getPackageInfo(packageName, version);
      
      expect(retrieved).toEqual(value);
    });

    it('should store and retrieve general cache values correctly', () => {
      const key = 'test-key';
      const value = { test: 'data' };
      
      cacheManager.setGeneral(key, value, 60);
      const retrieved = cacheManager.getGeneral(key);
      
      expect(retrieved).toEqual(value);
    });

    it('should clear all cached values', () => {
      cacheManager.setGeneral('key1', 'value1', 60);
      cacheManager.setPackageInfo('pkg', '1.0.0', { data: 'test' });
      
      cacheManager.clearAll();
      
      expect(cacheManager.getGeneral('key1')).toBeUndefined();
      expect(cacheManager.getPackageInfo('pkg', '1.0.0')).toBeUndefined();
    });
  });

  describe('Swift Package Index API', () => {
    it('should search packages successfully', async () => {
      // Mock the API response
      const mockResponse = {
        results: [
          {
            packageName: 'SwiftUI',
            packageURL: 'https://github.com/apple/swift-ui',
            summary: 'User interface toolkit'
          }
        ]
      };

      const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
      global.fetch = mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response);

      const result = await swiftPackageIndexApiService.searchPackages('SwiftUI', 10);
      expect(result).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('should handle API errors gracefully', async () => {
      const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
      global.fetch = mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      } as Response);

      await expect(swiftPackageIndexApiService.searchPackages('nonexistent', 10))
        .rejects.toThrow();
    });
  });

  describe('GitHub API', () => {
    it('should get repository information', async () => {
      const mockRepo = {
        id: 123,
        name: 'swift-argument-parser',
        full_name: 'apple/swift-argument-parser',
        description: 'Straightforward, type-safe argument parsing for Swift',
        stargazers_count: 1000,
        forks_count: 100,
        owner: { login: 'apple' }
      };

      const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
      global.fetch = mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockRepo)
      } as Response);

      const result = await githubApiService.getRepository('apple', 'swift-argument-parser');
      expect(result).toEqual(mockRepo);
    });

    it('should get package README successfully', async () => {
      const mockReadme = 'IyBTd2lmdCBBcmd1bWVudCBQYXJzZXI='; // Base64 encoded
      
      const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
      global.fetch = mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: mockReadme,
          encoding: 'base64'
        })
      } as Response);

      const result = await githubApiService.getReadme('apple', 'swift-argument-parser');
      expect(result).toBeDefined();
      expect(typeof result.content).toBe('string');
    });
  });

  describe('Integration Tests', () => {
    it('should handle package that exists in SPI', async () => {
      // Mock successful SPI response
      const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
      global.fetch = mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            results: [{
              packageName: 'swift-argument-parser',
              packageURL: 'https://github.com/apple/swift-argument-parser',
              repositoryOwner: 'apple',
              repositoryName: 'swift-argument-parser',
              summary: 'Straightforward, type-safe argument parsing for Swift'
            }]
          })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            content: 'IyBTd2lmdCBBcmd1bWVudCBQYXJzZXI=',
            encoding: 'base64'
          })
        } as Response);

      const searchResult = await swiftPackageIndexApiService.searchPackages('swift-argument-parser', 1);
      expect(searchResult.results.length).toBeGreaterThan(0);
      
      if (searchResult.results[0]) {
        const owner = searchResult.results[0].repositoryOwner;
        const repo = searchResult.results[0].repositoryName;
        const readme = await githubApiService.getReadme(owner, repo);
        expect(readme).toBeDefined();
      }
    });

    it('should handle package that does not exist', async () => {
      const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
      global.fetch = mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] })
      } as Response);

      const result = await swiftPackageIndexApiService.searchPackages('nonexistent-package-xyz', 10);
      expect(result.results).toEqual([]);
    });
  });
});
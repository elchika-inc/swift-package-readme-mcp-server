import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SwiftPackageIndexApiService } from '../../src/services/swift-package-index-api.js';
import { PackageNotFoundError, NetworkError } from '../../src/types/index.js';

describe('SwiftPackageIndexApi', () => {
  let api: SwiftPackageIndexApiService;

  beforeEach(() => {
    api = new SwiftPackageIndexApiService();
    vi.clearAllMocks();
  });

  describe('searchPackages', () => {
    it('should search packages successfully', async () => {
      const mockResponse = {
        results: [
          {
            packageName: 'Alamofire',
            packageURL: 'https://github.com/Alamofire/Alamofire',
            repositoryName: 'Alamofire/Alamofire',
            repositoryOwner: 'Alamofire',
            summary: 'Elegant HTTP Networking in Swift'
          }
        ]
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await api.searchPackages('Alamofire', 10);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://swiftpackageindex.com/api/search?query=Alamofire',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'swift-package-readme-mcp-server'
          })
        })
      );
    });

    it('should handle empty results', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] })
      });

      const result = await api.searchPackages('nonexistent');
      expect(result.results).toEqual([]);
    });
  });

  describe('getPackage', () => {
    it('should get package info successfully', async () => {
      const mockResponse = {
        packageName: 'Alamofire',
        repositoryName: 'Alamofire/Alamofire',
        repositoryOwner: 'Alamofire',
        summary: 'Elegant HTTP Networking in Swift',
        swiftVersions: ['5.0', '5.1', '5.2'],
        platforms: [
          { name: 'iOS', version: '10.0' },
          { name: 'macOS', version: '10.12' }
        ]
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await api.getPackage('Alamofire', 'Alamofire');

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://swiftpackageindex.com/api/packages/Alamofire/Alamofire',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'swift-package-readme-mcp-server'
          })
        })
      );
    });
  });
});
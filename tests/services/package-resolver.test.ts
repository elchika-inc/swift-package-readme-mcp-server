import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SwiftPackageResolver } from '../../src/services/package-resolver.js';
import { githubApiService } from '../../src/services/github-api.js';

vi.mock('../../src/services/github-api.js');
vi.mock('../../src/utils/logger.js');

describe('SwiftPackageResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('resolveFromCommonPatterns', () => {
    it('should resolve package from first matching pattern', async () => {
      const mockRepo = {
        id: 1,
        name: 'Alamofire',
        full_name: 'apple/Alamofire',
        owner: { login: 'apple' },
        html_url: 'https://github.com/apple/Alamofire',
      };

      vi.mocked(githubApiService.getRepository).mockResolvedValueOnce(mockRepo);

      const result = await SwiftPackageResolver.resolveFromCommonPatterns('Alamofire');

      expect(result).toEqual({
        owner: 'apple',
        repo: 'Alamofire',
        url: 'https://github.com/apple/Alamofire'
      });
      expect(githubApiService.getRepository).toHaveBeenCalledWith('apple', 'Alamofire');
    });

    it('should try multiple patterns until one succeeds', async () => {
      const mockRepo = {
        id: 1,
        name: 'Package',
        full_name: 'swiftlang/Package',
        owner: { login: 'swiftlang' },
        html_url: 'https://github.com/swiftlang/Package',
      };

      vi.mocked(githubApiService.getRepository)
        .mockRejectedValueOnce(new Error('Not found'))  // apple/Package
        .mockRejectedValueOnce(new Error('Not found'))  // apple/swift-Package
        .mockResolvedValueOnce(mockRepo);                // swiftlang/Package

      const result = await SwiftPackageResolver.resolveFromCommonPatterns('Package');

      expect(result).toEqual({
        owner: 'swiftlang',
        repo: 'Package',
        url: 'https://github.com/swiftlang/Package'
      });
      expect(githubApiService.getRepository).toHaveBeenCalledTimes(3);
    });

    it('should handle hyphenated package names', async () => {
      const mockRepo = {
        id: 1,
        name: 'swift-crypto',
        full_name: 'vapor/swift-crypto',
        owner: { login: 'vapor' },
        html_url: 'https://github.com/vapor/swift-crypto',
      };

      vi.mocked(githubApiService.getRepository)
        .mockRejectedValueOnce(new Error('Not found'))   // apple/swift-crypto
        .mockRejectedValueOnce(new Error('Not found'))   // apple/swift-swift-crypto
        .mockRejectedValueOnce(new Error('Not found'))   // swiftlang/swift-crypto
        .mockResolvedValueOnce(mockRepo);                 // vapor/swift-crypto

      const result = await SwiftPackageResolver.resolveFromCommonPatterns('swift-crypto');

      expect(result.owner).toBe('vapor');
      expect(result.repo).toBe('swift-crypto');
      expect(githubApiService.getRepository).toHaveBeenCalledWith('vapor', 'swift-crypto');
    });

    it('should throw error when no patterns match', async () => {
      vi.mocked(githubApiService.getRepository).mockRejectedValue(new Error('Not found'));

      await expect(SwiftPackageResolver.resolveFromCommonPatterns('NonExistentPackage'))
        .rejects
        .toThrow("Package 'NonExistentPackage' not found in Swift Package Index or common GitHub patterns");
    });

    it('should handle empty package name', async () => {
      vi.mocked(githubApiService.getRepository).mockRejectedValue(new Error('Not found'));

      await expect(SwiftPackageResolver.resolveFromCommonPatterns(''))
        .rejects
        .toThrow("Package '' not found in Swift Package Index or common GitHub patterns");
    });

    it('should handle package names with special characters', async () => {
      vi.mocked(githubApiService.getRepository).mockRejectedValue(new Error('Not found'));

      await expect(SwiftPackageResolver.resolveFromCommonPatterns('package@name'))
        .rejects
        .toThrow("Package 'package@name' not found in Swift Package Index or common GitHub patterns");
    });

    it('should handle network errors during resolution', async () => {
      const networkError = new Error('Network timeout');
      vi.mocked(githubApiService.getRepository).mockRejectedValue(networkError);

      await expect(SwiftPackageResolver.resolveFromCommonPatterns('TestPackage'))
        .rejects
        .toThrow("Package 'TestPackage' not found in Swift Package Index or common GitHub patterns");
    });

    it('should handle case-sensitive package names', async () => {
      const mockRepo = {
        id: 1,
        name: 'SnapKit',
        full_name: 'apple/SnapKit',
        owner: { login: 'apple' },
        html_url: 'https://github.com/apple/SnapKit',
      };

      vi.mocked(githubApiService.getRepository).mockResolvedValueOnce(mockRepo);

      const result = await SwiftPackageResolver.resolveFromCommonPatterns('SnapKit');

      expect(result).toEqual({
        owner: 'apple',
        repo: 'SnapKit',
        url: 'https://github.com/apple/SnapKit'
      });
    });

    it('should handle very long package names', async () => {
      const longPackageName = 'a'.repeat(100);
      vi.mocked(githubApiService.getRepository).mockRejectedValue(new Error('Not found'));

      await expect(SwiftPackageResolver.resolveFromCommonPatterns(longPackageName))
        .rejects
        .toThrow(`Package '${longPackageName}' not found in Swift Package Index or common GitHub patterns`);
    });

    it('should handle packages with numeric suffixes', async () => {
      const mockRepo = {
        id: 1,
        name: 'Test123',
        full_name: 'owner/Test123',
        owner: { login: 'owner' },
        html_url: 'https://github.com/owner/Test123',
      };

      vi.mocked(githubApiService.getRepository)
        .mockRejectedValueOnce(new Error('Not found'))
        .mockRejectedValueOnce(new Error('Not found'))
        .mockRejectedValueOnce(new Error('Not found'))
        .mockResolvedValueOnce(mockRepo);

      const result = await SwiftPackageResolver.resolveFromCommonPatterns('Test123');

      expect(result.repo).toBe('Test123');
    });
  });
});
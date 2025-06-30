import { expect, test, describe, vi, beforeEach, afterEach } from "vitest";
import { getPackageReadme } from '../../src/tools/get-package-readme.js';
import { swiftPackageIndexApiService } from '../../src/services/swift-package-index-api.js';
import { githubApiService } from '../../src/services/github-api.js';
import { SwiftPackageResolver } from '../../src/services/package-resolver.js';
import { cacheManager } from '../../src/services/cache.js';
import { PackageNotFoundError, NetworkError, RateLimitError } from '../../src/types/index.js';
import * as searchPackagesModule from '../../src/tools/search-packages.js';

vi.mock('../../src/services/swift-package-index-api.js');
vi.mock('../../src/services/github-api.js');
vi.mock('../../src/services/package-resolver.js');
vi.mock('../../src/services/cache.js');
vi.mock('../../src/utils/logger.js');
vi.mock('../../src/tools/search-packages.js');

describe('get-package-readme tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('parameter validation', () => {
    test('should validate required parameters', async () => {
      await expect(getPackageReadme({})).rejects.toThrow(/required|must be|cannot be empty/i);
    });

    test('should validate parameter types', async () => {
      await expect(getPackageReadme({ package_name: 123 as any })).rejects.toThrow(/string|must be|type/i);
    });

    test('should validate empty package name', async () => {
      await expect(getPackageReadme({ package_name: '' })).rejects.toThrow(/required|cannot be empty/i);
    });

    test('should validate whitespace-only package name', async () => {
      await expect(getPackageReadme({ package_name: '   ' })).rejects.toThrow(/required|cannot be empty/i);
    });

    test('should validate invalid package name format', async () => {
      const invalidNames = [
        'package name with spaces',
        'package@invalid',
        'package#invalid',
        '../malicious-path',
        'package..name',
        'package//name'
      ];

      for (const invalidName of invalidNames) {
        await expect(getPackageReadme({ package_name: invalidName })).rejects.toThrow();
      }
    });

    test('should validate version parameter type', async () => {
      await expect(getPackageReadme({ 
        package_name: 'ValidPackage', 
        version: 123 as any 
      })).rejects.toThrow(/string|must be|type/i);
    });

    test('should validate include_examples parameter type', async () => {
      await expect(getPackageReadme({ 
        package_name: 'ValidPackage', 
        include_examples: 'true' as any 
      })).rejects.toThrow(/boolean|must be|type/i);
    });

    test('should accept valid parameters', async () => {
      const mockReadme = { content: 'README content', examples: [] };
      const mockRepo = {
        id: 1,
        name: 'ValidPackage',
        full_name: 'owner/ValidPackage',
        owner: { login: 'owner' },
        description: 'Test package',
        html_url: 'https://github.com/owner/ValidPackage',
        default_branch: 'main',
        license: { name: 'MIT' }
      };
      
      vi.mocked(cacheManager.getPackageReadme).mockReturnValue(undefined);
      vi.mocked(searchPackagesModule.searchPackages).mockResolvedValue({
        packages: [{
          name: 'ValidPackage',
          repository_url: 'https://github.com/owner/ValidPackage'
        }]
      });
      vi.mocked(swiftPackageIndexApiService.getPackage).mockRejectedValue(new Error('Not found'));
      vi.mocked(githubApiService.getRepository).mockResolvedValue(mockRepo);
      vi.mocked(githubApiService.getLatestRelease).mockResolvedValue(null);
      vi.mocked(githubApiService.getReadme).mockResolvedValue(mockReadme);
      vi.mocked(cacheManager.setPackageReadme).mockReturnValue(undefined);

      await expect(getPackageReadme({ 
        package_name: 'ValidPackage',
        version: '1.0.0',
        include_examples: true
      })).resolves.toBeDefined();
    });
  });

  describe('API error handling', () => {
    test('should handle Swift Package Index API 500 error', async () => {
      vi.mocked(cacheManager.getPackageReadme).mockReturnValue(undefined);
      vi.mocked(swiftPackageIndexApiService.searchPackages).mockRejectedValue(
        new NetworkError('Swift Package Index API returned 500')
      );
      vi.mocked(SwiftPackageResolver.resolveFromCommonPatterns).mockRejectedValue(
        new PackageNotFoundError('Package not found')
      );

      await expect(getPackageReadme({ package_name: 'TestPackage' }))
        .rejects.toThrow(PackageNotFoundError);
    });

    test('should handle Swift Package Index API 404 error', async () => {
      vi.mocked(cacheManager.getPackageReadme).mockReturnValue(undefined);
      vi.mocked(swiftPackageIndexApiService.searchPackages).mockRejectedValue(
        new PackageNotFoundError('Package not found in Swift Package Index')
      );
      vi.mocked(SwiftPackageResolver.resolveFromCommonPatterns).mockRejectedValue(
        new PackageNotFoundError('Package not found')
      );

      await expect(getPackageReadme({ package_name: 'NonExistentPackage' }))
        .rejects.toThrow(PackageNotFoundError);
    });

    test('should handle Swift Package Index API rate limit', async () => {
      vi.mocked(cacheManager.getPackageReadme).mockReturnValue(undefined);
      vi.mocked(swiftPackageIndexApiService.searchPackages).mockRejectedValue(
        new RateLimitError('Rate limit exceeded')
      );
      vi.mocked(SwiftPackageResolver.resolveFromCommonPatterns).mockRejectedValue(
        new PackageNotFoundError('Package not found')
      );

      await expect(getPackageReadme({ package_name: 'TestPackage' }))
        .rejects.toThrow(PackageNotFoundError);
    });

    test('should handle GitHub API 500 error', async () => {
      vi.mocked(cacheManager.getPackageReadme).mockReturnValue(undefined);
      vi.mocked(SwiftPackageResolver.resolveFromCommonPatterns).mockResolvedValue({
        owner: 'owner',
        repo: 'repo',
        url: 'https://github.com/owner/repo'
      });
      vi.mocked(githubApiService.getReadme).mockRejectedValue(
        new NetworkError('GitHub API returned 500')
      );

      await expect(getPackageReadme({ package_name: 'TestPackage' }))
        .rejects.toThrow(NetworkError);
    });

    test('should handle GitHub API 404 error', async () => {
      vi.mocked(cacheManager.getPackageReadme).mockReturnValue(undefined);
      vi.mocked(SwiftPackageResolver.resolveFromCommonPatterns).mockResolvedValue({
        owner: 'owner',
        repo: 'repo',
        url: 'https://github.com/owner/repo'
      });
      vi.mocked(githubApiService.getReadme).mockRejectedValue(
        new PackageNotFoundError('README not found')
      );

      await expect(getPackageReadme({ package_name: 'TestPackage' }))
        .rejects.toThrow(PackageNotFoundError);
    });

    test('should handle network timeout', async () => {
      vi.mocked(cacheManager.getPackageReadme).mockReturnValue(undefined);
      vi.mocked(SwiftPackageResolver.resolveFromCommonPatterns).mockRejectedValue(
        new NetworkError('Network timeout')
      );

      await expect(getPackageReadme({ package_name: 'TestPackage' }))
        .rejects.toThrow(NetworkError);
    });

    test('should handle DNS resolution error', async () => {
      vi.mocked(cacheManager.getPackageReadme).mockReturnValue(undefined);
      vi.mocked(SwiftPackageResolver.resolveFromCommonPatterns).mockRejectedValue(
        new NetworkError('DNS resolution failed')
      );

      await expect(getPackageReadme({ package_name: 'TestPackage' }))
        .rejects.toThrow(NetworkError);
    });
  });

  describe('external service abnormal responses', () => {
    test('should handle empty README content', async () => {
      vi.mocked(cacheManager.getPackageReadme).mockReturnValue(undefined);
      vi.mocked(SwiftPackageResolver.resolveFromCommonPatterns).mockResolvedValue({
        owner: 'owner',
        repo: 'repo',
        url: 'https://github.com/owner/repo'
      });
      vi.mocked(githubApiService.getReadme).mockResolvedValue({
        content: '',
        examples: []
      });
      vi.mocked(cacheManager.setPackageReadme).mockReturnValue(undefined);

      const result = await getPackageReadme({ package_name: 'TestPackage' });
      expect(result.content).toBe('');
    });

    test('should handle null README content', async () => {
      vi.mocked(cacheManager.getPackageReadme).mockReturnValue(undefined);
      vi.mocked(SwiftPackageResolver.resolveFromCommonPatterns).mockResolvedValue({
        owner: 'owner',
        repo: 'repo',
        url: 'https://github.com/owner/repo'
      });
      vi.mocked(githubApiService.getReadme).mockResolvedValue({
        content: null as any,
        examples: []
      });
      vi.mocked(cacheManager.setPackageReadme).mockReturnValue(undefined);

      const result = await getPackageReadme({ package_name: 'TestPackage' });
      expect(result.content).toBeNull();
    });

    test('should handle very large README content', async () => {
      const largeContent = 'x'.repeat(10 * 1024 * 1024); // 10MB
      vi.mocked(cacheManager.getPackageReadme).mockReturnValue(undefined);
      vi.mocked(SwiftPackageResolver.resolveFromCommonPatterns).mockResolvedValue({
        owner: 'owner',
        repo: 'repo',
        url: 'https://github.com/owner/repo'
      });
      vi.mocked(githubApiService.getReadme).mockResolvedValue({
        content: largeContent,
        examples: []
      });
      vi.mocked(cacheManager.setPackageReadme).mockReturnValue(undefined);

      const result = await getPackageReadme({ package_name: 'TestPackage' });
      expect(result.content.length).toBe(largeContent.length);
    });

    test('should handle malformed JSON response', async () => {
      vi.mocked(cacheManager.getPackageReadme).mockReturnValue(undefined);
      vi.mocked(SwiftPackageResolver.resolveFromCommonPatterns).mockRejectedValue(
        new Error('Unexpected token in JSON at position 0')
      );

      await expect(getPackageReadme({ package_name: 'TestPackage' }))
        .rejects.toThrow();
    });
  });

  describe('cache error handling', () => {
    test('should handle cache read error gracefully', async () => {
      vi.mocked(cacheManager.getPackageReadme).mockImplementation(() => {
        throw new Error('Cache read error');
      });
      vi.mocked(SwiftPackageResolver.resolveFromCommonPatterns).mockResolvedValue({
        owner: 'owner',
        repo: 'repo',
        url: 'https://github.com/owner/repo'
      });
      vi.mocked(githubApiService.getReadme).mockResolvedValue({
        content: 'README content',
        examples: []
      });
      vi.mocked(cacheManager.setPackageReadme).mockReturnValue(undefined);

      const result = await getPackageReadme({ package_name: 'TestPackage' });
      expect(result.content).toBe('README content');
    });

    test('should handle cache write error gracefully', async () => {
      vi.mocked(cacheManager.getPackageReadme).mockReturnValue(undefined);
      vi.mocked(SwiftPackageResolver.resolveFromCommonPatterns).mockResolvedValue({
        owner: 'owner',
        repo: 'repo',
        url: 'https://github.com/owner/repo'
      });
      vi.mocked(githubApiService.getReadme).mockResolvedValue({
        content: 'README content',
        examples: []
      });
      vi.mocked(cacheManager.setPackageReadme).mockImplementation(() => {
        throw new Error('Cache write error');
      });

      const result = await getPackageReadme({ package_name: 'TestPackage' });
      expect(result.content).toBe('README content');
    });
  });

  describe('edge cases', () => {
    test('should handle extremely long package names', async () => {
      const longPackageName = 'a'.repeat(300);
      await expect(getPackageReadme({ package_name: longPackageName }))
        .rejects.toThrow();
    });

    test('should handle special characters in package names', async () => {
      const specialCharNames = ['pkg<script>', 'pkg"quotes"', "pkg'single'"];
      
      for (const name of specialCharNames) {
        await expect(getPackageReadme({ package_name: name }))
          .rejects.toThrow();
      }
    });

    test('should handle version with special characters', async () => {
      const invalidVersions = ['v1.0.0<script>', '1.0.0"quotes"', "1.0.0'single'"];
      
      for (const version of invalidVersions) {
        await expect(getPackageReadme({ 
          package_name: 'ValidPackage', 
          version 
        })).rejects.toThrow();
      }
    });

    test('should handle concurrent requests', async () => {
      vi.mocked(cacheManager.getPackageReadme).mockReturnValue(undefined);
      vi.mocked(SwiftPackageResolver.resolveFromCommonPatterns).mockResolvedValue({
        owner: 'owner',
        repo: 'repo',
        url: 'https://github.com/owner/repo'
      });
      vi.mocked(githubApiService.getReadme).mockResolvedValue({
        content: 'README content',
        examples: []
      });
      vi.mocked(cacheManager.setPackageReadme).mockReturnValue(undefined);

      const promises = Array(10).fill(null).map(() => 
        getPackageReadme({ package_name: 'TestPackage' })
      );

      const results = await Promise.all(promises);
      expect(results.every(result => result.content === 'README content')).toBe(true);
    });

    test('should handle Unicode package names', async () => {
      const unicodeNames = ['パッケージ名', '包名', '📦package'];
      
      for (const name of unicodeNames) {
        await expect(getPackageReadme({ package_name: name }))
          .rejects.toThrow();
      }
    });
  });
});

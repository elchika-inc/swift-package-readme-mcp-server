import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubApiService } from '../../src/services/github-api.js';
import { PackageNotFoundError, NetworkError, RateLimitError } from '../../src/types/index.js';

describe('GitHubApi', () => {
  let api: GitHubApiService;

  beforeEach(() => {
    api = new GitHubApiService();
    vi.clearAllMocks();
  });

  describe('getReadme', () => {
    it('should get README successfully', async () => {
      const mockResponse = {
        content: 'IyBBbGFtb2ZpcmUKCkVsZWdhbnQgSFRUUCBOZXR3b3JraW5nIGluIFN3aWZ0',
        encoding: 'base64'
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await api.getReadme('Alamofire', 'Alamofire');

      expect(result.content).toBeDefined();
      expect(result.encoding).toBe('base64');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/Alamofire/Alamofire/readme',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'swift-package-readme-mcp-server',
            'Accept': 'application/vnd.github.v3+json'
          })
        })
      );
    });
  });

  describe('getRepository', () => {
    it('should get repository info successfully', async () => {
      const mockResponse = {
        name: 'Alamofire',
        full_name: 'Alamofire/Alamofire',
        description: 'Elegant HTTP Networking in Swift',
        html_url: 'https://github.com/Alamofire/Alamofire',
        stargazers_count: 40000,
        forks_count: 7500,
        language: 'Swift',
        updated_at: '2023-01-01T00:00:00Z'
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await api.getRepository('Alamofire', 'Alamofire');

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/Alamofire/Alamofire',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'swift-package-readme-mcp-server',
            'Accept': 'application/vnd.github.v3+json'
          })
        })
      );
    });
  });
});
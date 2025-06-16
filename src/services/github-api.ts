import type {
  GitHubRepository,
  GitHubReadmeResponse,
  GitHubRelease,
  NetworkError,
  RateLimitError,
  PackageNotFoundError,
} from '../types/index.js';
import { ErrorHandler } from '../utils/error-handler.js';
import { logger } from '../utils/logger.js';
import { cacheManager } from './cache.js';

export class GitHubApiService {
  private readonly baseUrl = 'https://api.github.com';
  private readonly requestTimeout = parseInt(process.env.REQUEST_TIMEOUT || '30000', 10);
  private token?: string;

  constructor() {
    this.token = process.env.GITHUB_TOKEN;
    if (!this.token) {
      logger.warn('GitHub token not provided, API requests may be rate limited');
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'swift-package-readme-mcp-server',
      ...(options.headers ? options.headers as Record<string, string> : {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const requestOptions: RequestInit = {
      ...options,
      headers,
    };

    logger.debug('GitHub API request', { url, method: options.method || 'GET' });

    return ErrorHandler.withTimeout(
      async () => {
        const response = await fetch(url, requestOptions);

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : 60;
          
          throw {
            name: 'RateLimitError',
            message: 'GitHub API rate limit exceeded',
            code: 'RATE_LIMIT_EXCEEDED',
            statusCode: 429,
            details: { retryAfter: retryAfterSeconds },
          } as RateLimitError;
        }

        // Handle not found
        if (response.status === 404) {
          throw {
            name: 'PackageNotFoundError',
            message: 'Repository not found on GitHub',
            code: 'PACKAGE_NOT_FOUND',
            statusCode: 404,
          } as PackageNotFoundError;
        }

        // Handle other HTTP errors
        if (!response.ok) {
          throw {
            name: 'NetworkError',
            message: `GitHub API error: ${response.status} ${response.statusText}`,
            code: 'NETWORK_ERROR',
            statusCode: response.status,
          } as NetworkError;
        }

        const data = await response.json();
        logger.debug('GitHub API response', { url, status: response.status });
        
        return data as T;
      },
      this.requestTimeout
    );
  }

  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    const cacheKey = `github_repo:${owner}:${repo}`;
    const cached = cacheManager.getGeneral<GitHubRepository>(cacheKey);
    
    if (cached) {
      logger.debug('Repository info cache hit', { owner, repo });
      return cached;
    }

    logger.info('Fetching repository info from GitHub', { owner, repo });
    
    const repository = await ErrorHandler.withRetry(
      () => this.makeRequest<GitHubRepository>(`/repos/${owner}/${repo}`)
    );

    // Cache for 1 hour
    cacheManager.setGeneral(cacheKey, repository, 3600);

    return repository;
  }

  async getReadme(
    owner: string,
    repo: string,
    ref?: string
  ): Promise<{ content: string; encoding: string }> {
    const cacheKey = `github_readme:${owner}:${repo}:${ref || 'default'}`;
    const cached = cacheManager.getGeneral<{ content: string; encoding: string }>(cacheKey);
    
    if (cached) {
      logger.debug('README cache hit', { owner, repo, ref });
      return cached;
    }

    logger.info('Fetching README from GitHub', { owner, repo, ref });

    const endpoint = `/repos/${owner}/${repo}/readme${ref ? `?ref=${ref}` : ''}`;
    
    const readme = await ErrorHandler.withRetry(
      () => this.makeRequest<GitHubReadmeResponse>(endpoint)
    );

    let content: string;
    if (readme.encoding === 'base64') {
      content = Buffer.from(readme.content, 'base64').toString('utf-8');
    } else {
      content = readme.content;
    }

    const result = { content, encoding: readme.encoding };
    
    // Cache for 30 minutes
    cacheManager.setGeneral(cacheKey, result, 1800);

    return result;
  }

  async getReleases(
    owner: string,
    repo: string,
    limit: number = 10
  ): Promise<GitHubRelease[]> {
    const cacheKey = `github_releases:${owner}:${repo}:${limit}`;
    const cached = cacheManager.getGeneral<GitHubRelease[]>(cacheKey);
    
    if (cached) {
      logger.debug('Releases cache hit', { owner, repo, limit });
      return cached;
    }

    logger.info('Fetching releases from GitHub', { owner, repo, limit });

    const releases = await ErrorHandler.withRetry(
      () => this.makeRequest<GitHubRelease[]>(`/repos/${owner}/${repo}/releases?per_page=${limit}`)
    );

    // Cache for 10 minutes
    cacheManager.setGeneral(cacheKey, releases, 600);

    return releases;
  }

  async getLatestRelease(owner: string, repo: string): Promise<GitHubRelease | null> {
    const cacheKey = `github_latest_release:${owner}:${repo}`;
    const cached = cacheManager.getGeneral<GitHubRelease | null>(cacheKey);
    
    if (cached !== undefined) {
      logger.debug('Latest release cache hit', { owner, repo });
      return cached;
    }

    logger.info('Fetching latest release from GitHub', { owner, repo });

    try {
      const release = await ErrorHandler.withRetry(
        () => this.makeRequest<GitHubRelease>(`/repos/${owner}/${repo}/releases/latest`)
      );

      // Cache for 10 minutes
      cacheManager.setGeneral(cacheKey, release, 600);
      
      return release;
    } catch (error) {
      // If no releases are found, cache null
      if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
        cacheManager.setGeneral(cacheKey, null, 600);
        return null;
      }
      throw error;
    }
  }

  async getTags(
    owner: string,
    repo: string,
    limit: number = 10
  ): Promise<Array<{ name: string; commit: { sha: string } }>> {
    const cacheKey = `github_tags:${owner}:${repo}:${limit}`;
    const cached = cacheManager.getGeneral<Array<{ name: string; commit: { sha: string } }>>(cacheKey);
    
    if (cached) {
      logger.debug('Tags cache hit', { owner, repo, limit });
      return cached;
    }

    logger.info('Fetching tags from GitHub', { owner, repo, limit });

    const tags = await ErrorHandler.withRetry(
      () => this.makeRequest<Array<{ name: string; commit: { sha: string } }>>(`/repos/${owner}/${repo}/tags?per_page=${limit}`)
    );

    // Cache for 10 minutes
    cacheManager.setGeneral(cacheKey, tags, 600);

    return tags;
  }

  async getPackageSwiftContent(
    owner: string,
    repo: string,
    ref?: string
  ): Promise<string | null> {
    const cacheKey = `github_package_swift:${owner}:${repo}:${ref || 'default'}`;
    const cached = cacheManager.getGeneral<string | null>(cacheKey);
    
    if (cached !== undefined) {
      logger.debug('Package.swift cache hit', { owner, repo, ref });
      return cached;
    }

    logger.info('Fetching Package.swift from GitHub', { owner, repo, ref });

    try {
      const endpoint = `/repos/${owner}/${repo}/contents/Package.swift${ref ? `?ref=${ref}` : ''}`;
      
      const file = await ErrorHandler.withRetry(
        () => this.makeRequest<GitHubReadmeResponse>(endpoint)
      );

      let content: string;
      if (file.encoding === 'base64') {
        content = Buffer.from(file.content, 'base64').toString('utf-8');
      } else {
        content = file.content;
      }

      // Cache for 30 minutes
      cacheManager.setGeneral(cacheKey, content, 1800);
      
      return content;
    } catch (error) {
      // If Package.swift is not found, cache null
      if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
        cacheManager.setGeneral(cacheKey, null, 1800);
        return null;
      }
      throw error;
    }
  }

  // Helper method to check API rate limits
  async getRateLimit(): Promise<{
    limit: number;
    remaining: number;
    reset: number;
    used: number;
  }> {
    const rateLimitData = await this.makeRequest<{
      rate: {
        limit: number;
        remaining: number;
        reset: number;
        used: number;
      };
    }>('/rate_limit');

    return rateLimitData.rate;
  }
}

// Export a singleton instance
export const githubApiService = new GitHubApiService();
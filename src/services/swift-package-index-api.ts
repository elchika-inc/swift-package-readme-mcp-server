import type {
  SwiftPackageIndexPackage,
  SwiftPackageIndexSearchResponse,
  NetworkError,
  RateLimitError,
  PackageNotFoundError,
} from '../types/index.js';
import { ErrorHandler } from '../utils/error-handler.js';
import { logger } from '../utils/logger.js';
import { cacheManager } from './cache.js';

export class SwiftPackageIndexApiService {
  private readonly baseUrl = 'https://swiftpackageindex.com/api';
  private readonly requestTimeout = parseInt(process.env.REQUEST_TIMEOUT || '30000', 10);

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'swift-package-readme-mcp-server',
      ...(options.headers ? options.headers as Record<string, string> : {}),
    };

    const requestOptions: RequestInit = {
      ...options,
      headers,
    };

    logger.debug('Swift Package Index API request', { url, method: options.method || 'GET' });

    return ErrorHandler.withTimeout(
      async () => {
        const response = await fetch(url, requestOptions);

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : 60;
          
          throw {
            name: 'RateLimitError',
            message: 'Swift Package Index API rate limit exceeded',
            code: 'RATE_LIMIT_EXCEEDED',
            statusCode: 429,
            details: { retryAfter: retryAfterSeconds },
          } as RateLimitError;
        }

        // Handle not found
        if (response.status === 404) {
          throw {
            name: 'PackageNotFoundError',
            message: 'Package not found in Swift Package Index',
            code: 'PACKAGE_NOT_FOUND',
            statusCode: 404,
          } as PackageNotFoundError;
        }

        // Handle other HTTP errors
        if (!response.ok) {
          throw {
            name: 'NetworkError',
            message: `Swift Package Index API error: ${response.status} ${response.statusText}`,
            code: 'NETWORK_ERROR',
            statusCode: response.status,
          } as NetworkError;
        }

        const data = await response.json();
        logger.debug('Swift Package Index API response', { url, status: response.status });
        
        return data as T;
      },
      this.requestTimeout
    );
  }

  async getPackage(owner: string, repo: string): Promise<SwiftPackageIndexPackage> {
    const cacheKey = `spi_package:${owner}:${repo}`;
    const cached = cacheManager.getGeneral<SwiftPackageIndexPackage>(cacheKey);
    
    if (cached) {
      logger.debug('Swift Package Index package cache hit', { owner, repo });
      return cached;
    }

    logger.info('Fetching package info from Swift Package Index', { owner, repo });
    
    const packageData = await ErrorHandler.withRetry(
      () => this.makeRequest<SwiftPackageIndexPackage>(`/packages/${owner}/${repo}`)
    );

    // Cache for 1 hour
    cacheManager.setGeneral(cacheKey, packageData, 3600);

    return packageData;
  }

  async searchPackages(
    query: string,
    limit: number = 20
  ): Promise<SwiftPackageIndexSearchResponse> {
    const queryHash = cacheManager.createQueryHash(query, { limit });
    const cached = cacheManager.getSearchResults<SwiftPackageIndexSearchResponse>(queryHash, limit);
    
    if (cached) {
      logger.debug('Swift Package Index search cache hit', { query, limit });
      return cached;
    }

    logger.info('Searching packages in Swift Package Index', { query, limit });

    // Swift Package Index search endpoint
    const searchParams = new URLSearchParams({
      query: query.trim(),
    });

    const searchResults = await ErrorHandler.withRetry(
      () => this.makeRequest<SwiftPackageIndexSearchResponse>(`/search?${searchParams}`)
    );

    // Limit results if needed
    if (searchResults.results.length > limit) {
      searchResults.results = searchResults.results.slice(0, limit);
    }

    // Cache for 30 minutes
    cacheManager.setSearchResults(queryHash, limit, searchResults);

    return searchResults;
  }

  // Helper method to get package info by URL
  async getPackageByUrl(packageUrl: string): Promise<SwiftPackageIndexPackage | null> {
    try {
      // Extract owner/repo from GitHub URL
      const githubMatch = packageUrl.match(/github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?(?:\/|$)/);
      if (!githubMatch) {
        logger.warn('Cannot extract owner/repo from URL', { packageUrl });
        return null;
      }

      const [, owner, repo] = githubMatch;
      return await this.getPackage(owner, repo);
    } catch (error) {
      if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
        logger.debug('Package not found in Swift Package Index', { packageUrl });
        return null;
      }
      throw error;
    }
  }

  // Method to get package builds/compatibility info
  async getPackageBuilds(owner: string, repo: string): Promise<{
    swift_versions: string[];
    platforms: string[];
  }> {
    const cacheKey = `spi_builds:${owner}:${repo}`;
    const cached = cacheManager.getGeneral<{ swift_versions: string[]; platforms: string[] }>(cacheKey);
    
    if (cached) {
      logger.debug('Swift Package Index builds cache hit', { owner, repo });
      return cached;
    }

    logger.info('Fetching build info from Swift Package Index', { owner, repo });

    try {
      // This is a hypothetical endpoint - Swift Package Index doesn't have a public builds API
      // In practice, this information would be extracted from the package data
      const packageData = await this.getPackage(owner, repo);
      
      const result = {
        swift_versions: this.extractSwiftVersions(packageData),
        platforms: this.extractPlatforms(packageData),
      };

      // Cache for 1 hour
      cacheManager.setGeneral(cacheKey, result, 3600);

      return result;
    } catch (error) {
      logger.error('Failed to fetch build info', { owner, repo, error });
      return {
        swift_versions: [],
        platforms: [],
      };
    }
  }

  private extractSwiftVersions(packageData: SwiftPackageIndexPackage): string[] {
    const versions: string[] = [];
    
    if (packageData.swift_compatibility) {
      for (const [version, supported] of Object.entries(packageData.swift_compatibility)) {
        if (supported) {
          versions.push(version);
        }
      }
    }
    
    return versions.sort((a, b) => b.localeCompare(a)); // Sort descending
  }

  private extractPlatforms(packageData: SwiftPackageIndexPackage): string[] {
    const platforms: string[] = [];
    
    if (packageData.platform_compatibility) {
      const platformMap = packageData.platform_compatibility;
      
      if (platformMap.ios) platforms.push(`iOS ${platformMap.ios}`);
      if (platformMap.macos) platforms.push(`macOS ${platformMap.macos}`);
      if (platformMap.tvos) platforms.push(`tvOS ${platformMap.tvos}`);
      if (platformMap.watchos) platforms.push(`watchOS ${platformMap.watchos}`);
      if (platformMap.linux) platforms.push('Linux');
    }
    
    return platforms;
  }

  // Method to get trending/popular packages
  async getTrendingPackages(limit: number = 20): Promise<SwiftPackageIndexSearchResponse> {
    const cacheKey = `spi_trending:${limit}`;
    const cached = cacheManager.getGeneral<SwiftPackageIndexSearchResponse>(cacheKey);
    
    if (cached) {
      logger.debug('Trending packages cache hit', { limit });
      return cached;
    }

    logger.info('Fetching trending packages from Swift Package Index', { limit });

    // Since there's no specific trending endpoint, we'll search for popular Swift-related terms
    const trendingSearches = ['swiftui', 'networking', 'json', 'animation', 'core data'];
    const randomTerm = trendingSearches[Math.floor(Math.random() * trendingSearches.length)];
    
    const trendingResults = await this.searchPackages(randomTerm, limit);

    // Cache for 1 hour
    cacheManager.setGeneral(cacheKey, trendingResults, 3600);

    return trendingResults;
  }

  // Helper method to check if a package exists
  async packageExists(owner: string, repo: string): Promise<boolean> {
    try {
      await this.getPackage(owner, repo);
      return true;
    } catch (error) {
      if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
        return false;
      }
      throw error;
    }
  }
}

// Export a singleton instance
export const swiftPackageIndexApiService = new SwiftPackageIndexApiService();
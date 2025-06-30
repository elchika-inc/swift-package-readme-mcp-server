import { githubApiService } from './github-api.js';
import { logger } from '../utils/logger.js';
import { DEFAULT_CONFIG } from '../config/defaults.js';

export interface ResolvedPackage {
  owner: string;
  repo: string;
  url: string;
}

/**
 * Resolves Swift package names to GitHub repository information
 */
export class SwiftPackageResolver {
  /**
   * Try common GitHub patterns for Swift packages
   */
  static async resolveFromCommonPatterns(packageName: string): Promise<ResolvedPackage> {
    const commonPatterns = [
      // Generate patterns from configuration
      ...DEFAULT_CONFIG.GITHUB_PATTERNS.map(pattern => ({
        owner: pattern.owner,
        repo: `${pattern.prefix}${packageName}`
      })),
      // Try exact package name as repo
      { owner: packageName.split('-')[0] || packageName, repo: packageName },
    ];

    for (const pattern of commonPatterns) {
      try {
        logger.debug(`Trying GitHub pattern: ${pattern.owner}/${pattern.repo}`);
        await githubApiService.getRepository(pattern.owner, pattern.repo);
        
        return {
          owner: pattern.owner,
          repo: pattern.repo,
          url: `https://github.com/${pattern.owner}/${pattern.repo}`
        };
      } catch (error) {
        // Continue to next pattern
        continue;
      }
    }
    
    throw new Error(`Package '${packageName}' not found in Swift Package Index or common GitHub patterns`);
  }
}
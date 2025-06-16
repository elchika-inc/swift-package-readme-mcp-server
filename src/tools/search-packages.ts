import type {
  SearchPackagesParams,
  SearchPackagesResponse,
  PackageSearchResult,
} from '../types/index.js';
import { swiftPackageIndexApiService } from '../services/swift-package-index-api.js';
import { githubApiService } from '../services/github-api.js';
import { SearchQueryValidator, NumericValidator } from '../utils/validators.js';
import { logger } from '../utils/logger.js';
import { cacheManager } from '../services/cache.js';

export async function searchPackages(params: SearchPackagesParams): Promise<SearchPackagesResponse> {
  // Validate input parameters
  SearchQueryValidator.validateSearchQuery(params.query);
  NumericValidator.validateLimit(params.limit);
  NumericValidator.validateScore(params.quality, 'quality');
  NumericValidator.validateScore(params.popularity, 'popularity');

  const limit = params.limit || 20;
  const query = params.query.trim();

  logger.info('Searching packages', {
    query,
    limit,
    quality: params.quality,
    popularity: params.popularity,
  });

  // Check cache first
  const queryHash = cacheManager.createQueryHash(query, {
    limit,
    quality: params.quality,
    popularity: params.popularity,
  });
  const cached = cacheManager.getSearchResults<SearchPackagesResponse>(queryHash, limit);
  if (cached) {
    logger.debug('Search results cache hit', { query, limit });
    return cached;
  }

  try {
    // Search using Swift Package Index
    const spiResults = await swiftPackageIndexApiService.searchPackages(query, limit);
    
    // Transform results to our format
    const searchResults: PackageSearchResult[] = [];
    
    for (const spiResult of spiResults.results) {
      try {
        // Get additional details for each package
        let packageDetails;
        try {
          packageDetails = await swiftPackageIndexApiService.getPackage(
            spiResult.repositoryOwner,
            spiResult.repositoryName
          );
        } catch (error) {
          logger.debug('Could not get package details from SPI', {
            owner: spiResult.repositoryOwner,
            repo: spiResult.repositoryName,
          });
        }

        // Get GitHub info for additional metrics
        let githubRepo;
        try {
          githubRepo = await githubApiService.getRepository(
            spiResult.repositoryOwner,
            spiResult.repositoryName
          );
        } catch (error) {
          logger.debug('Could not get GitHub repository info', {
            owner: spiResult.repositoryOwner,
            repo: spiResult.repositoryName,
          });
        }

        // Calculate scores
        const stars = githubRepo?.stargazers_count || spiResult.stars || 0;
        const forks = githubRepo?.forks_count || 0;
        const issues = githubRepo?.open_issues_count || 0;
        
        // Simple scoring algorithm (can be improved)
        const popularityScore = Math.min(1, Math.log10(stars + 1) / 4); // Max score at 10k stars
        const qualityScore = calculateQualityScore(packageDetails, githubRepo, spiResult);
        const maintenanceScore = calculateMaintenanceScore(packageDetails, githubRepo, spiResult);
        const finalScore = (popularityScore + qualityScore + maintenanceScore) / 3;

        // Apply filters
        if (params.quality && qualityScore < params.quality) {
          continue;
        }
        if (params.popularity && popularityScore < params.popularity) {
          continue;
        }

        // Get platform and Swift version info
        let platforms: string[] = [];
        let swiftVersions: string[] = [];
        
        if (packageDetails) {
          const builds = await swiftPackageIndexApiService.getPackageBuilds(
            spiResult.repositoryOwner,
            spiResult.repositoryName
          );
          platforms = builds.platforms;
          swiftVersions = builds.swift_versions;
        }

        const searchResult: PackageSearchResult = {
          name: spiResult.packageName,
          version: packageDetails?.latest_version || 'unknown',
          description: spiResult.summary || githubRepo?.description || '',
          summary: spiResult.summary,
          keywords: spiResult.keywords || githubRepo?.topics || [],
          author: spiResult.repositoryOwner,
          license: packageDetails?.license_name || githubRepo?.license?.name || 'Unknown',
          platforms,
          swift_versions: swiftVersions,
          stars,
          score: {
            final: finalScore,
            detail: {
              quality: qualityScore,
              popularity: popularityScore,
              maintenance: maintenanceScore,
            },
          },
          searchScore: 1.0, // Swift Package Index doesn't provide search scores
        };

        searchResults.push(searchResult);
      } catch (error) {
        logger.warn('Failed to process search result', {
          packageName: spiResult.packageName,
          error,
        });
        // Continue with other results
      }
    }

    // Sort by final score (descending)
    searchResults.sort((a, b) => b.score.final - a.score.final);

    // Limit results
    const limitedResults = searchResults.slice(0, limit);

    const response: SearchPackagesResponse = {
      query,
      total: spiResults.hasMoreResults ? limitedResults.length + 1 : limitedResults.length,
      packages: limitedResults,
    };

    // Cache the result for 30 minutes
    cacheManager.setSearchResults(queryHash, limit, response);

    logger.info('Successfully searched packages', {
      query,
      results_count: limitedResults.length,
      total: response.total,
    });

    return response;
  } catch (error) {
    logger.error('Failed to search packages', {
      query,
      limit,
      error,
    });
    throw error;
  }
}

function calculateQualityScore(
  packageDetails: any,
  githubRepo: any,
  spiResult: any
): number {
  let score = 0;
  let factors = 0;

  // Has documentation
  if (packageDetails?.documentation_url || spiResult.hasDocs) {
    score += 0.3;
  }
  factors += 0.3;

  // Has good description
  if (spiResult.summary && spiResult.summary.length > 20) {
    score += 0.2;
  }
  factors += 0.2;

  // Has license
  if (packageDetails?.license_name || githubRepo?.license?.name) {
    score += 0.2;
  }
  factors += 0.2;

  // Has keywords/topics
  if ((spiResult.keywords && spiResult.keywords.length > 0) || 
      (githubRepo?.topics && githubRepo.topics.length > 0)) {
    score += 0.1;
  }
  factors += 0.1;

  // Has releases/tags
  if (packageDetails?.latest_version) {
    score += 0.2;
  }
  factors += 0.2;

  return factors > 0 ? score / factors : 0;
}

function calculateMaintenanceScore(
  packageDetails: any,
  githubRepo: any,
  spiResult: any
): number {
  let score = 0;
  let factors = 0;

  // Recent activity
  if (spiResult.lastActivityAt) {
    const lastActivity = new Date(spiResult.lastActivityAt);
    const daysSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceActivity < 30) {
      score += 0.4;
    } else if (daysSinceActivity < 90) {
      score += 0.3;
    } else if (daysSinceActivity < 365) {
      score += 0.2;
    }
  }
  factors += 0.4;

  // Has recent commits (if we have GitHub data)
  if (githubRepo?.pushed_at) {
    const lastPush = new Date(githubRepo.pushed_at);
    const daysSincePush = (Date.now() - lastPush.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSincePush < 30) {
      score += 0.3;
    } else if (daysSincePush < 90) {
      score += 0.2;
    } else if (daysSincePush < 365) {
      score += 0.1;
    }
  }
  factors += 0.3;

  // Not too many open issues relative to popularity
  if (githubRepo?.open_issues_count !== undefined && githubRepo?.stargazers_count !== undefined) {
    const issueRatio = githubRepo.stargazers_count > 0 
      ? githubRepo.open_issues_count / githubRepo.stargazers_count 
      : 0;
    
    if (issueRatio < 0.1) {
      score += 0.3;
    } else if (issueRatio < 0.2) {
      score += 0.2;
    } else if (issueRatio < 0.5) {
      score += 0.1;
    }
  }
  factors += 0.3;

  return factors > 0 ? score / factors : 0;
}
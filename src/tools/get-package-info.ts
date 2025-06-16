import type {
  GetPackageInfoParams,
  PackageInfoResponse,
  DownloadStats,
  RepositoryInfo,
  SwiftPackageManifest,
} from '../types/index.js';
import { swiftPackageIndexApiService } from '../services/swift-package-index-api.js';
import { githubApiService } from '../services/github-api.js';
import { PackageNameValidator } from '../utils/validators.js';
import { logger } from '../utils/logger.js';
import { cacheManager } from '../services/cache.js';

export async function getPackageInfo(params: GetPackageInfoParams): Promise<PackageInfoResponse> {
  // Validate input parameters
  PackageNameValidator.validatePackageName(params.package_name);

  const includeDependencies = params.include_dependencies !== false;
  const includeDevDependencies = params.include_dev_dependencies === true;

  logger.info('Getting package info', {
    package_name: params.package_name,
    include_dependencies: includeDependencies,
    include_dev_dependencies: includeDevDependencies,
  });

  // Check cache first
  const cacheKey = `${params.package_name}:${includeDependencies}:${includeDevDependencies}`;
  const cached = cacheManager.getPackageInfo<PackageInfoResponse>(cacheKey, 'latest');
  if (cached) {
    logger.debug('Package info cache hit', { package_name: params.package_name });
    return cached;
  }

  try {
    // Try to normalize package name to owner/repo format
    const packageInfo = PackageNameValidator.normalizePackageName(params.package_name);
    
    // Get package information from Swift Package Index
    let spiPackage;
    try {
      spiPackage = await swiftPackageIndexApiService.getPackage(packageInfo.owner, packageInfo.repo);
    } catch (error) {
      logger.debug('Package not found in Swift Package Index, will use GitHub only', {
        owner: packageInfo.owner,
        repo: packageInfo.repo,
      });
    }

    // Get GitHub repository information
    const githubRepo = await githubApiService.getRepository(packageInfo.owner, packageInfo.repo);

    // Get latest version
    let latestVersion = 'unknown';
    const latestRelease = await githubApiService.getLatestRelease(packageInfo.owner, packageInfo.repo);
    if (latestRelease) {
      latestVersion = latestRelease.tag_name;
    } else if (spiPackage?.latest_version) {
      latestVersion = spiPackage.latest_version;
    }

    // Get dependencies if requested
    let dependencies: Record<string, string> | undefined;
    let devDependencies: Record<string, string> | undefined;

    if (includeDependencies || includeDevDependencies) {
      const dependencyInfo = await extractDependencies(
        packageInfo.owner,
        packageInfo.repo,
        spiPackage,
        includeDependencies,
        includeDevDependencies
      );
      dependencies = dependencyInfo.dependencies;
      devDependencies = dependencyInfo.devDependencies;
    }

    // Build download stats (using GitHub metrics as proxy)
    const downloadStats: DownloadStats = {
      stars: githubRepo.stargazers_count,
      forks: githubRepo.forks_count,
      issues: githubRepo.open_issues_count,
    };

    // Get platform and Swift version compatibility
    let platforms: string[] = [];
    let swiftVersions: string[] = [];
    
    if (spiPackage) {
      const builds = await swiftPackageIndexApiService.getPackageBuilds(packageInfo.owner, packageInfo.repo);
      platforms = builds.platforms;
      swiftVersions = builds.swift_versions;
    }

    // Build repository info
    const repositoryInfo: RepositoryInfo = {
      type: 'git',
      url: githubRepo.clone_url,
    };

    const response: PackageInfoResponse = {
      package_name: params.package_name,
      latest_version: latestVersion,
      description: spiPackage?.summary || githubRepo.description || '',
      author: githubRepo.owner.login,
      license: githubRepo.license?.name || spiPackage?.license_name || 'Unknown',
      keywords: spiPackage?.metadata?.keywords || githubRepo.topics || [],
      dependencies,
      dev_dependencies: devDependencies,
      download_stats: downloadStats,
      repository: repositoryInfo,
      platforms,
      swift_versions: swiftVersions,
    };

    // Cache the result for 1 hour
    cacheManager.setPackageInfo(cacheKey, 'latest', response);

    logger.info('Successfully retrieved package info', {
      package_name: params.package_name,
      latest_version: latestVersion,
      dependencies_count: dependencies ? Object.keys(dependencies).length : 0,
    });

    return response;
  } catch (error) {
    logger.error('Failed to get package info', {
      package_name: params.package_name,
      error,
    });
    throw error;
  }
}

async function extractDependencies(
  owner: string,
  repo: string,
  spiPackage: any,
  includeDependencies: boolean,
  includeDevDependencies: boolean
): Promise<{
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}> {
  const result: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  } = {};

  try {
    // First try to get dependencies from Swift Package Index metadata
    if (spiPackage?.metadata?.dependencies && includeDependencies) {
      const deps: Record<string, string> = {};
      
      for (const dep of spiPackage.metadata.dependencies) {
        if (dep.package_name && dep.requirement) {
          deps[dep.package_name] = dep.requirement;
        }
      }
      
      if (Object.keys(deps).length > 0) {
        result.dependencies = deps;
      }
    }

    // If no dependencies from SPI, try to parse Package.swift
    if (!result.dependencies && (includeDependencies || includeDevDependencies)) {
      const packageSwiftContent = await githubApiService.getPackageSwiftContent(owner, repo);
      
      if (packageSwiftContent) {
        const parsedDeps = parsePackageSwiftDependencies(packageSwiftContent);
        
        if (includeDependencies && parsedDeps.dependencies) {
          result.dependencies = parsedDeps.dependencies;
        }
        
        if (includeDevDependencies && parsedDeps.devDependencies) {
          result.devDependencies = parsedDeps.devDependencies;
        }
      }
    }
  } catch (error) {
    logger.error('Failed to extract dependencies', { owner, repo, error });
  }

  return result;
}

function parsePackageSwiftDependencies(packageSwiftContent: string): {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
} {
  const result: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  } = {};

  try {
    // This is a simplified parser for Package.swift
    // In a production implementation, you'd want a more robust Swift parser
    
    const dependencies: Record<string, string> = {};
    
    // Look for .package calls
    const packageRegex = /\.package\s*\(\s*url:\s*"([^"]+)"\s*,\s*([^)]+)\)/g;
    let match;
    
    while ((match = packageRegex.exec(packageSwiftContent)) !== null) {
      const [, url, requirement] = match;
      
      // Extract package name from URL
      const urlMatch = url.match(/([^\/]+?)(?:\.git)?$/);
      if (urlMatch) {
        const packageName = urlMatch[1];
        
        // Parse requirement (simplified)
        let version = 'latest';
        if (requirement.includes('from:')) {
          const versionMatch = requirement.match(/from:\s*"([^"]+)"/);
          if (versionMatch) {
            version = `>=${versionMatch[1]}`;
          }
        } else if (requirement.includes('exact:')) {
          const versionMatch = requirement.match(/exact:\s*"([^"]+)"/);
          if (versionMatch) {
            version = versionMatch[1];
          }
        } else if (requirement.includes('.upToNextMajor')) {
          const versionMatch = requirement.match(/\.upToNextMajor\(from:\s*"([^"]+)"\)/);
          if (versionMatch) {
            version = `^${versionMatch[1]}`;
          }
        }
        
        dependencies[packageName] = version;
      }
    }
    
    if (Object.keys(dependencies).length > 0) {
      result.dependencies = dependencies;
    }
    
    // For Swift packages, there's typically no distinction between dependencies and dev dependencies
    // Everything is usually a regular dependency, with test targets depending on them
    
    logger.debug('Parsed Package.swift dependencies', { count: Object.keys(dependencies).length });
  } catch (error) {
    logger.error('Failed to parse Package.swift dependencies', { error });
  }

  return result;
}
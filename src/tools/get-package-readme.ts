import type {
  GetPackageReadmeParams,
  PackageReadmeResponse,
  InstallationInfo,
  PackageBasicInfo,
  UsageExample,
  RepositoryInfo,
} from '../types/index.js';
import { swiftPackageIndexApiService } from '../services/swift-package-index-api.js';
import { githubApiService } from '../services/github-api.js';
import { ReadmeParser } from '../services/readme-parser.js';
import { PackageNameValidator, VersionValidator } from '../utils/validators.js';
import { logger } from '../utils/logger.js';
import { cacheManager } from '../services/cache.js';
import { searchPackages } from './search-packages.js';

export async function getPackageReadme(params: GetPackageReadmeParams): Promise<PackageReadmeResponse> {
  // Validate input parameters
  PackageNameValidator.validatePackageName(params.package_name);
  VersionValidator.validateVersion(params.version);

  const version = params.version || 'latest';
  const includeExamples = params.include_examples !== false;

  logger.info('Getting package README', {
    package_name: params.package_name,
    version,
    include_examples: includeExamples,
  });

  // Check cache first
  const cached = cacheManager.getPackageReadme<PackageReadmeResponse>(params.package_name, version);
  if (cached) {
    logger.debug('Package README cache hit', { package_name: params.package_name, version });
    return cached;
  }

  try {
    let packageInfo: { owner: string; repo: string; url: string };
    let searchResult: any = null;

    // Try multiple strategies to find the package
    try {
      // Strategy 1: If package name is already in owner/repo format
      if (params.package_name.includes('/')) {
        packageInfo = PackageNameValidator.normalizePackageName(params.package_name);
      } else {
        // Strategy 2: Search in Swift Package Index first
        logger.debug(`Searching for package: ${params.package_name}`);
        searchResult = await searchPackages({ query: params.package_name, limit: 20 });
        
        // Look for exact match or close match
        let matchedPackage = searchResult.packages.find((pkg: any) => pkg.name === params.package_name);
        if (!matchedPackage) {
          // Try case-insensitive match
          matchedPackage = searchResult.packages.find((pkg: any) => 
            pkg.name.toLowerCase() === params.package_name.toLowerCase()
          );
        }
        if (!matchedPackage) {
          // Try partial match
          matchedPackage = searchResult.packages.find((pkg: any) => 
            pkg.name.toLowerCase().includes(params.package_name.toLowerCase()) ||
            params.package_name.toLowerCase().includes(pkg.name.toLowerCase())
          );
        }

        if (matchedPackage?.repository_url) {
          const repoMatch = matchedPackage.repository_url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
          if (repoMatch) {
            packageInfo = {
              owner: repoMatch[1],
              repo: repoMatch[2].replace('.git', ''),
              url: matchedPackage.repository_url
            };
          } else {
            throw new Error('Repository URL format not supported');
          }
        } else {
          // Strategy 3: Try common GitHub patterns
          packageInfo = await tryCommonGitHubPatterns(params.package_name);
        }
      }
    } catch (error) {
      logger.debug('Search failed, trying direct GitHub patterns', { error });
      packageInfo = await tryCommonGitHubPatterns(params.package_name);
    }
    
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

    // Determine version to fetch
    let targetVersion = version;
    if (version === 'latest') {
      // Try to get latest release
      const latestRelease = await githubApiService.getLatestRelease(packageInfo.owner, packageInfo.repo);
      if (latestRelease) {
        targetVersion = latestRelease.tag_name;
      } else {
        // Fallback to default branch
        targetVersion = githubRepo.default_branch || 'main';
      }
    }

    // Get README content
    const readmeData = await githubApiService.getReadme(
      packageInfo.owner,
      packageInfo.repo,
      targetVersion !== 'latest' ? targetVersion : undefined
    );

    // Parse README for usage examples and installation info
    let usageExamples: UsageExample[] = [];
    let installationInfo: InstallationInfo = { spm: '' };

    if (includeExamples) {
      usageExamples = ReadmeParser.extractUsageExamples(readmeData.content);
    }

    const parsedInstallation = ReadmeParser.extractInstallationInfo(readmeData.content);
    installationInfo = {
      spm: parsedInstallation.spm || `
.package(
    url: "${packageInfo.url}",
    from: "${targetVersion.replace(/^v/, '')}"
)`.trim(),
      carthage: parsedInstallation.carthage || `github "${packageInfo.owner}/${packageInfo.repo}"`,
      cocoapods: parsedInstallation.cocoapods,
    };

    // Build basic package info
    const basicInfo: PackageBasicInfo = {
      name: spiPackage?.metadata?.name || githubRepo.name,
      version: targetVersion,
      description: spiPackage?.summary || githubRepo.description || '',
      summary: spiPackage?.summary,
      homepage: githubRepo.homepage || undefined,
      documentation_url: spiPackage?.documentation_url,
      license: githubRepo.license?.name || spiPackage?.license_name || 'Unknown',
      author: githubRepo.owner.login,
      keywords: spiPackage?.metadata?.keywords || ReadmeParser.extractKeywords(readmeData.content),
      platforms: [],
      swift_versions: [],
    };

    // Get platform and Swift version compatibility
    if (spiPackage) {
      const builds = await swiftPackageIndexApiService.getPackageBuilds(packageInfo.owner, packageInfo.repo);
      basicInfo.platforms = builds.platforms;
      basicInfo.swift_versions = builds.swift_versions;
    }

    // Build repository info
    const repositoryInfo: RepositoryInfo = {
      type: 'git',
      url: githubRepo.clone_url,
    };

    const response: PackageReadmeResponse = {
      package_name: params.package_name,
      version: targetVersion,
      description: basicInfo.description,
      readme_content: readmeData.content,
      usage_examples: usageExamples,
      installation: installationInfo,
      basic_info: basicInfo,
      repository: repositoryInfo,
    };

    // Cache the result for 30 minutes
    cacheManager.setPackageReadme(params.package_name, version, response);

    logger.info('Successfully retrieved package README', {
      package_name: params.package_name,
      version: targetVersion,
      examples_count: usageExamples.length,
    });

    return response;
  } catch (error) {
    logger.error('Failed to get package README', {
      package_name: params.package_name,
      version,
      error,
    });
    throw error;
  }
}

// Helper function to try common GitHub patterns for Swift packages
async function tryCommonGitHubPatterns(packageName: string): Promise<{ owner: string; repo: string; url: string }> {
  const commonPatterns = [
    // Apple official packages
    { owner: 'apple', repo: packageName },
    { owner: 'apple', repo: `swift-${packageName}` },
    { owner: 'swiftlang', repo: packageName },
    // Common Swift community patterns
    { owner: 'vapor', repo: packageName },
    { owner: 'pointfreeco', repo: packageName },
    { owner: 'swift-server', repo: packageName },
    // Try exact package name as repo
    { owner: packageName.split('-')[0] || packageName, repo: packageName },
  ];

  const githubApi = githubApiService;
  
  for (const pattern of commonPatterns) {
    try {
      logger.debug(`Trying GitHub pattern: ${pattern.owner}/${pattern.repo}`);
      await githubApi.getRepository(pattern.owner, pattern.repo);
      
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
export interface UsageExample {
  title: string;
  description?: string | undefined;
  code: string;
  language: string; // 'swift', 'bash', etc.
}

export interface InstallationInfo {
  spm: string;      // "swift package manager command"
  carthage?: string; // "github command"
  cocoapods?: string; // "pod command"
}

export interface AuthorInfo {
  name: string;
  email?: string;
  url?: string;
}

export interface RepositoryInfo {
  type: string;
  url: string;
  directory?: string | undefined;
}

export interface PackageBasicInfo {
  name: string;
  version: string;
  description: string;
  summary?: string | undefined;
  homepage?: string | undefined;
  documentation_url?: string | undefined;
  license: string;
  author: string | AuthorInfo;
  contributors?: AuthorInfo[] | undefined;
  keywords: string[];
  platforms: string[];
  swift_versions: string[];
}

export interface DownloadStats {
  // Swift Package Index doesn't provide download stats like npm
  // We'll use stars, forks as popularity metrics
  stars: number;
  forks: number;
  issues: number;
}

export interface PackageSearchResult {
  name: string;
  version: string;
  description: string;
  summary?: string;
  keywords: string[];
  author: string;
  license: string;
  platforms: string[];
  swift_versions: string[];
  stars: number;
  score: {
    final: number;
    detail: {
      quality: number;
      popularity: number;
      maintenance: number;
    };
  };
  searchScore: number;
}

// Tool Parameters
export interface GetPackageReadmeParams {
  package_name: string;    // Package name or GitHub URL (required)
  version?: string;        // Version specification (optional, default: "latest")
  include_examples?: boolean; // Whether to include examples (optional, default: true)
}

export interface GetPackageInfoParams {
  package_name: string;    // Package name or GitHub URL
  include_dependencies?: boolean; // Whether to include dependencies (default: true)
  include_dev_dependencies?: boolean; // Whether to include development dependencies (default: false)
}

export interface SearchPackagesParams {
  query: string;          // Search query
  limit?: number;         // Maximum number of results (default: 20)
  quality?: number;       // Minimum quality score (0-1)
  popularity?: number;    // Minimum popularity score (0-1)
}

// Tool Responses
export interface PackageReadmeResponse {
  package_name: string;
  version: string;
  description: string;
  readme_content: string;
  usage_examples: UsageExample[];
  installation: InstallationInfo;
  basic_info: PackageBasicInfo;
  repository?: RepositoryInfo | undefined;
}

export interface PackageInfoResponse {
  package_name: string;
  latest_version: string;
  description: string;
  author: string;
  license: string;
  keywords: string[];
  dependencies?: Record<string, string> | undefined;
  dev_dependencies?: Record<string, string> | undefined;
  download_stats: DownloadStats;
  repository?: RepositoryInfo | undefined;
  platforms: string[];
  swift_versions: string[];
}

export interface SearchPackagesResponse {
  query: string;
  total: number;
  packages: PackageSearchResult[];
}

// Cache Types
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface CacheOptions {
  ttl?: number;
  maxSize?: number;
}

// Swift Package Index API Types
export interface SwiftPackageIndexPackage {
  id: string;
  url: string;
  summary?: string;
  activity?: {
    open_issues_count: number;
    closed_issues_count: number;
    open_pull_requests_count: number;
    closed_pull_requests_count: number;
  };
  repository_owner: string;
  repository_name: string;
  latest_version?: string;
  latest_release?: {
    version: string;
    date: string;
    url: string;
  };
  swift_compatibility?: {
    '5.9'?: boolean;
    '5.8'?: boolean;
    '5.7'?: boolean;
    '5.6'?: boolean;
    '5.5'?: boolean;
  };
  platform_compatibility?: {
    ios?: string;
    macos?: string;
    tvos?: string;
    watchos?: string;
    linux?: boolean;
  };
  license_name?: string;
  stars?: number;
  last_commit_date?: string;
  commit_count?: number;
  fork_count?: number;
  readme_url?: string;
  documentation_url?: string;
  metadata?: {
    name?: string;
    summary?: string;
    description?: string;
    keywords?: string[];
    authors?: Array<{
      name: string;
      email?: string;
      url?: string;
    }>;
    dependencies?: Array<{
      package_name: string;
      requirement: string;
    }>;
  };
}

export interface SwiftPackageIndexSearchResponse {
  hasMoreResults: boolean;
  results: Array<{
    packageId: string;
    packageName: string;
    repositoryOwner: string;
    repositoryName: string;
    summary?: string;
    stars?: number;
    lastActivityAt?: string;
    hasDocs: boolean;
    keywords?: string[];
    packageURL: string;
  }>;
}

export interface SwiftPackageManifest {
  name: string;
  platforms?: Array<{
    name: string;
    version: string;
  }>;
  products?: Array<{
    name: string;
    type: string;
    targets: string[];
  }>;
  dependencies?: Array<{
    url: string;
    requirement?: {
      range?: Array<{
        lower_bound: string;
        upper_bound: string;
      }>;
      exact?: string[];
      branch?: string[];
      revision?: string[];
    };
  }>;
  targets?: Array<{
    name: string;
    type: string;
    dependencies?: Array<string | {
      product: string;
      package?: string;
    }>;
    path?: string;
    sources?: string[];
    resources?: Array<{
      path: string;
      rule: string;
    }>;
  }>;
  swiftLanguageVersions?: string[];
}

// GitHub API Types (for fallback)
export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  clone_url: string;
  homepage?: string;
  language?: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  license?: {
    key: string;
    name: string;
    url: string;
  };
  topics: string[];
  created_at: string;
  updated_at: string;
  default_branch?: string;
  pushed_at: string;
  owner: {
    login: string;
    avatar_url: string;
    html_url: string;
  };
}

export interface GitHubReadmeResponse {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string;
  type: string;
  content: string;
  encoding: string;
  _links: {
    self: string;
    git: string;
    html: string;
  };
}

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string;
  html_url: string;
}

// Error Types
export class PackageReadmeMcpError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'PackageReadmeMcpError';
  }
}

export class PackageNotFoundError extends PackageReadmeMcpError {
  constructor(packageName: string) {
    super(`Swift package '${packageName}' not found`, 'PACKAGE_NOT_FOUND', 404);
  }
}

export class VersionNotFoundError extends PackageReadmeMcpError {
  constructor(packageName: string, version: string) {
    super(`Version '${version}' of Swift package '${packageName}' not found`, 'VERSION_NOT_FOUND', 404);
  }
}

export class RateLimitError extends PackageReadmeMcpError {
  constructor(service: string, retryAfter?: number) {
    super(`Rate limit exceeded for ${service}`, 'RATE_LIMIT_EXCEEDED', 429, { retryAfter });
  }
}

export class NetworkError extends PackageReadmeMcpError {
  constructor(message: string, originalError?: Error) {
    super(`Network error: ${message}`, 'NETWORK_ERROR', undefined, originalError);
  }
}
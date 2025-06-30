/**
 * Default configuration values for Swift Package Manager MCP server
 */
export const DEFAULT_CONFIG = {
  // Request timeout in milliseconds
  REQUEST_TIMEOUT: 30000,
  
  // Cache TTL values in seconds
  CACHE_TTL: {
    PACKAGE_INFO: 3600,     // 1 hour
    SEARCH_RESULTS: 1800,   // 30 minutes
    README: 1800,           // 30 minutes
    BUILDS: 3600,           // 1 hour
  },
  
  // Search limits
  SEARCH: {
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 250,
    MIN_LIMIT: 1,
  },
  
  // Version settings
  VERSION: {
    DEFAULT: 'latest',
  },
  
  // API settings
  API: {
    USER_AGENT: 'swift-package-readme-mcp-server',
    BASE_URLS: {
      SWIFT_PACKAGE_INDEX: 'https://swiftpackageindex.com/api',
      GITHUB: 'https://api.github.com',
    },
  },
  
  // Common GitHub patterns for Swift packages
  GITHUB_PATTERNS: [
    // Apple official packages
    { owner: 'apple', prefix: '' },
    { owner: 'apple', prefix: 'swift-' },
    { owner: 'swiftlang', prefix: '' },
    // Common Swift community patterns
    { owner: 'vapor', prefix: '' },
    { owner: 'pointfreeco', prefix: '' },
    { owner: 'swift-server', prefix: '' },
  ],
} as const;
# Swift Package README MCP Server

A Model Context Protocol (MCP) server for fetching Swift Package Manager package README files and usage information from Swift Package Index and GitHub.

## Features

- **Package README Retrieval**: Fetch README content and extract usage examples
- **Package Information**: Get basic package info, dependencies, and metadata
- **Package Search**: Search for Swift packages with filtering options
- **Smart Caching**: Memory-based caching with TTL and LRU eviction
- **Multiple Sources**: Uses both Swift Package Index and GitHub APIs
- **Robust Error Handling**: Comprehensive error handling with retry logic

## Installation

```bash
npm install
npm run build
```

## Usage

### As an MCP Server

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "swift-package-readme": {
      "command": "node",
      "args": ["/path/to/swift-package-readme-mcp-server/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "your-github-token-here"
      }
    }
  }
}
```

### Development

```bash
# Development mode
npm run dev

# Type checking
npm run typecheck

# Linting
npm run lint

# Testing
npm test
```

## Available Tools

### get_package_readme

Retrieves package README content and extracts usage examples.

**Parameters:**
- `package_name` (required): Package name, GitHub URL, or owner/repo format
- `version` (optional): Package version (default: "latest")
- `include_examples` (optional): Whether to include usage examples (default: true)

**Example:**
```typescript
{
  "package_name": "https://github.com/Alamofire/Alamofire",
  "version": "latest",
  "include_examples": true
}
```

### get_package_info

Retrieves basic package information and dependencies.

**Parameters:**
- `package_name` (required): Package name, GitHub URL, or owner/repo format
- `include_dependencies` (optional): Include dependencies (default: true)
- `include_dev_dependencies` (optional): Include dev dependencies (default: false)

**Example:**
```typescript
{
  "package_name": "Alamofire/Alamofire",
  "include_dependencies": true
}
```

### search_packages

Searches for Swift packages in Swift Package Index.

**Parameters:**
- `query` (required): Search query
- `limit` (optional): Maximum results (default: 20, max: 250)
- `quality` (optional): Minimum quality score (0-1)
- `popularity` (optional): Minimum popularity score (0-1)

**Example:**
```typescript
{
  "query": "networking",
  "limit": 10,
  "quality": 0.7
}
```

## Configuration

### Environment Variables

- `GITHUB_TOKEN`: GitHub Personal Access Token (optional but recommended)
- `LOG_LEVEL`: Logging level (debug, info, warn, error) - default: info
- `CACHE_TTL`: Cache TTL in seconds - default: 3600
- `CACHE_MAX_SIZE`: Cache max size in bytes - default: 104857600 (100MB)
- `REQUEST_TIMEOUT`: Request timeout in milliseconds - default: 30000

### Package Name Formats

The server accepts packages in multiple formats:

1. **GitHub URLs**: `https://github.com/Alamofire/Alamofire`
2. **Owner/Repo**: `Alamofire/Alamofire`
3. **Package Names**: Resolved through Swift Package Index

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MCP Client    │───▶│swift-package-   │───▶│Swift Package    │
│   (Claude等)    │    │  readme Server  │    │    Index API    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   GitHub API    │
                       │  (Fallback)     │
                       └─────────────────┘
```

## Implementation Details

### Caching Strategy

- **Memory Cache**: LRU cache with TTL
- **Package Info Cache**: 1 hour TTL
- **README Cache**: 30 minutes TTL
- **Search Cache**: 30 minutes TTL

### Error Handling

- **Automatic Retry**: Exponential backoff for transient errors
- **Rate Limit Handling**: Respects API rate limits with backoff
- **Graceful Degradation**: Falls back to GitHub when Swift Package Index is unavailable

### Data Sources

1. **Swift Package Index**: Primary source for package metadata and search
2. **GitHub API**: README content, releases, repository information
3. **Package.swift**: Dependency information parsing

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Changelog

### v0.1.0
- Initial implementation
- Support for Swift Package Index and GitHub APIs
- README parsing and usage example extraction
- Comprehensive caching and error handling
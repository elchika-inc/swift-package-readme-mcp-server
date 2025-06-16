import { PackageReadmeMcpError } from '../types/index.js';

export class ValidationError extends PackageReadmeMcpError {
  constructor(message: string, field?: string) {
    super(message, 'VALIDATION_ERROR', 400, { field });
  }
}

export class PackageNameValidator {
  // Swift package names can be:
  // 1. GitHub URLs: https://github.com/owner/repo, https://github.com/owner/repo.git
  // 2. Owner/repo format: owner/repo
  // 3. Full package names from Swift Package Index: owner-repo
  
  static validatePackageName(packageName: string): void {
    if (!packageName || typeof packageName !== 'string') {
      throw new ValidationError('Package name is required and must be a string');
    }

    const trimmed = packageName.trim();
    if (trimmed.length === 0) {
      throw new ValidationError('Package name cannot be empty');
    }

    // Check for valid formats
    const githubUrlRegex = /^https:\/\/github\.com\/[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+(?:\.git)?$/;
    const ownerRepoRegex = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;
    const packageNameRegex = /^[a-zA-Z0-9._-]+$/;

    if (!githubUrlRegex.test(trimmed) && 
        !ownerRepoRegex.test(trimmed) && 
        !packageNameRegex.test(trimmed)) {
      throw new ValidationError(
        'Package name must be a GitHub URL (https://github.com/owner/repo), ' +
        'owner/repo format, or a valid package name'
      );
    }

    // Additional validation for specific parts
    if (trimmed.includes('..') || trimmed.includes('//')) {
      throw new ValidationError('Package name contains invalid path sequences');
    }

    if (trimmed.length > 200) {
      throw new ValidationError('Package name is too long (max 200 characters)');
    }
  }

  static normalizePackageName(packageName: string): { owner: string; repo: string; url: string } {
    const trimmed = packageName.trim();
    
    // GitHub URL format
    const githubUrlMatch = trimmed.match(/^https:\/\/github\.com\/([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)(?:\.git)?$/);
    if (githubUrlMatch) {
      const [, owner, repo] = githubUrlMatch;
      return {
        owner,
        repo: repo.replace(/\.git$/, ''),
        url: `https://github.com/${owner}/${repo.replace(/\.git$/, '')}`
      };
    }

    // Owner/repo format
    const ownerRepoMatch = trimmed.match(/^([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)$/);
    if (ownerRepoMatch) {
      const [, owner, repo] = ownerRepoMatch;
      return {
        owner,
        repo,
        url: `https://github.com/${owner}/${repo}`
      };
    }

    // Assume it's a package name and we need to look it up
    throw new ValidationError(
      'Cannot determine owner/repo from package name. Please use GitHub URL or owner/repo format.'
    );
  }
}

export class VersionValidator {
  static validateVersion(version?: string): void {
    if (version === undefined || version === null) {
      return; // Optional parameter
    }

    if (typeof version !== 'string') {
      throw new ValidationError('Version must be a string');
    }

    const trimmed = version.trim();
    if (trimmed.length === 0) {
      throw new ValidationError('Version cannot be empty');
    }

    // Allow semantic versions, tags, and special values
    const validVersionRegex = /^(latest|main|master|\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?|v?\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?|[a-zA-Z0-9._-]+)$/;
    
    if (!validVersionRegex.test(trimmed)) {
      throw new ValidationError('Invalid version format');
    }

    if (trimmed.length > 50) {
      throw new ValidationError('Version is too long (max 50 characters)');
    }
  }
}

export class SearchQueryValidator {
  static validateSearchQuery(query: string): void {
    if (!query || typeof query !== 'string') {
      throw new ValidationError('Search query is required and must be a string');
    }

    const trimmed = query.trim();
    if (trimmed.length === 0) {
      throw new ValidationError('Search query cannot be empty');
    }

    if (trimmed.length < 2) {
      throw new ValidationError('Search query must be at least 2 characters long');
    }

    if (trimmed.length > 100) {
      throw new ValidationError('Search query is too long (max 100 characters)');
    }

    // Check for potentially harmful content
    const harmfulPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
    ];

    for (const pattern of harmfulPatterns) {
      if (pattern.test(trimmed)) {
        throw new ValidationError('Search query contains potentially harmful content');
      }
    }
  }
}

export class NumericValidator {
  static validateLimit(limit?: number): void {
    if (limit === undefined || limit === null) {
      return; // Optional parameter
    }

    if (typeof limit !== 'number' || !Number.isInteger(limit)) {
      throw new ValidationError('Limit must be an integer');
    }

    if (limit < 1) {
      throw new ValidationError('Limit must be at least 1');
    }

    if (limit > 250) {
      throw new ValidationError('Limit cannot exceed 250');
    }
  }

  static validateScore(score?: number, fieldName: string = 'score'): void {
    if (score === undefined || score === null) {
      return; // Optional parameter
    }

    if (typeof score !== 'number') {
      throw new ValidationError(`${fieldName} must be a number`);
    }

    if (!Number.isFinite(score)) {
      throw new ValidationError(`${fieldName} must be a finite number`);
    }

    if (score < 0 || score > 1) {
      throw new ValidationError(`${fieldName} must be between 0 and 1`);
    }
  }
}

export class GeneralValidator {
  static validateBoolean(value?: boolean, fieldName: string = 'field'): void {
    if (value === undefined || value === null) {
      return; // Optional parameter
    }

    if (typeof value !== 'boolean') {
      throw new ValidationError(`${fieldName} must be a boolean`);
    }
  }

  static sanitizeString(input: string): string {
    return input
      .trim()
      .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
      .replace(/\s+/g, ' '); // Normalize whitespace
  }
}
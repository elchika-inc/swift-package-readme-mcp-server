import type { CacheEntry, CacheOptions } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private maxSize: number;
  private defaultTtl: number;

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize || 100 * 1024 * 1024; // 100MB default
    this.defaultTtl = options.ttl || 3600; // 1 hour default
  }

  set<T>(key: string, value: T, ttl?: number): void {
    try {
      const entry: CacheEntry<T> = {
        data: value,
        timestamp: Date.now(),
        ttl: (ttl || this.defaultTtl) * 1000, // Convert to milliseconds
      };

      // Check if we need to evict old entries
      this.evictExpired();
      
      // Estimate memory usage (rough calculation)
      const estimatedSize = this.estimateSize(value);
      if (estimatedSize > this.maxSize) {
        logger.warn('Cache entry too large, skipping', { key, estimatedSize });
        return;
      }

      // Make room if needed
      while (this.getCurrentSize() + estimatedSize > this.maxSize && this.cache.size > 0) {
        this.evictLRU();
      }

      this.cache.set(key, entry as CacheEntry<unknown>);
      
      logger.debug('Cache entry set', { key, ttl: ttl || this.defaultTtl });
    } catch (error) {
      logger.error('Failed to set cache entry', { key, error });
    }
  }

  get<T>(key: string): T | undefined {
    try {
      const entry = this.cache.get(key) as CacheEntry<T> | undefined;
      
      if (!entry) {
        logger.debug('Cache miss', { key });
        return undefined;
      }

      // Check if expired
      if (Date.now() - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        logger.debug('Cache entry expired', { key });
        return undefined;
      }

      logger.debug('Cache hit', { key });
      return entry.data;
    } catch (error) {
      logger.error('Failed to get cache entry', { key, error });
      return undefined;
    }
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      logger.debug('Cache entry deleted', { key });
    }
    return deleted;
  }

  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.info('Cache cleared', { entriesRemoved: size });
  }

  getStats(): {
    size: number;
    estimatedMemoryUsage: number;
    hitRate?: number;
  } {
    return {
      size: this.cache.size,
      estimatedMemoryUsage: this.getCurrentSize(),
    };
  }

  private evictExpired(): void {
    const now = Date.now();
    let evicted = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        evicted++;
      }
    }

    if (evicted > 0) {
      logger.debug('Evicted expired cache entries', { count: evicted });
    }
  }

  private evictLRU(): void {
    // Simple LRU: remove the first (oldest) entry
    // In a production implementation, you'd want to track access times
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      this.cache.delete(firstKey);
      logger.debug('Evicted LRU cache entry', { key: firstKey });
    }
  }

  private getCurrentSize(): number {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += this.estimateSize(entry.data);
    }
    return totalSize;
  }

  private estimateSize(obj: unknown): number {
    try {
      // Rough estimation based on JSON string length
      return JSON.stringify(obj).length * 2; // Assume 2 bytes per character
    } catch {
      return 1024; // Default size if serialization fails
    }
  }
}

export class CacheManager {
  private packageInfoCache: MemoryCache;
  private packageReadmeCache: MemoryCache;
  private searchCache: MemoryCache;
  private generalCache: MemoryCache;

  constructor() {
    const cacheOptions: CacheOptions = {
      ttl: parseInt(process.env.CACHE_TTL || '3600', 10),
      maxSize: parseInt(process.env.CACHE_MAX_SIZE || '104857600', 10), // 100MB
    };

    this.packageInfoCache = new MemoryCache(cacheOptions);
    this.packageReadmeCache = new MemoryCache(cacheOptions);
    this.searchCache = new MemoryCache({ ...cacheOptions, ttl: 1800 }); // 30 minutes for search
    this.generalCache = new MemoryCache(cacheOptions);
  }

  // Package info cache
  setPackageInfo<T>(packageName: string, version: string, data: T): void {
    const key = `pkg_info:${packageName}:${version}`;
    this.packageInfoCache.set(key, data);
  }

  getPackageInfo<T>(packageName: string, version: string): T | undefined {
    const key = `pkg_info:${packageName}:${version}`;
    return this.packageInfoCache.get<T>(key);
  }

  // Package README cache
  setPackageReadme<T>(packageName: string, version: string, data: T): void {
    const key = `pkg_readme:${packageName}:${version}`;
    this.packageReadmeCache.set(key, data);
  }

  getPackageReadme<T>(packageName: string, version: string): T | undefined {
    const key = `pkg_readme:${packageName}:${version}`;
    return this.packageReadmeCache.get<T>(key);
  }

  // Search results cache
  setSearchResults<T>(queryHash: string, limit: number, data: T): void {
    const key = `search:${queryHash}:${limit}`;
    this.searchCache.set(key, data);
  }

  getSearchResults<T>(queryHash: string, limit: number): T | undefined {
    const key = `search:${queryHash}:${limit}`;
    return this.searchCache.get<T>(key);
  }

  // General purpose cache
  setGeneral<T>(key: string, data: T, ttl?: number): void {
    this.generalCache.set(key, data, ttl);
  }

  getGeneral<T>(key: string): T | undefined {
    return this.generalCache.get<T>(key);
  }

  // Utility methods
  createQueryHash(query: string, filters?: Record<string, unknown>): string {
    const data = { query, ...filters };
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }

  getOverallStats(): {
    packageInfo: ReturnType<MemoryCache['getStats']>;
    packageReadme: ReturnType<MemoryCache['getStats']>;
    search: ReturnType<MemoryCache['getStats']>;
    general: ReturnType<MemoryCache['getStats']>;
  } {
    return {
      packageInfo: this.packageInfoCache.getStats(),
      packageReadme: this.packageReadmeCache.getStats(),
      search: this.searchCache.getStats(),
      general: this.generalCache.getStats(),
    };
  }

  clearAll(): void {
    this.packageInfoCache.clear();
    this.packageReadmeCache.clear();
    this.searchCache.clear();
    this.generalCache.clear();
    logger.info('All caches cleared');
  }
}

// Export a singleton instance
export const cacheManager = new CacheManager();
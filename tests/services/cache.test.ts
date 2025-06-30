import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryCache, CacheManager } from '../../src/services/cache.js';

vi.mock('../../src/utils/logger.js');

describe('MemoryCache', () => {
  let cache: MemoryCache;

  beforeEach(() => {
    cache = new MemoryCache({ ttl: 1, maxSize: 1000 }); // 1 second TTL for testing
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('set and get', () => {
    it('should store and retrieve data', () => {
      const testData = { test: 'value' };
      cache.set('test-key', testData);
      
      expect(cache.get('test-key')).toEqual(testData);
    });

    it('should return undefined for non-existent key', () => {
      expect(cache.get('non-existent')).toBeUndefined();
    });

    it('should handle different data types', () => {
      cache.set('string', 'test string');
      cache.set('number', 42);
      cache.set('boolean', true);
      cache.set('object', { nested: { value: 'test' } });
      cache.set('array', [1, 2, 3]);

      expect(cache.get('string')).toBe('test string');
      expect(cache.get('number')).toBe(42);
      expect(cache.get('boolean')).toBe(true);
      expect(cache.get('object')).toEqual({ nested: { value: 'test' } });
      expect(cache.get('array')).toEqual([1, 2, 3]);
    });
  });

  describe('TTL functionality', () => {
    it('should expire entries after TTL', async () => {
      cache.set('temp-key', 'temp-value', 0.1); // 0.1 second TTL
      
      expect(cache.get('temp-key')).toBe('temp-value');
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(cache.get('temp-key')).toBeUndefined();
    });

    it('should use default TTL when not specified', () => {
      cache.set('default-ttl-key', 'value');
      expect(cache.has('default-ttl-key')).toBe(true);
    });

    it('should handle zero TTL (uses default TTL)', () => {
      cache.set('zero-ttl', 'value', 0);
      // Zero TTL actually uses default TTL due to implementation
      expect(cache.get('zero-ttl')).toBe('value');
    });
  });

  describe('has method', () => {
    it('should return true for existing non-expired keys', () => {
      cache.set('existing', 'value');
      expect(cache.has('existing')).toBe(true);
    });

    it('should return false for non-existent keys', () => {
      expect(cache.has('non-existent')).toBe(false);
    });

    it('should return false for expired keys', async () => {
      cache.set('expiring', 'value', 0.1);
      expect(cache.has('expiring')).toBe(true);
      
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(cache.has('expiring')).toBe(false);
    });
  });

  describe('delete method', () => {
    it('should delete existing entries', () => {
      cache.set('to-delete', 'value');
      expect(cache.has('to-delete')).toBe(true);
      
      const deleted = cache.delete('to-delete');
      expect(deleted).toBe(true);
      expect(cache.has('to-delete')).toBe(false);
    });

    it('should return false when deleting non-existent entries', () => {
      const deleted = cache.delete('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('clear method', () => {
    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      expect(cache.getStats().size).toBe(3);
      
      cache.clear();
      
      expect(cache.getStats().size).toBe(0);
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(false);
      expect(cache.has('key3')).toBe(false);
    });
  });

  describe('memory management', () => {
    it('should track cache size', () => {
      const stats = cache.getStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('estimatedMemoryUsage');
      expect(typeof stats.size).toBe('number');
      expect(typeof stats.estimatedMemoryUsage).toBe('number');
    });

    it('should evict entries when exceeding max size', () => {
      const smallCache = new MemoryCache({ maxSize: 50 }); // Very small cache
      
      // Add entries that will trigger eviction
      smallCache.set('large1', 'x'.repeat(10));
      smallCache.set('large2', 'x'.repeat(10));
      smallCache.set('large3', 'x'.repeat(10));
      
      // At least one entry should be evicted due to LRU
      const hasAll = smallCache.has('large1') && smallCache.has('large2') && smallCache.has('large3');
      expect(hasAll).toBe(false);
    });

    it('should skip entries that are too large', () => {
      const smallCache = new MemoryCache({ maxSize: 50 });
      
      smallCache.set('huge-entry', 'x'.repeat(100));
      
      expect(smallCache.has('huge-entry')).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle circular references gracefully', () => {
      const circular: any = { name: 'test' };
      circular.self = circular;
      
      // Should not throw, but entry won't be set due to JSON.stringify failure
      expect(() => cache.set('circular', circular)).not.toThrow();
      
      // Entry won't be in cache due to JSON.stringify failure in implementation
      expect(cache.has('circular')).toBe(false);
    });

    it('should handle undefined and null values', () => {
      cache.set('undefined-value', undefined);
      cache.set('null-value', null);
      
      expect(cache.get('undefined-value')).toBeUndefined();
      expect(cache.get('null-value')).toBeNull();
    });
  });
});

describe('CacheManager', () => {
  let cacheManager: CacheManager;

  beforeEach(() => {
    cacheManager = new CacheManager();
  });

  describe('package info cache', () => {
    it('should store and retrieve package info', () => {
      const packageInfo = { name: 'Alamofire', version: '5.6.0' };
      
      cacheManager.setPackageInfo('Alamofire', '5.6.0', packageInfo);
      const retrieved = cacheManager.getPackageInfo('Alamofire', '5.6.0');
      
      expect(retrieved).toEqual(packageInfo);
    });

    it('should use different keys for different packages/versions', () => {
      cacheManager.setPackageInfo('Alamofire', '5.6.0', { version: '5.6.0' });
      cacheManager.setPackageInfo('Alamofire', '5.7.0', { version: '5.7.0' });
      cacheManager.setPackageInfo('SnapKit', '5.6.0', { name: 'SnapKit' });
      
      expect(cacheManager.getPackageInfo('Alamofire', '5.6.0')).toEqual({ version: '5.6.0' });
      expect(cacheManager.getPackageInfo('Alamofire', '5.7.0')).toEqual({ version: '5.7.0' });
      expect(cacheManager.getPackageInfo('SnapKit', '5.6.0')).toEqual({ name: 'SnapKit' });
    });
  });

  describe('package readme cache', () => {
    it('should store and retrieve package readme', () => {
      const readme = { content: 'README content', examples: [] };
      
      cacheManager.setPackageReadme('TestPackage', '1.0.0', readme);
      const retrieved = cacheManager.getPackageReadme('TestPackage', '1.0.0');
      
      expect(retrieved).toEqual(readme);
    });
  });

  describe('search results cache', () => {
    it('should store and retrieve search results', () => {
      const searchResults = [{ name: 'Result1' }, { name: 'Result2' }];
      const queryHash = cacheManager.createQueryHash('test query');
      
      cacheManager.setSearchResults(queryHash, 20, searchResults);
      const retrieved = cacheManager.getSearchResults(queryHash, 20);
      
      expect(retrieved).toEqual(searchResults);
    });

    it('should use different keys for different limits', () => {
      const queryHash = cacheManager.createQueryHash('test');
      
      cacheManager.setSearchResults(queryHash, 10, ['result1']);
      cacheManager.setSearchResults(queryHash, 20, ['result1', 'result2']);
      
      expect(cacheManager.getSearchResults(queryHash, 10)).toEqual(['result1']);
      expect(cacheManager.getSearchResults(queryHash, 20)).toEqual(['result1', 'result2']);
    });
  });

  describe('query hash creation', () => {
    it('should create consistent hashes for same input', () => {
      const hash1 = cacheManager.createQueryHash('test query');
      const hash2 = cacheManager.createQueryHash('test query');
      
      expect(hash1).toBe(hash2);
    });

    it('should create different hashes for different inputs', () => {
      const hash1 = cacheManager.createQueryHash('query1');
      const hash2 = cacheManager.createQueryHash('query2');
      
      expect(hash1).not.toBe(hash2);
    });

    it('should include filters in hash calculation', () => {
      const hash1 = cacheManager.createQueryHash('test', { platform: 'iOS' });
      const hash2 = cacheManager.createQueryHash('test', { platform: 'macOS' });
      const hash3 = cacheManager.createQueryHash('test');
      
      expect(hash1).not.toBe(hash2);
      expect(hash1).not.toBe(hash3);
      expect(hash2).not.toBe(hash3);
    });

    it('should handle complex filter objects', () => {
      const filters = {
        platforms: ['iOS', 'macOS'],
        minVersion: '5.0',
        categories: ['networking', 'ui']
      };
      
      const hash1 = cacheManager.createQueryHash('test', filters);
      const hash2 = cacheManager.createQueryHash('test', filters);
      
      expect(hash1).toBe(hash2);
    });
  });

  describe('general cache', () => {
    it('should store and retrieve general data', () => {
      const data = { arbitrary: 'data' };
      
      cacheManager.setGeneral('general-key', data);
      const retrieved = cacheManager.getGeneral('general-key');
      
      expect(retrieved).toEqual(data);
    });

    it('should support custom TTL for general cache', () => {
      cacheManager.setGeneral('custom-ttl', 'value', 10);
      expect(cacheManager.getGeneral('custom-ttl')).toBe('value');
    });
  });

  describe('overall stats', () => {
    it('should provide stats for all caches', () => {
      cacheManager.setPackageInfo('pkg', '1.0', {});
      cacheManager.setPackageReadme('pkg', '1.0', {});
      cacheManager.setSearchResults('hash', 10, []);
      cacheManager.setGeneral('key', {});
      
      const stats = cacheManager.getOverallStats();
      
      expect(stats).toHaveProperty('packageInfo');
      expect(stats).toHaveProperty('packageReadme');
      expect(stats).toHaveProperty('search');
      expect(stats).toHaveProperty('general');
      
      expect(stats.packageInfo.size).toBe(1);
      expect(stats.packageReadme.size).toBe(1);
      expect(stats.search.size).toBe(1);
      expect(stats.general.size).toBe(1);
    });
  });

  describe('clearAll', () => {
    it('should clear all caches', () => {
      cacheManager.setPackageInfo('pkg', '1.0', {});
      cacheManager.setPackageReadme('pkg', '1.0', {});
      cacheManager.setSearchResults('hash', 10, []);
      cacheManager.setGeneral('key', {});
      
      const statsBefore = cacheManager.getOverallStats();
      expect(statsBefore.packageInfo.size).toBe(1);
      expect(statsBefore.packageReadme.size).toBe(1);
      expect(statsBefore.search.size).toBe(1);
      expect(statsBefore.general.size).toBe(1);
      
      cacheManager.clearAll();
      
      const statsAfter = cacheManager.getOverallStats();
      expect(statsAfter.packageInfo.size).toBe(0);
      expect(statsAfter.packageReadme.size).toBe(0);
      expect(statsAfter.search.size).toBe(0);
      expect(statsAfter.general.size).toBe(0);
    });
  });
});
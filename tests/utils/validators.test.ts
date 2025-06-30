import { describe, it, expect } from 'vitest';
import {
  ValidationError,
  PackageNameValidator,
  VersionValidator,
  SearchQueryValidator,
  NumericValidator,
  GeneralValidator
} from '../../src/utils/validators.js';

describe('ValidationError', () => {
  it('should create validation error with message', () => {
    const error = new ValidationError('Test error message');
    expect(error.message).toBe('Test error message');
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.statusCode).toBe(400);
  });

  it('should create validation error with field', () => {
    const error = new ValidationError('Test error', 'testField');
    expect(error.details).toEqual({ field: 'testField' });
  });
});

describe('PackageNameValidator', () => {
  describe('validatePackageName', () => {
    it('should accept valid GitHub URLs', () => {
      const validUrls = [
        'https://github.com/Alamofire/Alamofire',
        'https://github.com/apple/swift-algorithms',
        'https://github.com/apple/swift-algorithms.git',
        'https://github.com/Quick/Quick',
        'https://github.com/ReactiveX/RxSwift'
      ];

      validUrls.forEach(url => {
        expect(() => PackageNameValidator.validatePackageName(url)).not.toThrow();
      });
    });

    it('should accept valid owner/repo format', () => {
      const validFormats = [
        'Alamofire/Alamofire',
        'apple/swift-algorithms',
        'Quick/Quick',
        'ReactiveX/RxSwift',
        'user_name/repo-name',
        'user.name/repo.name'
      ];

      validFormats.forEach(format => {
        expect(() => PackageNameValidator.validatePackageName(format)).not.toThrow();
      });
    });

    it('should accept valid package names', () => {
      const validNames = [
        'Alamofire',
        'swift-algorithms',
        'Quick',
        'RxSwift',
        'package-name',
        'package_name',
        'package.name',
        'Package123'
      ];

      validNames.forEach(name => {
        expect(() => PackageNameValidator.validatePackageName(name)).not.toThrow();
      });
    });

    it('should reject invalid package names', () => {
      const invalidNames = [
        '',
        '   ',
        null as any,
        undefined as any,
        123 as any,
        'package name with spaces',
        'package/name/with/too/many/slashes',
        'https://not-github.com/owner/repo',
        'http://github.com/owner/repo', // Only HTTPS allowed
        'package..name',
        'package//name',
        'package@name',
        'package#name',
        'package%name'
      ];

      invalidNames.forEach(name => {
        expect(() => PackageNameValidator.validatePackageName(name)).toThrow(ValidationError);
      });
    });

    it('should reject too long package names', () => {
      const tooLongName = 'a'.repeat(201);
      expect(() => PackageNameValidator.validatePackageName(tooLongName)).toThrow(ValidationError);
    });

    it('should handle edge cases', () => {
      expect(() => PackageNameValidator.validatePackageName('  valid-name  ')).not.toThrow();
    });
  });

  describe('normalizePackageName', () => {
    it('should normalize GitHub URLs', () => {
      const testCases = [
        {
          input: 'https://github.com/Alamofire/Alamofire',
          expected: { owner: 'Alamofire', repo: 'Alamofire', url: 'https://github.com/Alamofire/Alamofire' }
        },
        {
          input: 'https://github.com/apple/swift-algorithms.git',
          expected: { owner: 'apple', repo: 'swift-algorithms', url: 'https://github.com/apple/swift-algorithms' }
        }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = PackageNameValidator.normalizePackageName(input);
        expect(result).toEqual(expected);
      });
    });

    it('should normalize owner/repo format', () => {
      const testCases = [
        {
          input: 'Alamofire/Alamofire',
          expected: { owner: 'Alamofire', repo: 'Alamofire', url: 'https://github.com/Alamofire/Alamofire' }
        },
        {
          input: 'apple/swift-algorithms',
          expected: { owner: 'apple', repo: 'swift-algorithms', url: 'https://github.com/apple/swift-algorithms' }
        }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = PackageNameValidator.normalizePackageName(input);
        expect(result).toEqual(expected);
      });
    });

    it('should throw error for plain package names', () => {
      expect(() => PackageNameValidator.normalizePackageName('Alamofire')).toThrow(ValidationError);
    });

    it('should handle whitespace', () => {
      const result = PackageNameValidator.normalizePackageName('  Alamofire/Alamofire  ');
      expect(result).toEqual({
        owner: 'Alamofire',
        repo: 'Alamofire',
        url: 'https://github.com/Alamofire/Alamofire'
      });
    });
  });
});

describe('VersionValidator', () => {
  describe('validateVersion', () => {
    it('should accept undefined and null', () => {
      expect(() => VersionValidator.validateVersion(undefined)).not.toThrow();
      expect(() => VersionValidator.validateVersion(null as any)).not.toThrow();
    });

    it('should accept valid semantic versions', () => {
      const validVersions = [
        '1.0.0',
        '1.2.3',
        '10.20.30',
        '1.0.0-alpha',
        '1.0.0-beta.1',
        '2.1.0-rc.1',
        'v1.0.0',
        'v1.2.3-beta'
      ];

      validVersions.forEach(version => {
        expect(() => VersionValidator.validateVersion(version)).not.toThrow();
      });
    });

    it('should accept special version values', () => {
      const specialVersions = [
        'latest',
        'main',
        'master',
        'develop',
        'feature-branch',
        'release-1.0'
      ];

      specialVersions.forEach(version => {
        expect(() => VersionValidator.validateVersion(version)).not.toThrow();
      });
    });

    it('should reject invalid versions', () => {
      const invalidVersions = [
        '',
        '   ',
        123 as any,
        '1.0',
        '1',
        '1.0.0.',
        '.1.0.0',
        'version with spaces',
        '1.0.0@invalid',
        '1.0.0#invalid'
      ];

      invalidVersions.forEach(version => {
        expect(() => VersionValidator.validateVersion(version)).toThrow(ValidationError);
      });
    });

    it('should reject too long versions', () => {
      const tooLongVersion = 'v' + '1.0.0-' + 'a'.repeat(50);
      expect(() => VersionValidator.validateVersion(tooLongVersion)).toThrow(ValidationError);
    });

    it('should handle whitespace', () => {
      expect(() => VersionValidator.validateVersion('  1.0.0  ')).not.toThrow();
    });
  });
});

describe('SearchQueryValidator', () => {
  describe('validateSearchQuery', () => {
    it('should accept valid search queries', () => {
      const validQueries = [
        'Alamofire',
        'networking library',
        'swift ui framework',
        'test123',
        'library-name',
        'library_name',
        'library.name',
        'HTTP client',
        'JSON parser'
      ];

      validQueries.forEach(query => {
        expect(() => SearchQueryValidator.validateSearchQuery(query)).not.toThrow();
      });
    });

    it('should reject invalid search queries', () => {
      const invalidQueries = [
        '',
        '   ',
        null as any,
        undefined as any,
        123 as any,
        'a', // Too short
        'a'.repeat(101) // Too long
      ];

      invalidQueries.forEach(query => {
        expect(() => SearchQueryValidator.validateSearchQuery(query)).toThrow(ValidationError);
      });
    });

    it('should reject harmful content', () => {
      const harmfulQueries = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        'onclick=alert("xss")',
        'onload=malicious()',
        '<SCRIPT>alert("XSS")</SCRIPT>'
      ];

      harmfulQueries.forEach(query => {
        expect(() => SearchQueryValidator.validateSearchQuery(query)).toThrow(ValidationError);
      });
    });

    it('should handle whitespace', () => {
      expect(() => SearchQueryValidator.validateSearchQuery('  valid query  ')).not.toThrow();
    });

    it('should handle edge cases', () => {
      expect(() => SearchQueryValidator.validateSearchQuery('ab')).not.toThrow(); // Minimum length
      expect(() => SearchQueryValidator.validateSearchQuery('a'.repeat(100))).not.toThrow(); // Maximum length
    });
  });
});

describe('NumericValidator', () => {
  describe('validateLimit', () => {
    it('should accept undefined and null', () => {
      expect(() => NumericValidator.validateLimit(undefined)).not.toThrow();
      expect(() => NumericValidator.validateLimit(null as any)).not.toThrow();
    });

    it('should accept valid limits', () => {
      const validLimits = [1, 10, 50, 100, 250];

      validLimits.forEach(limit => {
        expect(() => NumericValidator.validateLimit(limit)).not.toThrow();
      });
    });

    it('should reject invalid limits', () => {
      const invalidLimits = [
        0,
        -1,
        251,
        1000,
        1.5,
        '10' as any,
        'abc' as any,
        NaN,
        Infinity,
        -Infinity
      ];

      invalidLimits.forEach(limit => {
        expect(() => NumericValidator.validateLimit(limit)).toThrow(ValidationError);
      });
    });
  });

  describe('validateScore', () => {
    it('should accept undefined and null', () => {
      expect(() => NumericValidator.validateScore(undefined)).not.toThrow();
      expect(() => NumericValidator.validateScore(null as any)).not.toThrow();
    });

    it('should accept valid scores', () => {
      const validScores = [0, 0.1, 0.5, 0.9, 1.0];

      validScores.forEach(score => {
        expect(() => NumericValidator.validateScore(score)).not.toThrow();
      });
    });

    it('should reject invalid scores', () => {
      const invalidScores = [
        -0.1,
        1.1,
        2,
        -1,
        NaN,
        Infinity,
        -Infinity,
        '0.5' as any,
        'abc' as any
      ];

      invalidScores.forEach(score => {
        expect(() => NumericValidator.validateScore(score)).toThrow(ValidationError);
      });
    });

    it('should use custom field name in error message', () => {
      expect(() => NumericValidator.validateScore(-0.1, 'quality')).toThrow('quality must be between 0 and 1');
    });

    it('should handle edge cases', () => {
      expect(() => NumericValidator.validateScore(0)).not.toThrow();
      expect(() => NumericValidator.validateScore(1)).not.toThrow();
    });
  });
});

describe('GeneralValidator', () => {
  describe('validateBoolean', () => {
    it('should accept undefined and null', () => {
      expect(() => GeneralValidator.validateBoolean(undefined)).not.toThrow();
      expect(() => GeneralValidator.validateBoolean(null as any)).not.toThrow();
    });

    it('should accept valid booleans', () => {
      expect(() => GeneralValidator.validateBoolean(true)).not.toThrow();
      expect(() => GeneralValidator.validateBoolean(false)).not.toThrow();
    });

    it('should reject invalid booleans', () => {
      const invalidBooleans = [
        'true' as any,
        'false' as any,
        1 as any,
        0 as any,
        [] as any,
        {} as any
      ];

      invalidBooleans.forEach(value => {
        expect(() => GeneralValidator.validateBoolean(value)).toThrow(ValidationError);
      });
    });

    it('should use custom field name in error message', () => {
      expect(() => GeneralValidator.validateBoolean('true' as any, 'includeExamples'))
        .toThrow('includeExamples must be a boolean');
    });
  });

  describe('sanitizeString', () => {
    it('should trim whitespace', () => {
      expect(GeneralValidator.sanitizeString('  hello world  ')).toBe('hello world');
    });

    it('should remove control characters', () => {
      const input = 'hello\x00\x01\x1F\x7F\x9Fworld';
      expect(GeneralValidator.sanitizeString(input)).toBe('helloworld');
    });

    it('should normalize whitespace', () => {
      expect(GeneralValidator.sanitizeString('hello     world\t\n')).toBe('hello world');
    });

    it('should handle empty string', () => {
      expect(GeneralValidator.sanitizeString('')).toBe('');
      expect(GeneralValidator.sanitizeString('   ')).toBe('');
    });

    it('should handle complex cases', () => {
      const input = '  hello\x00\x01   world\t\t\ntest  ';
      expect(GeneralValidator.sanitizeString(input)).toBe('hello world test');
    });

    it('should handle unicode characters', () => {
      const input = '  こんにちは　世界  ';
      expect(GeneralValidator.sanitizeString(input)).toBe('こんにちは 世界');
    });

    it('should handle special characters', () => {
      const input = 'hello-world_test.example@domain.com';
      expect(GeneralValidator.sanitizeString(input)).toBe('hello-world_test.example@domain.com');
    });
  });
});
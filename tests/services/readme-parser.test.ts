import { describe, it, expect } from 'vitest';
import { ReadmeParser } from '../../src/services/readme-parser.js';

describe('ReadmeParser', () => {
  describe('extractUsageExamples', () => {
    it('should extract usage examples from simple content', () => {
      const content = `# Package

\`\`\`swift
let x = 5
print(x)
\`\`\`
`;

      const examples = ReadmeParser.extractUsageExamples(content);
      expect(examples).toBeDefined();
      expect(Array.isArray(examples)).toBe(true);
      expect(examples.length).toBeGreaterThan(0);
      expect(examples[0]).toHaveProperty('code');
      expect(examples[0]).toHaveProperty('language');
    });

    it('should extract examples from usage sections', () => {
      const content = `# MyPackage

## Usage

Here is how to use this library:

\`\`\`swift
import MyPackage

let manager = NetworkManager()
let result = await manager.fetch("https://api.example.com")
\`\`\`

## Another Section

Some other content here.
`;

      const examples = ReadmeParser.extractUsageExamples(content);
      expect(examples.length).toBeGreaterThan(0);
      expect(examples[0].title).toBe('Usage');
      expect(examples[0].code).toContain('NetworkManager');
      expect(examples[0].language).toBe('swift');
    });

    it('should handle multiple usage sections', () => {
      const content = `# Package

## Basic Usage

\`\`\`swift
let basic = BasicExample()
\`\`\`

## Advanced Usage

\`\`\`swift
let advanced = AdvancedExample()
advanced.configure()
\`\`\`

## Getting Started

\`\`\`swift
// Quick start example
let quickStart = QuickExample()
\`\`\`
`;

      const examples = ReadmeParser.extractUsageExamples(content);
      expect(examples.length).toBe(3);
      expect(examples[0].title).toBe('Basic Usage');
      expect(examples[1].title).toBe('Advanced Usage');
      expect(examples[2].title).toBe('Getting Started');
    });

    it('should handle code blocks with different languages', () => {
      const content = `# Package

## Usage

Swift example:
\`\`\`swift
let swift = SwiftCode()
\`\`\`

Objective-C example:
\`\`\`objc
ObjectiveCCode *objc = [[ObjectiveCCode alloc] init];
\`\`\`

Shell example:
\`\`\`bash
swift package init
\`\`\`
`;

      const examples = ReadmeParser.extractUsageExamples(content);
      expect(examples.length).toBe(3);
      expect(examples.find(e => e.language === 'swift')).toBeDefined();
      expect(examples.find(e => e.language === 'objc')).toBeDefined();
      expect(examples.find(e => e.language === 'bash')).toBeDefined();
    });

    it('should extract descriptions for code blocks', () => {
      const content = `# Package

## Usage

This is a simple example of how to create a manager.

\`\`\`swift
let manager = Manager()
manager.start()
\`\`\`

For advanced usage, you can configure the manager with custom settings.

\`\`\`swift
let manager = Manager()
manager.configure(with: customSettings)
manager.start()
\`\`\`
`;

      const examples = ReadmeParser.extractUsageExamples(content);
      expect(examples[0].description).toContain('simple example');
      expect(examples[1].description).toContain('advanced usage');
    });

    it('should filter out invalid examples', () => {
      const content = `# Package

## Usage

\`\`\`swift
import Foundation
\`\`\`

\`\`\`swift
// Just a comment
\`\`\`

\`\`\`swift
let valid = ValidExample()
valid.performAction()
\`\`\`

\`\`\`bash
$ swift test
✓ All tests passed
\`\`\`
`;

      const examples = ReadmeParser.extractUsageExamples(content);
      expect(examples.length).toBe(1);
      expect(examples[0].code).toContain('ValidExample');
    });

    it('should handle nested markdown structures', () => {
      const content = `# Package

## Usage

### Basic Setup

First, initialize the manager:

\`\`\`swift
let manager = Manager()
\`\`\`

### Configuration

Then configure it:

\`\`\`swift
manager.configure(options: .default)
\`\`\`

#### Advanced Options

For power users:

\`\`\`swift
let advancedOptions = AdvancedOptions()
manager.configure(options: advancedOptions)
\`\`\`
`;

      const examples = ReadmeParser.extractUsageExamples(content);
      expect(examples.length).toBe(3);
      expect(examples.some(e => e.code.includes('Manager()'))).toBe(true);
      expect(examples.some(e => e.code.includes('.default'))).toBe(true);
      expect(examples.some(e => e.code.includes('AdvancedOptions'))).toBe(true);
    });

    it('should handle code blocks without language specification', () => {
      const content = `# Package

## Usage

\`\`\`
let noLanguage = "this has no language specified"
\`\`\`
`;

      const examples = ReadmeParser.extractUsageExamples(content);
      expect(examples.length).toBe(1);
      expect(examples[0].language).toBe('text');
    });

    it('should limit examples to 10 items', () => {
      let content = '# Package\n\n## Usage\n\n';
      for (let i = 0; i < 15; i++) {
        content += `\`\`\`swift\nlet example${i} = Example${i}()\n\`\`\`\n\n`;
      }

      const examples = ReadmeParser.extractUsageExamples(content);
      expect(examples.length).toBe(10);
    });
  });

  describe('extractKeywords', () => {
    it('should extract Swift-related keywords', () => {
      const content = `# Swift Package

This is a networking library for iOS and macOS.

## Features
- HTTP requests
- JSON parsing
- SwiftUI integration
- Combine support
- Async/await patterns
`;

      const keywords = ReadmeParser.extractKeywords(content);
      expect(keywords).toContain('swift');
      expect(keywords).toContain('ios');
      expect(keywords).toContain('macos');
      expect(keywords).toContain('networking');
      expect(keywords).toContain('json');
      expect(keywords).toContain('swiftui');
      expect(keywords).toContain('combine');
      expect(keywords).toContain('async');
    });

    it('should extract keywords from headers', () => {
      const content = `# Main Package

## Installation

### Requirements

#### Testing

##### Performance

###### Documentation
`;

      const keywords = ReadmeParser.extractKeywords(content);
      expect(keywords).toContain('installation');
      expect(keywords).toContain('requirements');
      expect(keywords).toContain('testing');
      expect(keywords).toContain('performance');
      expect(keywords).toContain('documentation');
    });

    it('should handle case-insensitive matching', () => {
      const content = `# Package

SWIFT package for IOS development with SWIFTUI and COMBINE frameworks.
`;

      const keywords = ReadmeParser.extractKeywords(content);
      expect(keywords).toContain('swift');
      expect(keywords).toContain('ios');
      expect(keywords).toContain('swiftui');
      expect(keywords).toContain('combine');
    });

    it('should limit keywords to 10 items', () => {
      const content = `# Package

swift ios macos tvos watchos xcode uikit swiftui foundation combine
async await actor concurrency networking json rest api http extra keywords
`;

      const keywords = ReadmeParser.extractKeywords(content);
      expect(keywords.length).toBeLessThanOrEqual(10);
    });

    it('should handle empty content', () => {
      const keywords = ReadmeParser.extractKeywords('');
      expect(keywords).toEqual([]);
    });
  });

  describe('extractInstallationInfo', () => {
    it('should extract Swift Package Manager info', () => {
      const content = `# Package

## Installation

Add the following to your Package.swift:

\`\`\`swift
dependencies: [
    .package(url: "https://github.com/owner/repo", from: "1.0.0")
]
\`\`\`
`;

      const installInfo = ReadmeParser.extractInstallationInfo(content);
      expect(installInfo).toHaveProperty('spm');
      expect(installInfo.spm).toContain('.package(url: "https://github.com/owner/repo", from: "1.0.0")');
    });

    it('should extract Carthage info', () => {
      const content = `# Package

## Installation

### Carthage

Add to your Cartfile:

github "owner/repo" ~> 1.0
`;

      const installInfo = ReadmeParser.extractInstallationInfo(content);
      expect(installInfo).toHaveProperty('carthage');
      expect(installInfo.carthage).toContain('github "owner/repo"');
    });

    it('should extract CocoaPods info', () => {
      const content = `# Package

## Installation

### CocoaPods

Add to your Podfile:

pod 'PackageName', '~> 1.0'
`;

      const installInfo = ReadmeParser.extractInstallationInfo(content);
      expect(installInfo).toHaveProperty('cocoapods');
      expect(installInfo.cocoapods).toContain("pod 'PackageName'");
    });

    it('should extract all installation methods', () => {
      const content = `# Package

## Installation

### Swift Package Manager

\`\`\`swift
.package(url: "https://github.com/owner/repo", from: "1.0.0")
\`\`\`

### Carthage

github "owner/repo" ~> 1.0

### CocoaPods

pod 'PackageName', '~> 1.0'
`;

      const installInfo = ReadmeParser.extractInstallationInfo(content);
      expect(installInfo).toHaveProperty('spm');
      expect(installInfo).toHaveProperty('carthage');
      expect(installInfo).toHaveProperty('cocoapods');
    });

    it('should handle complex SPM configurations', () => {
      const content = `# Package

## Installation

\`\`\`swift
dependencies: [
    .package(
        url: "https://github.com/owner/repo.git",
        .upToNextMajor(from: "1.0.0")
    )
]
\`\`\`
`;

      const installInfo = ReadmeParser.extractInstallationInfo(content);
      expect(installInfo.spm).toContain('upToNextMajor');
    });

    it('should handle empty content', () => {
      const installInfo = ReadmeParser.extractInstallationInfo('');
      expect(installInfo).toEqual({});
    });

    it('should handle malformed installation info gracefully', () => {
      const content = `# Package

Some broken markdown and incomplete code blocks
`;

      const installInfo = ReadmeParser.extractInstallationInfo(content);
      expect(installInfo).toBeDefined();
      expect(typeof installInfo).toBe('object');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle very long content', () => {
      const longContent = '# Package\n\n' + 'This is a very long content. '.repeat(10000);
      
      expect(() => {
        ReadmeParser.extractUsageExamples(longContent);
        ReadmeParser.extractKeywords(longContent);
        ReadmeParser.extractInstallationInfo(longContent);
      }).not.toThrow();
    });

    it('should handle malformed markdown', () => {
      const malformedContent = `# Package

\`\`\`swift
let unclosed = "string
// Missing closing backticks

## Usage

\`\`\`
Another unclosed block
`;

      expect(() => {
        ReadmeParser.extractUsageExamples(malformedContent);
      }).not.toThrow();
    });

    it('should handle unicode characters', () => {
      const unicodeContent = `# Package 📦

## Usage 使用方法

\`\`\`swift
let emoji = "😀🚀✨"
let japanese = "こんにちは"
\`\`\`
`;

      const examples = ReadmeParser.extractUsageExamples(unicodeContent);
      expect(examples.length).toBeGreaterThan(0);
    });

    it('should handle mixed line endings', () => {
      const mixedLineEndings = '# Package\r\n\r\n## Usage\n\n```swift\r\nlet code = "test"\r\n```\n';
      
      const examples = ReadmeParser.extractUsageExamples(mixedLineEndings);
      expect(examples.length).toBeGreaterThan(0);
    });

    it('should handle deeply nested sections', () => {
      const deeplyNested = `# Package
## Level 2
### Level 3
#### Level 4
##### Level 5
###### Level 6

## Usage

\`\`\`swift
let example = "nested example"
\`\`\`

### Nested Usage

\`\`\`swift
let nestedExample = "another example"
\`\`\`
`;

      const examples = ReadmeParser.extractUsageExamples(deeplyNested);
      expect(examples.length).toBeGreaterThan(0);
    });
  });
});
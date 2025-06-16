import type { UsageExample } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class ReadmeParser {
  private static readonly USAGE_SECTION_PATTERNS = [
    /^#{1,6}\s*(usage|use|using|how to use|getting started|quick start|example|examples|basic usage|api usage|tutorial)/i,
    /^#{1,6}\s*(installation and usage|setup and usage)/i,
  ];

  private static readonly CODE_BLOCK_PATTERN = /```(\w+)?\n([\s\S]*?)```/g;
  private static readonly INLINE_CODE_PATTERN = /`([^`\n]+)`/g;

  static extractUsageExamples(readmeContent: string): UsageExample[] {
    try {
      const examples: UsageExample[] = [];
      const lines = readmeContent.split('\n');
      
      // Find usage sections
      const usageSections = this.findUsageSections(lines);
      
      for (const section of usageSections) {
        const sectionExamples = this.extractExamplesFromSection(
          section.title,
          section.content
        );
        examples.push(...sectionExamples);
      }

      // If no usage sections found, extract code blocks from entire README
      if (examples.length === 0) {
        logger.debug('No usage sections found, extracting from entire README');
        const globalExamples = this.extractCodeBlocksFromText(readmeContent);
        examples.push(...globalExamples.map(block => ({
          title: 'Usage Example',
          code: block.code,
          language: block.language,
        })));
      }

      // Filter and clean examples
      const filteredExamples = examples
        .filter(example => this.isValidUsageExample(example))
        .map(example => this.cleanUsageExample(example))
        .slice(0, 10); // Limit to 10 examples

      logger.debug('Extracted usage examples', { count: filteredExamples.length });
      return filteredExamples;
    } catch (error) {
      logger.error('Error extracting usage examples', { error });
      return [];
    }
  }

  private static findUsageSections(lines: string[]): Array<{ title: string; content: string }> {
    const sections: Array<{ title: string; content: string }> = [];
    let currentSection: { title: string; startIndex: number } | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isUsageHeader = this.USAGE_SECTION_PATTERNS.some(pattern => pattern.test(line));

      if (isUsageHeader) {
        // Save previous section if exists
        if (currentSection) {
          const content = lines
            .slice(currentSection.startIndex + 1, i)
            .join('\n')
            .trim();
          if (content) {
            sections.push({
              title: currentSection.title,
              content,
            });
          }
        }

        // Start new section
        currentSection = {
          title: line.replace(/^#{1,6}\s*/, '').trim(),
          startIndex: i,
        };
      } else if (currentSection && line.match(/^#{1,6}\s/)) {
        // End current section if we hit another header
        const content = lines
          .slice(currentSection.startIndex + 1, i)
          .join('\n')
          .trim();
        if (content) {
          sections.push({
            title: currentSection.title,
            content,
          });
        }
        currentSection = null;
      }
    }

    // Handle last section
    if (currentSection) {
      const content = lines
        .slice(currentSection.startIndex + 1)
        .join('\n')
        .trim();
      if (content) {
        sections.push({
          title: currentSection.title,
          content,
        });
      }
    }

    return sections;
  }

  private static extractExamplesFromSection(title: string, content: string): UsageExample[] {
    const examples: UsageExample[] = [];
    const codeBlocks = this.extractCodeBlocksFromText(content);

    // Create examples from code blocks
    codeBlocks.forEach((block, index) => {
      const exampleTitle = codeBlocks.length === 1 
        ? title 
        : `${title} ${index + 1}`;

      examples.push({
        title: exampleTitle,
        code: block.code,
        language: block.language,
        description: this.extractDescriptionForCodeBlock(content, block.originalIndex),
      });
    });

    return examples;
  }

  private static extractCodeBlocksFromText(text: string): Array<{
    code: string;
    language: string;
    originalIndex: number;
  }> {
    const blocks: Array<{ code: string; language: string; originalIndex: number }> = [];
    let match;
    
    // Reset regex state
    this.CODE_BLOCK_PATTERN.lastIndex = 0;
    
    while ((match = this.CODE_BLOCK_PATTERN.exec(text)) !== null) {
      const language = match[1] || 'text';
      const code = match[2].trim();
      
      if (code) {
        blocks.push({
          code,
          language: this.normalizeLanguage(language),
          originalIndex: match.index,
        });
      }
    }

    return blocks;
  }

  private static extractDescriptionForCodeBlock(content: string, codeBlockIndex: number): string | undefined {
    // Look for text before the code block that might be a description
    const textBeforeCode = content.substring(0, codeBlockIndex);
    const lines = textBeforeCode.split('\n').reverse();
    
    const descriptionLines: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines
      if (!trimmed) continue;
      
      // Stop at headers
      if (trimmed.match(/^#{1,6}\s/)) break;
      
      // Stop at other code blocks
      if (trimmed.startsWith('```')) break;
      
      // Add line to description
      descriptionLines.unshift(trimmed);
      
      // Stop after a reasonable amount of text
      if (descriptionLines.length >= 3) break;
    }

    const description = descriptionLines.join(' ').trim();
    return description.length > 10 ? description : undefined;
  }

  private static normalizeLanguage(language: string): string {
    const normalized = language.toLowerCase().trim();
    
    // Map common variations to standard names
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'ts': 'typescript',
      'sh': 'bash',
      'shell': 'bash',
      'zsh': 'bash',
      'fish': 'bash',
      'yml': 'yaml',
      'md': 'markdown',
      'swift': 'swift',
      'objective-c': 'objc',
      'objectivec': 'objc',
    };

    return languageMap[normalized] || normalized || 'text';
  }

  private static isValidUsageExample(example: UsageExample): boolean {
    // Filter out examples that are likely not useful
    const code = example.code.trim();
    
    // Must have some content
    if (!code) return false;
    
    // Skip very short examples (likely not useful)
    if (code.length < 10) return false;
    
    // Skip examples that are just imports
    if (code.split('\n').every(line => 
      line.trim().startsWith('import ') || 
      line.trim().startsWith('//') || 
      line.trim() === ''
    )) {
      return false;
    }
    
    // Skip examples that look like output or logs
    if (code.includes('✓') || code.includes('→') || code.includes('$')) {
      return false;
    }
    
    return true;
  }

  private static cleanUsageExample(example: UsageExample): UsageExample {
    return {
      ...example,
      title: example.title.trim(),
      code: example.code.trim(),
      language: example.language.trim(),
      description: example.description?.trim() || undefined,
    };
  }

  static extractInstallationInfo(readmeContent: string): {
    spm?: string;
    carthage?: string;
    cocoapods?: string;
  } {
    const installationInfo: { spm?: string; carthage?: string; cocoapods?: string } = {};

    try {
      // Look for Swift Package Manager installation
      const spmMatches = readmeContent.match(
        /```(?:swift)?\n[\s\S]*?\.package\([\s\S]*?\)[\s\S]*?```/gi
      );
      if (spmMatches) {
        installationInfo.spm = spmMatches[0]
          .replace(/```\w*\n/, '')
          .replace(/```$/, '')
          .trim();
      }

      // Look for Carthage installation
      const carthageMatches = readmeContent.match(
        /github\s+"[^"]+\/[^"]+"/gi
      );
      if (carthageMatches) {
        installationInfo.carthage = carthageMatches[0];
      }

      // Look for CocoaPods installation
      const cocoapodsMatches = readmeContent.match(
        /pod\s+['"][^'"]+['"]/gi
      );
      if (cocoapodsMatches) {
        installationInfo.cocoapods = cocoapodsMatches[0];
      }

      logger.debug('Extracted installation info', installationInfo);
    } catch (error) {
      logger.error('Error extracting installation info', { error });
    }

    return installationInfo;
  }

  static extractKeywords(readmeContent: string): string[] {
    const keywords = new Set<string>();

    try {
      // Extract from common Swift/iOS related words
      const swiftKeywords = [
        'swift', 'ios', 'macos', 'tvos', 'watchos', 'xcode',
        'uikit', 'swiftui', 'foundation', 'core data', 'combine',
        'async', 'await', 'actor', 'concurrency', 'networking',
        'json', 'rest', 'api', 'http', 'url', 'session',
        'animation', 'ui', 'layout', 'constraint', 'autolayout',
        'test', 'testing', 'unit test', 'mock', 'stub'
      ];

      const lowerContent = readmeContent.toLowerCase();
      
      for (const keyword of swiftKeywords) {
        if (lowerContent.includes(keyword.toLowerCase())) {
          keywords.add(keyword);
        }
      }

      // Extract from headers
      const headers = readmeContent.match(/^#{1,6}\s+(.+)$/gm);
      if (headers) {
        for (const header of headers) {
          const headerText = header.replace(/^#{1,6}\s+/, '').toLowerCase();
          if (headerText.length > 2 && headerText.length < 20) {
            keywords.add(headerText);
          }
        }
      }

      logger.debug('Extracted keywords', { count: keywords.size });
    } catch (error) {
      logger.error('Error extracting keywords', { error });
    }

    return Array.from(keywords).slice(0, 10); // Limit to 10 keywords
  }
}

export const readmeParser = new ReadmeParser();
import { 
  BasePackageServer, 
  ToolDefinition,
  StandardValidationService,
  type ValidationService,
  BaseGetPackageReadmeParams,
  BaseGetPackageInfoParams,
  BaseSearchPackagesParams
} from '@elchika-inc/package-readme-shared';
import { getPackageReadme } from './tools/get-package-readme.js';
import { getPackageInfo } from './tools/get-package-info.js';
import { searchPackages } from './tools/search-packages.js';
import { logger } from './utils/logger.js';

const TOOL_DEFINITIONS: Record<string, ToolDefinition> = {
  get_readme_from_swift: {
    name: 'get_readme_from_swift',
    description: 'Get Swift package README and usage examples from Swift Package Index and GitHub',
    inputSchema: {
      type: 'object',
      properties: {
        package_name: {
          type: 'string',
          description: 'The name of the Swift package (GitHub URL, owner/repo, or package name)',
        },
        version: {
          type: 'string',
          description: 'The version of the package (default: "latest")',
          default: 'latest',
        },
        include_examples: {
          type: 'boolean',
          description: 'Whether to include usage examples (default: true)',
          default: true,
        }
      },
      required: ['package_name'],
    },
  },
  get_package_info_from_swift: {
    name: 'get_package_info_from_swift',
    description: 'Get Swift package basic information and dependencies from Swift Package Index and GitHub',
    inputSchema: {
      type: 'object',
      properties: {
        package_name: {
          type: 'string',
          description: 'The name of the Swift package (GitHub URL, owner/repo, or package name)',
        },
        include_dependencies: {
          type: 'boolean',
          description: 'Whether to include dependencies (default: true)',
          default: true,
        },
        include_dev_dependencies: {
          type: 'boolean',
          description: 'Whether to include development dependencies (default: false)',
          default: false,
        }
      },
      required: ['package_name'],
    },
  },
  search_packages_from_swift: {
    name: 'search_packages_from_swift',
    description: 'Search for Swift packages in Swift Package Index',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 20)',
          default: 20,
          minimum: 1,
          maximum: 250,
        },
        quality: {
          type: 'number',
          description: 'Minimum quality score (0-1)',
          minimum: 0,
          maximum: 1,
        },
        popularity: {
          type: 'number',
          description: 'Minimum popularity score (0-1)',
          minimum: 0,
          maximum: 1,
        }
      },
      required: ['query'],
    },
  },
} as const;

export class SwiftPackageReadmeMcpServer extends BasePackageServer {
  private validationService: ValidationService;

  constructor() {
    super({
      name: 'swift-package-readme-mcp',
      version: '1.0.0',
    });
    this.validationService = new StandardValidationService('swift');
  }

  protected getToolDefinitions(): Record<string, ToolDefinition> {
    return TOOL_DEFINITIONS;
  }

  protected async handleToolCall(name: string, args: unknown): Promise<unknown> {
    try {
      switch (name) {
        case 'get_readme_from_swift':
          return await getPackageReadme(this.validationService.validateReadmeParams(args));
        
        case 'get_package_info_from_swift':
          return await getPackageInfo(this.validationService.validateInfoParams(args));
        
        case 'search_packages_from_swift':
          return await searchPackages(this.validationService.validateSearchParams(args));
        
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      // Log error for debugging but let the base class handle MCP error formatting
      logger.error(`Tool execution failed: ${name}`, { error });
      throw error;
    }
  }
}

export default SwiftPackageReadmeMcpServer;
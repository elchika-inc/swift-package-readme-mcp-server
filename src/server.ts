import { 
  BasePackageServer, 
  ToolDefinition 
} from '@elchika-inc/package-readme-shared';
import { 
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import { getPackageReadme } from './tools/get-package-readme.js';
import { getPackageInfo } from './tools/get-package-info.js';
import { searchPackages } from './tools/search-packages.js';
import { logger } from './utils/logger.js';
import {
  GetPackageReadmeParams,
  GetPackageInfoParams,
  SearchPackagesParams,
  PackageReadmeMcpError,
} from './types/index.js';

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
  constructor() {
    super({
      name: 'swift-package-readme-mcp',
      version: '1.0.0',
    });
  }

  protected getToolDefinitions(): Record<string, ToolDefinition> {
    return TOOL_DEFINITIONS;
  }

  protected async handleToolCall(name: string, args: unknown): Promise<unknown> {
    try {
      switch (name) {
        case 'get_readme_from_swift':
          return await getPackageReadme(this.validateGetPackageReadmeParams(args));
        
        case 'get_package_info_from_swift':
          return await getPackageInfo(this.validateGetPackageInfoParams(args));
        
        case 'search_packages_from_swift':
          return await searchPackages(this.validateSearchPackagesParams(args));
        
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      // Log error for debugging but let the base class handle MCP error formatting
      logger.error(`Tool execution failed: ${name}`, { error });
      throw error;
    }
  }

  private validateGetPackageReadmeParams(args: unknown): GetPackageReadmeParams {
    if (!args || typeof args !== 'object') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Arguments must be an object'
      );
    }

    const params = args as Record<string, unknown>;

    // Validate required parameters
    if (!params.package_name || typeof params.package_name !== 'string') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'package_name is required and must be a string'
      );
    }

    // Validate optional parameters
    if (params.version !== undefined && typeof params.version !== 'string') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'version must be a string'
      );
    }

    if (params.include_examples !== undefined && typeof params.include_examples !== 'boolean') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'include_examples must be a boolean'
      );
    }

    const result: GetPackageReadmeParams = {
      package_name: params.package_name,
    };
    
    if (params.version !== undefined) {
      result.version = params.version as string;
    }
    
    if (params.include_examples !== undefined) {
      result.include_examples = params.include_examples as boolean;
    }
    
    return result;
  }


  private validateGetPackageInfoParams(args: unknown): GetPackageInfoParams {
    if (!args || typeof args !== 'object') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Arguments must be an object'
      );
    }

    const params = args as Record<string, unknown>;

    // Validate required parameters
    if (!params.package_name || typeof params.package_name !== 'string') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'package_name is required and must be a string'
      );
    }

    // Validate optional parameters
    if (params.include_dependencies !== undefined && typeof params.include_dependencies !== 'boolean') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'include_dependencies must be a boolean'
      );
    }

    if (params.include_dev_dependencies !== undefined && typeof params.include_dev_dependencies !== 'boolean') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'include_dev_dependencies must be a boolean'
      );
    }

    const result: GetPackageInfoParams = {
      package_name: params.package_name,
    };
    
    if (params.include_dependencies !== undefined) {
      result.include_dependencies = params.include_dependencies as boolean;
    }
    
    if (params.include_dev_dependencies !== undefined) {
      result.include_dev_dependencies = params.include_dev_dependencies as boolean;
    }
    
    return result;
  }


  private validateSearchPackagesParams(args: unknown): SearchPackagesParams {
    if (!args || typeof args !== 'object') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Arguments must be an object'
      );
    }

    const params = args as Record<string, unknown>;

    // Validate required parameters
    if (!params.query || typeof params.query !== 'string') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'query is required and must be a string'
      );
    }

    // Validate optional parameters
    if (params.limit !== undefined) {
      if (typeof params.limit !== 'number' || params.limit < 1 || params.limit > 250) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'limit must be a number between 1 and 250'
        );
      }
    }

    if (params.quality !== undefined) {
      if (typeof params.quality !== 'number' || params.quality < 0 || params.quality > 1) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'quality must be a number between 0 and 1'
        );
      }
    }

    if (params.popularity !== undefined) {
      if (typeof params.popularity !== 'number' || params.popularity < 0 || params.popularity > 1) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'popularity must be a number between 0 and 1'
        );
      }
    }

    const result: SearchPackagesParams = {
      query: params.query,
    };
    
    if (params.limit !== undefined) {
      result.limit = params.limit as number;
    }
    
    if (params.quality !== undefined) {
      result.quality = params.quality as number;
    }
    
    if (params.popularity !== undefined) {
      result.popularity = params.popularity as number;
    }
    
    return result;
  }

}

export default SwiftPackageReadmeMcpServer;
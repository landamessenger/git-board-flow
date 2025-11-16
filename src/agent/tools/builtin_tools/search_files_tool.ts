/**
 * Search Files Tool
 * Searches for files by name or content
 */

import { BaseTool } from '../base_tool';

export interface SearchFilesToolOptions {
  searchFiles: (query: string) => string[];
  getAllFiles?: () => string[];
}

export class SearchFilesTool extends BaseTool {
  constructor(private options: SearchFilesToolOptions) {
    super();
  }

  getName(): string {
    return 'search_files';
  }

  getDescription(): string {
    return 'Search for files in the repository by name, path, or content keywords. Returns a list of matching file paths.';
  }

  getInputSchema(): {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
    additionalProperties?: boolean;
  } {
    return {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query. Can be a file name, path pattern, or content keyword.'
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of results to return (default: 1000, use higher values like 5000-10000 for comprehensive searches. No hard limit - use a very high number to get all results)'
        }
      },
      required: ['query'],
      additionalProperties: false
    };
  }

  async execute(input: Record<string, any>): Promise<string> {
    const { logInfo } = require('../../../utils/logger');
    const query = input.query as string;
    logInfo(`   🔍 Searching files with query: "${query}"`);
    const maxResults = input.max_results || 1000; // Default to 1000 for comprehensive searches

    if (!query || typeof query !== 'string') {
      throw new Error('query is required and must be a string');
    }

    if (maxResults < 1) {
      throw new Error('max_results must be at least 1');
    }

    // Perform search
    const results = this.options.searchFiles(query);

    // Limit results only if maxResults is reasonable (to prevent memory issues)
    // For very large values (>= 10000), return all results
    const limitedResults = maxResults >= 10000 ? results : results.slice(0, maxResults);

    if (limitedResults.length === 0) {
      return `No files found matching query: "${query}"`;
    }

    // Format response
    const resultList = limitedResults.map((file, index) => 
      `${index + 1}. ${file}`
    ).join('\n');

    return `Found ${limitedResults.length} file(s) matching "${query}":\n\n${resultList}`;
  }
}


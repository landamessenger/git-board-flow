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
          description: 'Maximum number of results to return (default: 10)'
        }
      },
      required: ['query'],
      additionalProperties: false
    };
  }

  async execute(input: Record<string, any>): Promise<string> {
    const query = input.query as string;
    const maxResults = input.max_results || 10;

    if (!query || typeof query !== 'string') {
      throw new Error('query is required and must be a string');
    }

    if (maxResults < 1 || maxResults > 100) {
      throw new Error('max_results must be between 1 and 100');
    }

    // Perform search
    const results = this.options.searchFiles(query);

    // Limit results
    const limitedResults = results.slice(0, maxResults);

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


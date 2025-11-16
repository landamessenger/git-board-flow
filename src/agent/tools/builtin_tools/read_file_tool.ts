/**
 * Read File Tool
 * Reads file contents from repository or virtual codebase
 */

import { BaseTool } from '../base_tool';

export interface ReadFileToolOptions {
  getFileContent: (filePath: string) => string | undefined;
  repositoryFiles?: Map<string, string>;
}

export class ReadFileTool extends BaseTool {
  constructor(private options: ReadFileToolOptions) {
    super();
  }

  getName(): string {
    return 'read_file';
  }

  getDescription(): string {
    return 'Read the contents of a file from the repository. Use this to examine code, configuration files, or any file in the codebase.';
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
        file_path: {
          type: 'string',
          description: 'Path to the file to read (relative to repository root)'
        }
      },
      required: ['file_path'],
      additionalProperties: false
    };
  }

  async execute(input: Record<string, any>): Promise<string> {
    const { logInfo } = require('../../../utils/logger');
    const filePath = input.file_path as string;
    logInfo(`   📖 Reading file: ${filePath}`);

    if (!filePath || typeof filePath !== 'string') {
      throw new Error('file_path is required and must be a string');
    }

    // Try to get from virtual codebase first
    let content = this.options.getFileContent(filePath);

    // If not found, try repository files
    if (!content && this.options.repositoryFiles) {
      content = this.options.repositoryFiles.get(filePath);
    }

    if (!content) {
      return `Error: File "${filePath}" not found in the repository.`;
    }

    // Format response
    const lines = content.split('\n').length;
    return `File: ${filePath}\nLines: ${lines}\n\n\`\`\`\n${content}\n\`\`\``;
  }
}


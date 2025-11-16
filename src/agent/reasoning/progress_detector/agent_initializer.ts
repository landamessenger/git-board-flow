/**
 * Agent Initializer
 * Initializes agent with tools and repository files for progress detection
 */

import { Agent } from '../../core/agent';
import { AgentOptions } from '../../types';
import { ProgressDetectionOptions } from './types';
import { ReadFileTool } from '../../tools/builtin_tools/read_file_tool';
import { SearchFilesTool } from '../../tools/builtin_tools/search_files_tool';
import { ReportProgressTool } from '../../tools/builtin_tools/report_progress_tool';
import { FileRepository } from '../../../data/repository/file_repository';
import { logInfo, logWarn, logDebugInfo } from '../../../utils/logger';
import { SystemPromptBuilder } from './system_prompt_builder';

export interface AgentInitializerResult {
  agent: Agent;
  repositoryFiles: Map<string, string>;
  reportedProgress?: { progress: number; summary: string };
}

export class AgentInitializer {
  private static readonly EXCLUDE_PATTERNS = [
    /^build\//,
    /^dist\//,
    /^node_modules\//,
    /\.d\.ts$/,
    /^\.next\//,
    /^out\//,
    /^coverage\//,
    /\.min\.(js|css)$/,
    /\.map$/,
    /^\.git\//,
    /^\.vscode\//,
    /^\.idea\//
  ];

  private static readonly IGNORE_FILES = [
    'build/**',
    'dist/**',
    'node_modules/**',
    '*.d.ts',
    '.next/**',
    'out/**',
    'coverage/**',
    '.turbo/**',
    '.cache/**',
    '*.min.js',
    '*.min.css',
    '*.map',
    '.git/**',
    '.vscode/**',
    '.idea/**'
  ];

  /**
   * Initialize agent with tools and repository files
   */
  static async initialize(options: ProgressDetectionOptions): Promise<AgentInitializerResult> {
    const repositoryFiles = await this.loadRepositoryFiles(options);
    
    // Store for progress reported via report_progress tool
    let reportedProgress: { progress: number; summary: string } | undefined = undefined;
    
    const tools = await this.createTools(repositoryFiles, (progress, summary) => {
      reportedProgress = { progress, summary };
    });
    const systemPrompt = SystemPromptBuilder.build(options);
    
    const agentOptions: AgentOptions = {
      model: options.model || process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
      apiKey: options.apiKey,
      systemPrompt,
      tools,
      maxTurns: options.maxTurns || 20,
      enableMCP: false
    };

    const agent = new Agent(agentOptions);

    return {
      agent,
      repositoryFiles,
      reportedProgress
    };
  }

  /**
   * Load repository files from GitHub
   * Only loads changed files if available, otherwise loads all files from the branch
   */
  private static async loadRepositoryFiles(options: ProgressDetectionOptions): Promise<Map<string, string>> {
    const repositoryFiles: Map<string, string> = new Map();

    if (options.repositoryOwner && options.repositoryName) {
      try {
        const token = options.personalAccessToken;
        if (!token) {
          logWarn('⚠️ personalAccessToken not provided in options, cannot load repository files');
        } else {
          logDebugInfo(`🔑 Using token: ${token.substring(0, 10)}...${token.substring(token.length - 4)} (length: ${token.length})`);
          if (!options.repositoryBranch) {
            throw new Error(`repositoryBranch is required but not provided. Cannot load repository files from ${options.repositoryOwner}/${options.repositoryName} without a branch.`);
          }
          
          const branch = options.repositoryBranch;
          logInfo(`📥 Loading repository files from ${options.repositoryOwner}/${options.repositoryName} on branch ${branch}...`);
          
          const fileRepository = new FileRepository();
          
          // If we have changed files, only load those
          if (options.changedFiles && options.changedFiles.length > 0) {
            logInfo(`📄 Loading ${options.changedFiles.length} changed file(s)...`);
            
            for (const changedFile of options.changedFiles) {
              // Skip removed files
              if (changedFile.status === 'removed') {
                // logDebugInfo(`   ⏭️  Skipping removed file: ${changedFile.filename}`);
                continue;
              }
              
              try {
                // logDebugInfo(`📥 Loading: ${changedFile.filename}...`);
                const content = await fileRepository.getFileContent(
                  options.repositoryOwner!,
                  options.repositoryName!,
                  changedFile.filename,
                  token,
                  branch
                );
                
                if (content) {
                  repositoryFiles.set(changedFile.filename, content);
                  // logDebugInfo(`   ✅ Loaded: ${changedFile.filename} (${content.length} bytes) from ${branch}`);
                } else {
                  logWarn(`   ⚠️  Could not load: ${changedFile.filename} (empty content returned) from ${branch}`);
                }
              } catch (error: any) {
                const errorMessage = error?.message || String(error);
                const errorStatus = error?.status || 'unknown';
                logWarn(`   ⚠️  Error loading ${changedFile.filename}: ${errorMessage} (status: ${errorStatus})`);
                // Continue loading other files even if one fails
              }
            }
          } else {
            // Load all files from the branch
            const files = await fileRepository.getRepositoryContent(
              options.repositoryOwner,
              options.repositoryName,
              token,
              branch,
              this.IGNORE_FILES,
              (fileName: string) => {
                logDebugInfo(`   📄 Loaded: ${fileName}`);
              },
              (fileName: string) => {
                logDebugInfo(`   ⏭️  Ignored: ${fileName}`);
              }
            );
            
            files.forEach((content, path) => {
              repositoryFiles.set(path, content);
            });
          }
          
          logInfo(`✅ Loaded ${repositoryFiles.size} file(s) from repository`);
        }
      } catch (error) {
        logWarn(`Failed to load repository files: ${error}`);
      }
    }

    return repositoryFiles;
  }

  /**
   * Create tools for the agent
   */
  static async createTools(
    repositoryFiles: Map<string, string>,
    onProgressReported?: (progress: number, summary: string) => void
  ) {
    const readFileTool = new ReadFileTool({
      getFileContent: (filePath: string) => {
        return repositoryFiles.get(filePath);
      },
      repositoryFiles
    });

    const searchFilesTool = new SearchFilesTool({
      searchFiles: (query: string) => {
        return this.searchFiles(repositoryFiles, query);
      },
      getAllFiles: (): string[] => {
        return this.getAllFiles(repositoryFiles);
      }
    });

    // Report progress tool for structured progress reporting
    const reportProgressTool = new ReportProgressTool({
      onProgressReported: (progress, summary) => {
        if (onProgressReported) {
          onProgressReported(progress, summary);
        }
      }
    });
    
    return [readFileTool, searchFilesTool, reportProgressTool];
  }

  /**
   * Search files in repository
   */
  private static searchFiles(repositoryFiles: Map<string, string>, query: string): string[] {
    const results: string[] = [];
    const queryLower = query.toLowerCase();
    
    for (const [path] of repositoryFiles) {
      const shouldExclude = this.EXCLUDE_PATTERNS.some(pattern => pattern.test(path));
      if (shouldExclude) {
        continue;
      }
      
      const pathLower = path.toLowerCase();
      if (pathLower.includes(queryLower) || 
          pathLower.endsWith(queryLower) ||
          (queryLower.includes('.ts') && pathLower.endsWith('.ts') && !pathLower.endsWith('.d.ts')) ||
          (queryLower.includes('typescript') && pathLower.endsWith('.ts') && !pathLower.endsWith('.d.ts'))) {
        results.push(path);
      }
    }
    return results;
  }

  /**
   * Get all files (excluding compiled files)
   */
  private static getAllFiles(repositoryFiles: Map<string, string>): string[] {
    return Array.from(repositoryFiles.keys()).filter((path: string) => {
      return !this.EXCLUDE_PATTERNS.some(pattern => pattern.test(path));
    });
  }
}


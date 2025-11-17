/**
 * Agent Initializer
 * Initializes agent with tools and repository files for Copilot
 */

import { Agent } from '../../core/agent';
import { AgentOptions } from '../../types';
import { CopilotOptions } from './types';
import { ReadFileTool } from '../../tools/builtin_tools/read_file_tool';
import { SearchFilesTool } from '../../tools/builtin_tools/search_files_tool';
import { ProposeChangeTool } from '../../tools/builtin_tools/propose_change_tool';
import { ManageTodosTool } from '../../tools/builtin_tools/manage_todos_tool';
import { FileRepository } from '../../../data/repository/file_repository';
import { logInfo, logWarn, logDebugInfo } from '../../../utils/logger';
import { SystemPromptBuilder } from './system_prompt_builder';

export interface AgentInitializerResult {
  agent: Agent;
  repositoryFiles: Map<string, string>;
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
  static async initialize(options: CopilotOptions): Promise<AgentInitializerResult> {
    const repositoryFiles = await this.loadRepositoryFiles(options);
    
    const tools = await this.createTools(repositoryFiles, options);
    const systemPrompt = SystemPromptBuilder.build(options);
    
    const agentOptions: AgentOptions = {
      model: options.model || process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
      apiKey: options.apiKey,
      systemPrompt,
      tools,
      maxTurns: options.maxTurns || 50,
      enableMCP: false
    };

    const agent = new Agent(agentOptions);

    return {
      agent,
      repositoryFiles
    };
  }

  /**
   * Load repository files from GitHub
   */
  private static async loadRepositoryFiles(options: CopilotOptions): Promise<Map<string, string>> {
    const repositoryFiles: Map<string, string> = new Map();

    if (options.repositoryOwner && options.repositoryName) {
      try {
        const token = options.personalAccessToken;
        if (!token) {
          logWarn('⚠️ personalAccessToken not provided in options, cannot load repository files');
        } else {
          if (!options.repositoryBranch) {
            throw new Error(`repositoryBranch is required but not provided. Cannot load repository files from ${options.repositoryOwner}/${options.repositoryName} without a branch.`);
          }
          
          const branch = options.repositoryBranch;
          logInfo(`📥 Loading repository files from ${options.repositoryOwner}/${options.repositoryName} on branch ${branch}...`);
          
          const fileRepository = new FileRepository();
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
    options: CopilotOptions
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

    // Virtual codebase for proposed changes
    const virtualCodebase = new Map<string, string>(repositoryFiles);
    
    const proposeChangeTool = new ProposeChangeTool({
      applyChange: (change) => {
        if (change.change_type === 'create' || change.change_type === 'modify' || change.change_type === 'refactor') {
          virtualCodebase.set(change.file_path, change.suggested_code);
          logInfo(`📝 Proposed change: ${change.file_path} (${change.description || 'no description'})`);
          return true;
        } else if (change.change_type === 'delete') {
          virtualCodebase.delete(change.file_path);
          logInfo(`📝 Proposed deletion: ${change.file_path}`);
          return true;
        }
        return false;
      },
      onChangeApplied: (change: any) => {
        logInfo(`✅ Change applied: ${change.file_path}`);
      }
    });

    // Initialize TODO manager for tracking tasks
    const manageTodosTool = await this.createManageTodosTool();
    
    return [readFileTool, searchFilesTool, proposeChangeTool, manageTodosTool];
  }

  /**
   * Create ManageTodosTool
   */
  private static async createManageTodosTool(): Promise<ManageTodosTool> {
    const { ThinkTodoManager } = await import('../../../usecase/steps/common/think_todo_manager');
    const todoManager = new ThinkTodoManager();
    
    return new ManageTodosTool({
      createTodo: (content: string, status?: 'pending' | 'in_progress') => {
        const todo = todoManager.createTodo(content, status || 'pending');
        return {
          id: todo.id,
          content: todo.content,
          status: todo.status
        };
      },
      updateTodo: (id: string, updates: {
        status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
        notes?: string;
        related_files?: string[];
        related_changes?: string[];
      }) => {
        return todoManager.updateTodo(id, updates);
      },
      getAllTodos: () => {
        return todoManager.getAllTodos().map((todo: any) => ({
          id: todo.id,
          content: todo.content,
          status: todo.status,
          notes: todo.notes
        }));
      },
      getActiveTodos: () => {
        const todos = todoManager.getAllTodos();
        return todos
          .filter((todo: any) => todo.status !== 'completed' && todo.status !== 'cancelled')
          .map((todo: any) => ({
            id: todo.id,
            content: todo.content,
            status: todo.status
          }));
      }
    });
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


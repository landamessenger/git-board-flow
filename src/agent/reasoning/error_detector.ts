/**
 * Error Detector
 * Uses Agent SDK to detect potential errors in the codebase
 */

import { Agent } from '../core/agent';
import { AgentOptions, AgentResult } from '../types';
import { Task } from '../core/subagent_manager';
import { ReadFileTool } from '../tools/builtin_tools/read_file_tool';
import { SearchFilesTool } from '../tools/builtin_tools/search_files_tool';
import { ProposeChangeTool } from '../tools/builtin_tools/propose_change_tool';
import { ManageTodosTool } from '../tools/builtin_tools/manage_todos_tool';
import { FileRepository } from '../../data/repository/file_repository';
import { logInfo, logError, logWarn, logDebugInfo } from '../../utils/logger';

export interface ErrorDetectionOptions {
  model?: string;
  apiKey: string;
  maxTurns?: number;
  repositoryOwner?: string;
  repositoryName?: string;
  repositoryBranch?: string; // Branch to analyze (default: will be detected)
  focusAreas?: string[]; // Specific areas to focus on (e.g., ['src/agent', 'src/utils'])
  errorTypes?: string[]; // Types of errors to look for (e.g., ['type-errors', 'logic-errors', 'security-issues'])
  useSubAgents?: boolean; // Use subagents to parallelize file reading (default: false)
  maxConcurrentSubAgents?: number; // Maximum number of subagents to run in parallel (default: 5)
}

export interface DetectedError {
  file: string;
  line?: number;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  suggestion?: string;
}

export interface ErrorDetectionResult {
  errors: DetectedError[];
  summary: {
    total: number;
    bySeverity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    byType: Record<string, number>;
  };
  agentResult: AgentResult;
}

export class ErrorDetector {
  private agent!: Agent; // Will be initialized in initializeAgent
  private fileRepository: FileRepository;
  private options: ErrorDetectionOptions;
  private repositoryFiles: Map<string, string> = new Map();

  constructor(options: ErrorDetectionOptions) {
      this.options = {
        model: options.model || process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini', // Changed from gpt-4.1-nano to gpt-4o-mini for better instruction following
      apiKey: options.apiKey,
      maxTurns: options.maxTurns || 30,
      repositoryOwner: options.repositoryOwner,
      repositoryName: options.repositoryName,
      focusAreas: options.focusAreas || [],
      errorTypes: options.errorTypes || [],
      useSubAgents: options.useSubAgents !== undefined ? options.useSubAgents : false,
      maxConcurrentSubAgents: options.maxConcurrentSubAgents || 5
    };

    this.fileRepository = new FileRepository();
    // Note: initializeAgent is async, but we can't await in constructor
    // Caller should call initialize() or detectErrors() which will initialize
  }

  private async initializeAgent(): Promise<void> {
    // Get repository files
    let repositoryFiles: Map<string, string> = new Map();

        if (this.options.repositoryOwner && this.options.repositoryName) {
          try {
            // Get GitHub token from environment
            const token = process.env.PERSONAL_ACCESS_TOKEN || '';
            if (!token) {
              logWarn('⚠️ PERSONAL_ACCESS_TOKEN not set, cannot load repository files');
            } else {
              // Get default branch if not specified
              let branch = this.options.repositoryBranch;
              if (!branch) {
                try {
                  const { getOctokit } = await import('@actions/github');
                  const octokit = getOctokit(token);
                  const { data } = await octokit.rest.repos.get({
                    owner: this.options.repositoryOwner,
                    repo: this.options.repositoryName
                  });
                  branch = data.default_branch || 'master';
                  logInfo(`🌿 Using default branch: ${branch}`);
                } catch (error) {
                  logWarn(`⚠️ Could not fetch default branch, using 'master' as fallback: ${error}`);
                  branch = 'master';
                }
              }
              
              logInfo(`📥 Loading repository files from ${this.options.repositoryOwner}/${this.options.repositoryName}...`);
              
              // Exclude compiled files and build artifacts
              const ignoreFiles = [
                'build/**',
                'dist/**',
                'node_modules/**',
                '*.d.ts', // TypeScript declaration files (compiled)
                '.next/**',
                'out/**',
                'coverage/**',
                '.turbo/**',
                '.cache/**',
                '*.min.js',
                '*.min.css',
                '*.map', // Source maps
                '.git/**',
                '.vscode/**',
                '.idea/**'
              ];
              
              const files = await this.fileRepository.getRepositoryContent(
                this.options.repositoryOwner,
                this.options.repositoryName,
                token,
                branch,
                ignoreFiles, // ignoreFiles - exclude compiled files
                (fileName: string) => {
                  logDebugInfo(`   📄 Loaded: ${fileName}`);
                }, // progress callback
                (fileName: string) => {
                  logDebugInfo(`   ⏭️  Ignored: ${fileName}`);
                } // ignoredFiles callback
              );
              repositoryFiles = files;
              this.repositoryFiles = files; // Store for subagent partitioning
              logInfo(`✅ Loaded ${repositoryFiles.size} file(s) from repository (excluding compiled files)`);
            }
          } catch (error) {
            logWarn(`Failed to load repository files: ${error}`);
          }
        }

    // Create tools (use this.repositoryFiles to ensure we have the latest)
    const filesToUse = this.repositoryFiles.size > 0 ? this.repositoryFiles : repositoryFiles;
    
    const readFileTool = new ReadFileTool({
      getFileContent: (filePath: string) => {
        return filesToUse.get(filePath);
      },
      repositoryFiles: filesToUse
    });

    const searchFilesTool = new SearchFilesTool({
      searchFiles: (query: string) => {
        const results: string[] = [];
        const queryLower = query.toLowerCase();
        
        // Patterns to exclude compiled files
        const excludePatterns = [
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
        
        for (const [path] of filesToUse) {
          // Skip compiled files
          const shouldExclude = excludePatterns.some(pattern => pattern.test(path));
          if (shouldExclude) {
            continue;
          }
          
          const pathLower = path.toLowerCase();
          // Support multiple search strategies
          if (pathLower.includes(queryLower) || 
              pathLower.endsWith(queryLower) ||
              (queryLower.includes('.ts') && pathLower.endsWith('.ts') && !pathLower.endsWith('.d.ts')) ||
              (queryLower.includes('typescript') && pathLower.endsWith('.ts') && !pathLower.endsWith('.d.ts'))) {
            results.push(path);
          }
        }
        return results;
      },
      getAllFiles: (): string[] => {
        // Filter out compiled files
        const excludePatterns = [
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
        
        return Array.from(filesToUse.keys()).filter((path: string) => {
          return !excludePatterns.some(pattern => pattern.test(path));
        });
      }
    });

    // Virtual codebase for proposed changes
    const virtualCodebase = new Map<string, string>(filesToUse);
    
    const proposeChangeTool = new ProposeChangeTool({
      applyChange: (change) => {
        if (change.change_type === 'create' || change.change_type === 'modify') {
          virtualCodebase.set(change.file_path, change.suggested_code);
          logInfo(`📝 Proposed change: ${change.file_path} (${change.description})`);
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

    // Initialize TODO manager for tracking findings
    const { ThinkTodoManager } = await import('../../usecase/steps/common/think_todo_manager');
    const todoManager = new ThinkTodoManager();
    
    const manageTodosTool = new ManageTodosTool({
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

    // Create agent with tools
    const agentOptions: AgentOptions = {
      model: this.options.model!,
      apiKey: this.options.apiKey,
      systemPrompt: this.buildSystemPrompt(),
      tools: [readFileTool, searchFilesTool, proposeChangeTool, manageTodosTool],
      maxTurns: this.options.maxTurns,
      enableMCP: false
    };

    this.agent = new Agent(agentOptions);
  }

  private buildSystemPrompt(): string {
    const focusAreas = this.options.focusAreas?.length 
      ? `Focus on these areas: ${this.options.focusAreas.join(', ')}`
      : 'Analyze the entire codebase';

    const errorTypes = this.options.errorTypes?.length
      ? `Look for these types of errors: ${this.options.errorTypes.join(', ')}`
      : 'Look for all types of errors (type errors, logic errors, security issues, performance problems, etc.)';

    return `You are an expert code reviewer and error detector. Your task is to analyze the codebase and detect potential errors.

${focusAreas}
${errorTypes}

**STOP! DO NOT give a text response yet. You MUST use tools first.**

**MANDATORY WORKFLOW (follow this EXACTLY):**
1. Use search_files tool to find TypeScript files
   - Query examples: "src/agent", "src/utils", "src/data", "test", "core", "repository"
   - Do NOT use wildcards like "*.ts" - use directory names or keywords
   - **IMPORTANT: Use max_results: 200-500 to get comprehensive results, not just 10 files**
   - Example: search_files with query "src/agent" and max_results: 200
2. **IMMEDIATELY after each search_files, use read_file on multiple files from the results**
   - When search_files returns a list, read as many files as needed (10-20+ files per search)
   - Prioritize reading .ts files (source files) over .d.ts files (type definitions)
   - Read files from different subdirectories to get comprehensive coverage
   - Do NOT skip this step - reading files is MANDATORY
3. Repeat steps 1-2 multiple times with different search queries
4. Only after reading 20-30+ files total, you can provide your analysis

**CRITICAL: After every search_files call, you MUST call read_file on multiple files from the results. Do NOT give a text response until you've read files. Use max_results: 200-500 in search_files to get comprehensive file lists.**

**IMPORTANT ABOUT FILE PATHS:**
- The repository contains source files (.ts) and compiled files (.d.ts)
- Prioritize reading .ts source files over .d.ts type definition files
- Files in "build/" directories are compiled - look for files in "src/" directories
- If search_files returns files from "build/", search again with more specific queries to find source files

**Your workflow:**
1. Start by exploring the codebase structure using search_files
2. Read relevant files using read_file to understand the code
3. Analyze the code for potential errors:
   - Type errors (TypeScript/JavaScript)
   - Logic errors (incorrect conditions, wrong calculations)
   - Security issues (SQL injection, XSS, insecure dependencies)
   - Performance problems (inefficient algorithms, memory leaks)
   - Best practices violations
   - Potential runtime errors (null/undefined access, array bounds)
   - Race conditions
   - Resource leaks
4. For each error found, create a TODO using manage_todos with:
   - Clear description of the error including file path
   - Severity level in the description (critical, high, medium, low)
   - Type of error
   - Suggested fix
5. Use propose_change to suggest fixes for critical and high severity errors
6. **Continue exploring and analyzing until you have examined a representative sample of the codebase**
   - Don't stop after just 1-2 files
   - Explore different areas: core logic, utilities, tests, configuration
   - Look for patterns that might indicate systemic issues
7. In your final response, summarize all errors found in a structured format:
   - File: path/to/file.ts
   - Line: line number (if applicable)
   - Type: error type
   - Severity: critical/high/medium/low
   - Description: detailed explanation
   - Suggestion: how to fix it

**Error Severity Levels:**
- **critical**: Will cause system failure or data loss
- **high**: Will cause significant issues or security vulnerabilities
- **medium**: May cause issues in certain conditions
- **low**: Minor issues or code quality improvements

**Output Format:**
For each error, provide:
- File: path/to/file.ts
- Line: line number (if applicable)
- Type: error type
- Severity: critical/high/medium/low
- Description: detailed explanation
- Suggestion: how to fix it

**CRITICAL INSTRUCTIONS - READ CAREFULLY:**
- **DO NOT give a final response until you have READ at least 10-15 files using read_file**
- Searching for files is NOT enough - you MUST actually read the file contents
- Use search_files multiple times with different queries to find files in different directories
  - Try: "src/agent", "src/utils", "src/data", "test", "core", "repository"
  - The search tool finds files by substring matching in the path
- After each search, read 3-5 files from the results using read_file
- Continue this pattern: search → read multiple files → search again → read more files
- Don't give a final response until you've READ and analyzed 10-15+ files
- If you find no errors after thorough analysis, state that clearly
- Be thorough but efficient. Prioritize critical and high severity errors.

**Example workflow (you MUST follow this pattern):**
1. search_files with query "src/agent" → find agent files
2. read_file on 3-5 of those files (e.g., "src/agent/core/agent.ts", "src/agent/tools/base_tool.ts")
3. search_files with query "src/utils" → find utility files  
4. read_file on 3-5 of those files
5. search_files with query "src/data" → find data files
6. read_file on 3-5 of those files
7. Continue until you've READ 10-15+ files from different areas
8. Only THEN provide your final analysis

**REMEMBER: Searching is not analyzing. You MUST read files to analyze them.**`;
  }

  /**
   * Detect errors in the codebase
   */
  async detectErrors(prompt: string = 'Busca potenciales errores en todo el proyecto'): Promise<ErrorDetectionResult> {
    logInfo('🔍 Starting error detection...');
    logInfo(`📋 Prompt: ${prompt}`);
    logInfo(`📊 Configuration:`);
    logInfo(`   - Model: ${this.options.model}`);
    logInfo(`   - Max Turns: ${this.options.maxTurns}`);
    logInfo(`   - Repository: ${this.options.repositoryOwner}/${this.options.repositoryName || 'N/A'}`);
    logInfo(`   - Focus Areas: ${this.options.focusAreas?.join(', ') || 'All'}`);
    logInfo(`   - Error Types: ${this.options.errorTypes?.join(', ') || 'All'}`);
    logInfo(`   - Use Subagents: ${this.options.useSubAgents}`);
    if (this.options.useSubAgents) {
      logInfo(`   - Max Concurrent Subagents: ${this.options.maxConcurrentSubAgents}`);
    }

    // Initialize agent if not already initialized
    if (!this.agent) {
      logInfo('🤖 Initializing agent...');
      await this.initializeAgent();
      logInfo('✅ Agent initialized');
    }

    let result: AgentResult;
    if (this.options.useSubAgents && this.repositoryFiles.size > 20) {
      logInfo('🚀 Executing error detection with subagents...');
      const subagentResult = await this.detectErrorsWithSubAgents(prompt);
      result = subagentResult.agentResult; // Use the combined agent result
    } else {
      // Execute agent query
      logInfo('🚀 Executing agent query...');
      result = await this.agent.query(prompt);
    }
    
    logInfo(`📈 Agent execution completed:`);
    logInfo(`   - Total Turns: ${result.turns.length}`);
    logInfo(`   - Tool Calls: ${result.toolCalls.length}`);
    if (result.metrics) {
      logInfo(`   - Input Tokens: ${result.metrics.totalTokens.input}`);
      logInfo(`   - Output Tokens: ${result.metrics.totalTokens.output}`);
      logInfo(`   - Total Duration: ${result.metrics.totalDuration}ms`);
      logInfo(`   - Average Latency: ${result.metrics.averageLatency}ms`);
    }

    // Parse errors from agent response and TODOs
    const errors = this.parseErrors(result);

    // Generate summary
    const summary = this.generateSummary(errors);

    logInfo(`✅ Error detection completed: ${summary.total} error(s) found`);

    return {
      errors,
      summary,
      agentResult: result
    };
  }

  /**
   * Parse errors from agent result
   */
  private parseErrors(result: AgentResult): DetectedError[] {
    const errors: DetectedError[] = [];
    
    logDebugInfo(`📝 Parsing ${result.messages.length} messages from agent`);
    logDebugInfo(`📝 Parsing ${result.toolCalls.length} tool calls from agent`);
    logDebugInfo(`📝 Parsing ${result.turns.length} turns from agent`);

    // Parse errors from agent messages
    for (const message of result.messages) {
      if (message.role === 'assistant') {
        logDebugInfo(`   Analyzing assistant message (${typeof message.content === 'string' ? message.content.length : 'object'} chars)`);
      }
      if (message.role === 'assistant') {
        const content = typeof message.content === 'string' 
          ? message.content 
          : JSON.stringify(message.content);

        // Look for error patterns in the response
        const errorMatches = this.extractErrorsFromText(content);
        errors.push(...errorMatches);
      }
    }

    // Parse errors from tool calls (manage_todos might have created error TODOs)
    logDebugInfo(`🔍 Analyzing ${result.toolCalls.length} tool calls for error indicators`);
    for (const toolCall of result.toolCalls) {
      if (toolCall.name === 'manage_todos' && toolCall.input.action === 'create') {
        logDebugInfo(`   Found TODO creation: ${toolCall.input.content?.substring(0, 100) || 'N/A'}`);
        // TODOs created might represent errors found
        const todoContent = toolCall.input.content || toolCall.input.description || toolCall.input.text || '';
        if (todoContent.toLowerCase().includes('error') || 
            todoContent.toLowerCase().includes('bug') ||
            todoContent.toLowerCase().includes('issue') ||
            todoContent.toLowerCase().includes('problem') ||
            todoContent.toLowerCase().includes('fix') ||
            todoContent.toLowerCase().includes('corregir')) {
          // Try to extract file info from TODO content
          const fileMatch = todoContent.match(/(?:file|archivo|en|at)\s*[:\s]+([^\s\n,]+)/i);
          const severityMatch = todoContent.match(/(critical|high|medium|low|crítico|alto|medio|bajo)/i);
          errors.push({
            file: fileMatch ? fileMatch[1] : 'unknown',
            type: 'code-issue',
            severity: (severityMatch?.[1]?.toLowerCase() || 'medium') as DetectedError['severity'],
            description: todoContent
          });
        }
      }
    }

    // Also check tool results for proposed changes (these might indicate errors)
    for (const turn of result.turns) {
      if (turn.toolResults) {
        for (const toolResult of turn.toolResults) {
          if (toolResult.content && typeof toolResult.content === 'string') {
            const content = toolResult.content;
            
            // Check if it's a propose_change result (indicates an error was found)
            if (content.includes('proposed change') || content.includes('suggested fix') || content.includes('Change applied')) {
              // Try to extract error info from the change description
              const changeErrors = this.extractErrorsFromChangeDescription(content);
              errors.push(...changeErrors);
            }
          }
        }
      }
    }

    return errors;
  }

  /**
   * Extract errors from text response
   */
  private extractErrorsFromText(text: string): DetectedError[] {
    const errors: DetectedError[] = [];
    
    // Pattern to match error descriptions
    const errorPatterns = [
      /File:\s*(.+?)\n.*?Line:\s*(\d+)?.*?Type:\s*(.+?)\n.*?Severity:\s*(critical|high|medium|low).*?Description:\s*(.+?)(?:\n.*?Suggestion:\s*(.+?))?(?=\n\n|$)/gis,
      /- (.+?)\s+\((.+?):(\d+)?\)\s+\[(critical|high|medium|low)\]:\s*(.+?)(?:\n\s*Fix:\s*(.+?))?(?=\n|$)/gis
    ];

    for (const pattern of errorPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        errors.push({
          file: match[1] || match[2] || 'unknown',
          line: match[2] || match[3] ? parseInt(match[2] || match[3]) : undefined,
          type: match[3] || match[4] || 'unknown',
          severity: (match[4] || match[5] || 'medium') as DetectedError['severity'],
          description: match[5] || match[6] || 'Error detected',
          suggestion: match[6] || match[7]
        });
      }
    }

    return errors;
  }

  /**
   * Extract errors from change description
   */
  private extractErrorsFromChangeDescription(text: string): DetectedError[] {
    const errors: DetectedError[] = [];
    
    // Try to extract file path and error info
    const fileMatch = text.match(/file[:\s]+([^\s\n]+)/i);
    const severityMatch = text.match(/(critical|high|medium|low)/i);
    
    if (fileMatch) {
      errors.push({
        file: fileMatch[1],
        type: 'code-issue',
        severity: (severityMatch?.[1]?.toLowerCase() || 'medium') as DetectedError['severity'],
        description: text.substring(0, 200) // First 200 chars as description
      });
    }

    return errors;
  }

  /**
   * Generate summary of detected errors
   */
  private generateSummary(errors: DetectedError[]): ErrorDetectionResult['summary'] {
    const bySeverity = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    const byType: Record<string, number> = {};

    for (const error of errors) {
      bySeverity[error.severity]++;
      byType[error.type] = (byType[error.type] || 0) + 1;
    }

    return {
      total: errors.length,
      bySeverity,
      byType
    };
  }

  /**
   * Detect errors using subagents for parallel processing
   */
  private async detectErrorsWithSubAgents(prompt: string): Promise<ErrorDetectionResult> {
    const allFiles = Array.from(this.repositoryFiles.keys());
    const maxConcurrent = this.options.maxConcurrentSubAgents || 5;
    const filesPerAgent = Math.ceil(allFiles.length / maxConcurrent);
    
    logInfo(`📦 Partitioning ${allFiles.length} files into ${maxConcurrent} subagents (~${filesPerAgent} files each)`);
    
    // Group files by directory to keep related files together
    const fileGroups = this.partitionFilesByDirectory(allFiles, maxConcurrent);
    
    logInfo(`📁 Created ${fileGroups.length} file groups for parallel analysis`);
    
    // Create tools for subagents (same as in initializeAgent)
    const filesToUse = this.repositoryFiles;
    const readFileTool = new ReadFileTool({
      getFileContent: (filePath: string) => {
        return filesToUse.get(filePath);
      },
      repositoryFiles: filesToUse
    });

    const searchFilesTool = new SearchFilesTool({
      searchFiles: (query: string) => {
        const results: string[] = [];
        const queryLower = query.toLowerCase();
        
        // Patterns to exclude compiled files
        const excludePatterns = [
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
        
        for (const [path] of filesToUse) {
          // Skip compiled files
          const shouldExclude = excludePatterns.some(pattern => pattern.test(path));
          if (shouldExclude) {
            continue;
          }
          
          const pathLower = path.toLowerCase();
          // Support multiple search strategies
          if (pathLower.includes(queryLower) || 
              pathLower.endsWith(queryLower) ||
              (queryLower.includes('.ts') && pathLower.endsWith('.ts') && !pathLower.endsWith('.d.ts')) ||
              (queryLower.includes('typescript') && pathLower.endsWith('.ts') && !pathLower.endsWith('.d.ts'))) {
            results.push(path);
          }
        }
        return results;
      },
      getAllFiles: (): string[] => {
        // Filter out compiled files
        const excludePatterns = [
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
        
        return Array.from(filesToUse.keys()).filter((path: string) => {
          return !excludePatterns.some(pattern => pattern.test(path));
        });
      }
    });

    // Virtual codebase for proposed changes
    const virtualCodebase = new Map<string, string>(filesToUse);
    
    const proposeChangeTool = new ProposeChangeTool({
      applyChange: (change) => {
        if (change.change_type === 'create' || change.change_type === 'modify') {
          virtualCodebase.set(change.file_path, change.suggested_code);
          return true;
        } else if (change.change_type === 'delete') {
          virtualCodebase.delete(change.file_path);
          return true;
        }
        return false;
      },
      onChangeApplied: (change: any) => {
        // Silent for subagents
      }
    });

    // Initialize TODO manager for tracking findings
    const { ThinkTodoManager } = await import('../../usecase/steps/common/think_todo_manager');
    const todoManager = new ThinkTodoManager();
    
    const manageTodosTool = new ManageTodosTool({
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

    const tools = [readFileTool, searchFilesTool, proposeChangeTool, manageTodosTool];
    
    // Create tasks for each subagent
    const tasks: Task[] = fileGroups.map((files, index) => {
      const fileList = files.slice(0, 30).join(', '); // Limit to 30 files per agent to avoid token limits
      return {
        name: `error-detector-${index + 1}`,
        prompt: `${prompt}\n\nFocus on these files: ${fileList}\n\nAnalyze these specific files for errors. Read each file and identify potential issues.`,
        systemPrompt: this.buildSystemPrompt(),
        tools: tools // Pass tools to each subagent
      };
    });
    
    logInfo(`🚀 Executing ${tasks.length} subagents in parallel...`);
    const results = await this.agent.executeParallel(tasks);
    
    logInfo(`✅ All ${results.length} subagents completed`);
    
    // Combine results from all subagents
    const allErrors: DetectedError[] = [];
    const allToolCalls: any[] = [];
    const allTurns: any[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let maxDuration = 0;
    
    for (const { task, result } of results) {
      logInfo(`   📊 Subagent "${task}": ${result.turns.length} turns, ${result.toolCalls.length} tool calls`);
      const errors = this.parseErrors(result);
      allErrors.push(...errors);
      allToolCalls.push(...result.toolCalls);
      allTurns.push(...result.turns);
      
      if (result.metrics) {
        totalInputTokens += result.metrics.totalTokens.input;
        totalOutputTokens += result.metrics.totalTokens.output;
        maxDuration = Math.max(maxDuration, result.metrics.totalDuration);
      }
    }
    
    // Generate combined summary
    const summary = this.generateSummary(allErrors);
    
    // Calculate average latency from all subagents
    const totalApiCalls = results.reduce((sum, r) => sum + (r.result.metrics?.apiCalls || 0), 0);
    const totalLatency = results.reduce((sum, r) => {
      if (r.result.metrics?.averageLatency && r.result.metrics?.apiCalls) {
        return sum + (r.result.metrics.averageLatency * r.result.metrics.apiCalls);
      }
      return sum;
    }, 0);
    const averageLatency = totalApiCalls > 0 ? totalLatency / totalApiCalls : 0;
    
    // Create combined agent result
    const combinedResult: AgentResult = {
      finalResponse: `Analysis completed by ${results.length} subagents. Found ${summary.total} error(s).`,
      turns: allTurns,
      toolCalls: allToolCalls,
      messages: results.flatMap(r => r.result.messages),
      metrics: {
        totalTokens: {
          input: totalInputTokens,
          output: totalOutputTokens
        },
        totalDuration: maxDuration,
        apiCalls: totalApiCalls,
        toolCalls: allToolCalls.length,
        errors: results.reduce((sum, r) => sum + (r.result.metrics?.errors || 0), 0),
        averageLatency: averageLatency
      }
    };
    
    logInfo(`✅ Combined results: ${summary.total} error(s) found across all subagents`);
    logInfo(`   Breakdown:`);
    logInfo(`   - Critical: ${summary.bySeverity.critical}`);
    logInfo(`   - High: ${summary.bySeverity.high}`);
    logInfo(`   - Medium: ${summary.bySeverity.medium}`);
    logInfo(`   - Low: ${summary.bySeverity.low}`);
    logInfo(`   - Total Tokens: ${totalInputTokens + totalOutputTokens} (${totalInputTokens} in, ${totalOutputTokens} out)`);
    logInfo(`   - Duration: ${maxDuration}ms (parallel execution)`);
    
    return {
      errors: allErrors,
      summary,
      agentResult: combinedResult
    };
  }

  /**
   * Partition files by directory to keep related files together
   */
  private partitionFilesByDirectory(files: string[], maxGroups: number): string[][] {
    // Group files by top-level directory
    const dirGroups = new Map<string, string[]>();
    
    for (const file of files) {
      const parts = file.split('/');
      const topDir = parts.length > 1 ? parts[0] : 'root';
      
      if (!dirGroups.has(topDir)) {
        dirGroups.set(topDir, []);
      }
      dirGroups.get(topDir)!.push(file);
    }
    
    // Convert to array and sort by size (largest first)
    const groups = Array.from(dirGroups.values()).sort((a, b) => b.length - a.length);
    
    // Distribute groups across maxGroups subagents
    const result: string[][] = Array(maxGroups).fill(null).map(() => []);
    
    for (let i = 0; i < groups.length; i++) {
      const targetIndex = i % maxGroups;
      result[targetIndex].push(...groups[i]);
    }
    
    // Remove empty groups
    return result.filter(group => group.length > 0);
  }

  /**
   * Get agent instance (for advanced usage)
   */
  getAgent(): Agent {
    return this.agent;
  }
}


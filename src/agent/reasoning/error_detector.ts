/**
 * Error Detector
 * Uses Agent SDK to detect potential errors in the codebase
 */

import { Agent } from '../core/agent';
import { AgentOptions, AgentResult } from '../types';
import { ReadFileTool } from '../tools/builtin_tools/read_file_tool';
import { SearchFilesTool } from '../tools/builtin_tools/search_files_tool';
import { ProposeChangeTool } from '../tools/builtin_tools/propose_change_tool';
import { ManageTodosTool } from '../tools/builtin_tools/manage_todos_tool';
import { FileRepository } from '../../data/repository/file_repository';
import { logInfo, logError, logWarn } from '../../utils/logger';

export interface ErrorDetectionOptions {
  model?: string;
  apiKey: string;
  maxTurns?: number;
  repositoryOwner?: string;
  repositoryName?: string;
  repositoryBranch?: string; // Branch to analyze (default: will be detected)
  focusAreas?: string[]; // Specific areas to focus on (e.g., ['src/agent', 'src/utils'])
  errorTypes?: string[]; // Types of errors to look for (e.g., ['type-errors', 'logic-errors', 'security-issues'])
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

  constructor(options: ErrorDetectionOptions) {
    this.options = {
      model: options.model || process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
      apiKey: options.apiKey,
      maxTurns: options.maxTurns || 30,
      repositoryOwner: options.repositoryOwner,
      repositoryName: options.repositoryName,
      focusAreas: options.focusAreas || [],
      errorTypes: options.errorTypes || []
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
              
              const files = await this.fileRepository.getRepositoryContent(
                this.options.repositoryOwner,
                this.options.repositoryName,
                token,
                branch,
                [], // ignoreFiles
                () => {}, // progress callback
                () => {} // ignoredFiles callback
              );
              repositoryFiles = files;
            }
          } catch (error) {
            logWarn(`Failed to load repository files: ${error}`);
          }
        }

    // Create tools
    const readFileTool = new ReadFileTool({
      getFileContent: (filePath: string) => {
        return repositoryFiles.get(filePath);
      },
      repositoryFiles
    });

    const searchFilesTool = new SearchFilesTool({
      searchFiles: (query: string) => {
        const results: string[] = [];
        for (const [path] of repositoryFiles) {
          if (path.toLowerCase().includes(query.toLowerCase())) {
            results.push(path);
          }
        }
        return results;
      },
      getAllFiles: () => Array.from(repositoryFiles.keys())
    });

    // Virtual codebase for proposed changes
    const virtualCodebase = new Map<string, string>(repositoryFiles);
    
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
6. In your final response, summarize all errors found in a structured format:
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

Be thorough but efficient. Prioritize critical and high severity errors.`;
  }

  /**
   * Detect errors in the codebase
   */
  async detectErrors(prompt: string = 'Busca potenciales errores en todo el proyecto'): Promise<ErrorDetectionResult> {
    logInfo('🔍 Starting error detection...');
    logInfo(`📋 Prompt: ${prompt}`);

    // Initialize agent if not already initialized
    if (!this.agent) {
      await this.initializeAgent();
    }

    // Execute agent query
    const result = await this.agent.query(prompt);

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

    // Parse errors from agent messages
    for (const message of result.messages) {
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
    for (const toolCall of result.toolCalls) {
      if (toolCall.name === 'manage_todos' && toolCall.input.action === 'create') {
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
   * Get agent instance (for advanced usage)
   */
  getAgent(): Agent {
    return this.agent;
  }
}


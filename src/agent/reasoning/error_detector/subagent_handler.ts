/**
 * Subagent Handler
 * Handles error detection using subagents for parallel processing
 */

import { Agent } from '../../core/agent';
import { AgentResult } from '../../types';
import { Task } from '../../core/subagent_manager';
import { ErrorDetectionOptions, ErrorDetectionResult, DetectedError } from './types';
import { ReadFileTool } from '../../tools/builtin_tools/read_file_tool';
import { SearchFilesTool } from '../../tools/builtin_tools/search_files_tool';
import { ProposeChangeTool } from '../../tools/builtin_tools/propose_change_tool';
import { ManageTodosTool } from '../../tools/builtin_tools/manage_todos_tool';
import { logInfo } from '../../../utils/logger';
import { FilePartitioner } from './file_partitioner';
import { ErrorParser } from './error_parser';
import { SummaryGenerator } from './summary_generator';
import { SystemPromptBuilder } from './system_prompt_builder';
import { AgentInitializer } from './agent_initializer';

export class SubagentHandler {
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

  /**
   * Detect errors using subagents for parallel processing
   */
  static async detectErrorsWithSubAgents(
    agent: Agent,
    repositoryFiles: Map<string, string>,
    options: ErrorDetectionOptions,
    userPrompt: string
  ): Promise<ErrorDetectionResult> {
    const allFiles = Array.from(repositoryFiles.keys());
    const maxConcurrent = options.maxConcurrentSubAgents || 5;
    const filesPerAgent = Math.ceil(allFiles.length / maxConcurrent);
    
    logInfo(`📦 Partitioning ${allFiles.length} files into ${maxConcurrent} subagents (~${filesPerAgent} files each)`);
    
    // Group files by directory to keep related files together
    const fileGroups = FilePartitioner.partitionFilesByDirectory(allFiles, maxConcurrent);
    
    logInfo(`📁 Created ${fileGroups.length} file groups for parallel analysis`);
    
    // Create tools for subagents
    const tools = await this.createSubagentTools(repositoryFiles);
    
    // Create tasks for each subagent
    const systemPrompt = SystemPromptBuilder.build(options);
    const tasks: Task[] = fileGroups.map((files, index) => {
      const fileList = files.slice(0, 30).join(', '); // Limit to 30 files per agent to avoid token limits
      return {
        name: `error-detector-${index + 1}`,
        prompt: userPrompt ? `${userPrompt}\n\nFocus on these files: ${fileList}` : `Focus on analyzing these files for errors: ${fileList}`,
        systemPrompt,
        tools
      };
    });
    
    logInfo(`🚀 Executing ${tasks.length} subagents in parallel...`);
    const results = await agent.executeParallel(tasks);
    
    logInfo(`✅ All ${results.length} subagents completed`);
    
    // Combine results from all subagents
    return this.combineSubagentResults(results, options);
  }

  /**
   * Create tools for subagents
   */
  private static async createSubagentTools(repositoryFiles: Map<string, string>) {
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
    const { ThinkTodoManager } = await import('../../../usecase/steps/common/think_todo_manager');
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

    return [readFileTool, searchFilesTool, proposeChangeTool, manageTodosTool];
  }

  /**
   * Search files in repository
   */
  private static searchFiles(repositoryFiles: Map<string, string>, query: string): string[] {
    const results: string[] = [];
    const queryLower = query.toLowerCase();
    
    for (const [path] of repositoryFiles) {
      // Skip compiled files
      const shouldExclude = this.EXCLUDE_PATTERNS.some(pattern => pattern.test(path));
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
  }

  /**
   * Get all files (excluding compiled files)
   */
  private static getAllFiles(repositoryFiles: Map<string, string>): string[] {
    return Array.from(repositoryFiles.keys()).filter((path: string) => {
      return !this.EXCLUDE_PATTERNS.some(pattern => pattern.test(path));
    });
  }

  /**
   * Combine results from all subagents
   */
  private static combineSubagentResults(
    results: Array<{ task: string; result: AgentResult }>,
    options: ErrorDetectionOptions
  ): ErrorDetectionResult {
    const allErrors: DetectedError[] = [];
    const allToolCalls: any[] = [];
    const allTurns: any[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let maxDuration = 0;
    
    for (const { task, result } of results) {
      logInfo(`   📊 Subagent "${task}": ${result.turns.length} turns, ${result.toolCalls.length} tool calls`);
      const errors = ErrorParser.parseErrors(result);
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
    const summary = SummaryGenerator.generateSummary(allErrors);
    
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
}


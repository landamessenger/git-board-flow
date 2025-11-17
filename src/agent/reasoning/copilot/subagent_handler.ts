/**
 * Subagent Handler
 * Handles Copilot tasks using subagents for parallel processing
 */

import { Agent } from '../../core/agent';
import { AgentResult } from '../../types';
import { Task } from '../../core/subagent_manager';
import { CopilotOptions, CopilotResult } from './types';
import { ReadFileTool } from '../../tools/builtin_tools/read_file_tool';
import { SearchFilesTool } from '../../tools/builtin_tools/search_files_tool';
import { ProposeChangeTool } from '../../tools/builtin_tools/propose_change_tool';
import { ManageTodosTool } from '../../tools/builtin_tools/manage_todos_tool';
import { logInfo } from '../../../utils/logger';
import { FilePartitioner } from './file_partitioner';
import { SystemPromptBuilder } from './system_prompt_builder';

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
   * Process prompt using subagents for parallel processing
   */
  static async processPromptWithSubAgents(
    agent: Agent,
    repositoryFiles: Map<string, string>,
    options: CopilotOptions,
    userPrompt: string
  ): Promise<CopilotResult> {
    const allFiles = Array.from(repositoryFiles.keys());
    
    // Optimal number of files per subagent (comfortable for AI processing)
    const OPTIMAL_FILES_PER_AGENT = 15;
    const MAX_FILES_IN_PROMPT = 20; // Maximum files to list in prompt
    
    // Calculate number of subagents needed based on optimal files per agent
    // But respect maxConcurrentSubAgents as an upper limit
    const maxConcurrent = options.maxConcurrentSubAgents || 5;
    const calculatedSubagents = Math.ceil(allFiles.length / OPTIMAL_FILES_PER_AGENT);
    const numSubagents = Math.min(calculatedSubagents, maxConcurrent);
    const filesPerAgent = Math.ceil(allFiles.length / numSubagents);
    
    logInfo(`📦 Partitioning ${allFiles.length} files into ${numSubagents} subagents (~${filesPerAgent} files each)`);
    logInfo(`   Optimal: ${OPTIMAL_FILES_PER_AGENT} files per agent, creating ${numSubagents} subagents for comfortable processing`);
    
    // Group files by directory to keep related files together
    const fileGroups = FilePartitioner.partitionFilesByDirectory(allFiles, numSubagents);
    
    logInfo(`📁 Created ${fileGroups.length} file groups for parallel processing`);
    
    // Create tools for subagents (all files available through tools)
    const tools = await this.createSubagentTools(repositoryFiles, options);
    
    // Create tasks for each subagent
    const systemPrompt = SystemPromptBuilder.build(options);
    
    const tasks: Task[] = fileGroups.map((files, index) => {
      const totalFiles = files.length;
      // Show first N files in prompt, rest available through tools
      const filesToShow = files.slice(0, MAX_FILES_IN_PROMPT);
      const remainingFiles = totalFiles - filesToShow.length;
      
      let fileListSection = '';
      if (filesToShow.length > 0) {
        fileListSection = `\n\nFiles available to you (${totalFiles} total in your assigned group):\n${filesToShow.map(f => `- ${f}`).join('\n')}`;
        if (remainingFiles > 0) {
          fileListSection += `\n\n... and ${remainingFiles} more file(s). Use search_files or read_file directly to access all files.`;
        }
      }
      
      return {
        name: `copilot-${index + 1}`,
        prompt: `${userPrompt}${fileListSection}\n\n**Note:** You are one of ${fileGroups.length} subagents working in parallel. Focus on your assigned files, but you can access all repository files through the tools if needed.`,
        systemPrompt,
        tools
      };
    });
    
    logInfo(`🚀 Executing ${tasks.length} subagents in parallel...`);
    const results = await agent.executeParallel(tasks);
    
    logInfo(`✅ All ${results.length} subagents completed`);
    
    // Combine results from all subagents
    return this.combineSubagentResults(results);
  }

  /**
   * Create tools for subagents
   */
  private static async createSubagentTools(
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

  /**
   * Combine results from all subagents
   */
  private static combineSubagentResults(
    results: Array<{ task: string; result: AgentResult }>
  ): CopilotResult {
    const allToolCalls: any[] = [];
    const allTurns: any[] = [];
    const allResponses: string[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let maxDuration = 0;
    
    // Extract changes from all subagents
    const allChanges: Array<{
      file: string;
      changeType: 'create' | 'modify' | 'delete' | 'refactor';
      description?: string;
    }> = [];
    
    for (const { task, result } of results) {
      logInfo(`   📊 Subagent "${task}": ${result.turns.length} turns, ${result.toolCalls.length} tool calls`);
      
      if (result.finalResponse) {
        allResponses.push(result.finalResponse);
      }
      
      allToolCalls.push(...result.toolCalls);
      allTurns.push(...result.turns);
      
      // Extract changes from this subagent
      for (const toolCall of result.toolCalls) {
        if (toolCall.toolName === 'propose_change' && toolCall.result) {
          try {
            const changeData = typeof toolCall.result === 'string' 
              ? JSON.parse(toolCall.result) 
              : toolCall.result;
            
            if (changeData && changeData.file_path) {
              allChanges.push({
                file: changeData.file_path,
                changeType: changeData.change_type || 'modify',
                description: changeData.description
              });
            }
          } catch (error) {
            // Ignore parsing errors
          }
        }
      }
      
      if (result.metrics) {
        totalInputTokens += result.metrics.totalTokens.input;
        totalOutputTokens += result.metrics.totalTokens.output;
        maxDuration = Math.max(maxDuration, result.metrics.totalDuration);
      }
    }
    
    // Combine responses
    const combinedResponse = allResponses.length > 0
      ? allResponses.join('\n\n---\n\n')
      : 'Analysis completed by multiple subagents.';
    
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
      finalResponse: combinedResponse,
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
    
    logInfo(`✅ Combined results from ${results.length} subagents`);
    logInfo(`   - Total Changes: ${allChanges.length}`);
    logInfo(`   - Total Tokens: ${totalInputTokens + totalOutputTokens} (${totalInputTokens} in, ${totalOutputTokens} out)`);
    logInfo(`   - Duration: ${maxDuration}ms (parallel execution)`);
    
    return {
      response: combinedResponse,
      agentResult: combinedResult,
      changes: allChanges.length > 0 ? allChanges : undefined
    };
  }
}


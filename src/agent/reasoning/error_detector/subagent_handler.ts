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
import { ReportErrorsTool } from '../../tools/builtin_tools/report_errors_tool';
import { logInfo, logWarn } from '../../../utils/logger';
import { FilePartitioner } from './file_partitioner';
import { ErrorParser } from './error_parser';
import { SummaryGenerator } from './summary_generator';
import { SystemPromptBuilder } from './system_prompt_builder';
import { AgentInitializer } from './agent_initializer';
import { FileRelationshipAnalyzer } from './file_relationship_analyzer';

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
    let allFiles = Array.from(repositoryFiles.keys());
    
    // If targetFile is specified, analyze it (and optionally its consumers)
    if (options.targetFile) {
      if (options.analyzeOnlyTargetFile) {
        // Analyze only the target file, ignore relationships
        if (repositoryFiles.has(options.targetFile)) {
          allFiles = [options.targetFile];
          logInfo(`🎯 Single file analysis: ${options.targetFile}`);
        } else {
          logWarn(`⚠️ Target file not found: ${options.targetFile}, falling back to full analysis`);
        }
      } else {
        // Analyze target file and its consumers
        const relationshipAnalyzer = new FileRelationshipAnalyzer();
        const relationships = relationshipAnalyzer.analyzeFileRelationships(
          options.targetFile,
          repositoryFiles,
          options.includeDependencies || false
        );
        
        if (relationships) {
          allFiles = relationships.allRelatedFiles;
          logInfo(`🎯 Focused analysis: ${relationships.allRelatedFiles.length} files (target + ${relationships.consumers.length} consumers${options.includeDependencies ? ` + ${relationships.dependencies.length} dependencies` : ''})`);
        } else {
          logWarn(`⚠️ Could not analyze relationships for ${options.targetFile}, falling back to full analysis`);
        }
      }
    }
    
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
    
    logInfo(`📁 Created ${fileGroups.length} file groups for parallel analysis`);
    
    // Create tools for subagents (all files available through tools)
    const tools = await this.createSubagentTools(repositoryFiles);
    
    // Create tasks for each subagent
    const systemPrompt = SystemPromptBuilder.build(options);
    
    // If targetFile is specified, get relationship info for context
    let relationshipContext = '';
    if (options.targetFile) {
      if (options.analyzeOnlyTargetFile) {
        // Single file analysis mode
        relationshipContext = `\n\n**SINGLE FILE ANALYSIS MODE**\n` +
          `Target file: ${options.targetFile}\n` +
          `**IMPORTANT: Analyze ONLY this file. Do NOT analyze any related files (consumers, dependencies, etc.).**\n` +
          `Detect ALL types of errors: bugs, vulnerabilities, security issues, logic errors, performance problems, configuration errors, etc.\n` +
          `Focus on issues within this single file only.\n`;
      } else {
        // Focused analysis mode with relationships
        const relationshipAnalyzer = new FileRelationshipAnalyzer();
        const relationships = relationshipAnalyzer.analyzeFileRelationships(
          options.targetFile,
          repositoryFiles,
          options.includeDependencies || false
        );
        
        if (relationships) {
          relationshipContext = `\n\n**FOCUSED ANALYSIS MODE**\n` +
            `Target file: ${relationships.targetFile}\n` +
            `This file is consumed by ${relationships.consumers.length} other file(s).\n` +
            `**IMPORTANT: You must detect ALL types of errors in ALL files (target + consumers), not just relationship issues.**\n` +
            `Detect bugs, vulnerabilities, security issues, logic errors, performance problems, configuration errors, etc. - everything you would detect in full analysis mode.\n` +
            `Additionally, also check:\n` +
            `- Interface/API mismatches between the target file and its consumers\n` +
            `- Breaking changes in APIs, exports, or interfaces\n` +
            `- How consumers use the target file (check for misuse patterns)\n` +
            `- Impact analysis: if the target file has a bug/vulnerability, which consumers would be affected?\n` +
            `**But do NOT limit yourself to these - detect ALL types of errors in ALL files.**\n`;
        }
      }
    }
    
    const tasks: Task[] = fileGroups.map((files, index) => {
      const totalFiles = files.length;
      // Show first N files in prompt, rest available through tools
      const filesToShow = files.slice(0, MAX_FILES_IN_PROMPT);
      const remainingFiles = totalFiles - filesToShow.length;
      
      let fileListSection = '';
      if (filesToShow.length > 0) {
        fileListSection = `\n\nFiles assigned to you (${totalFiles} total):\n${filesToShow.map(f => `- ${f}`).join('\n')}`;
        if (remainingFiles > 0) {
          fileListSection += `\n\n... and ${remainingFiles} more file(s). Use search_files or read_file directly to access all files.`;
        }
      }
      
      return {
        name: `error-detector-${index + 1}`,
        prompt: userPrompt 
          ? `${userPrompt}${relationshipContext}\n\nYou have been assigned ${totalFiles} files to analyze. You MUST read and analyze ALL ${totalFiles} of these files using read_file.${fileListSection}\n\n**CRITICAL: Read EVERY SINGLE FILE assigned to you (${totalFiles} files total). Use read_file on each file. Do not skip any files. Analyze each file thoroughly for errors.**`
          : `${relationshipContext}\n\nYou have been assigned ${totalFiles} files to analyze. You MUST read and analyze ALL ${totalFiles} of these files for errors using read_file.${fileListSection}\n\n**CRITICAL: Read EVERY SINGLE FILE assigned to you (${totalFiles} files total). Use read_file on each file. Do not skip any files. Analyze each file thoroughly for errors.**`,
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
        if (change.change_type === 'create' || change.change_type === 'modify' || change.change_type === 'refactor') {
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

    // Report errors tool for structured error reporting
    const reportErrorsTool = new ReportErrorsTool({
      onErrorsReported: (errors) => {
        // Errors will be captured via tool calls in the parser
      }
    });

    return [readFileTool, searchFilesTool, proposeChangeTool, manageTodosTool, reportErrorsTool];
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


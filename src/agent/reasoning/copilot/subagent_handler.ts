/**
 * Subagent Handler
 * Handles Copilot tasks using subagents for parallel processing
 */

import { Agent } from '../../core/agent';
import { AgentResult } from '../../types';
import { Task } from '../../core/subagent_manager';
import { CopilotOptions, CopilotResult, ChangePlan } from './types';
import { ChangeType, TodoStatus } from '../../../data/model/think_response';
import { ReadFileTool } from '../../tools/builtin_tools/read_file_tool';
import { SearchFilesTool } from '../../tools/builtin_tools/search_files_tool';
import { ProposeChangeTool } from '../../tools/builtin_tools/propose_change_tool';
import { ApplyChangesTool } from '../../tools/builtin_tools/apply_changes_tool';
import { ExecuteCommandTool } from '../../tools/builtin_tools/execute_command_tool';
import { ManageTodosTool } from '../../tools/builtin_tools/manage_todos_tool';
import { logInfo, logWarn, logError } from '../../../utils/logger';
import { FilePartitioner } from './file_partitioner';
import { SystemPromptBuilder } from './system_prompt_builder';
import { AgentInitializer } from './agent_initializer';
import * as fs from 'fs';
import * as path from 'path';

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
   * 
   * Uses a two-phase approach:
   * Phase 1: Subagents work in parallel (READ-ONLY) - analyze and propose changes
   * Phase 2: Coordinator agent executes changes sequentially
   */
  static async processPromptWithSubAgents(
    agent: Agent,
    repositoryFiles: Map<string, string>,
    options: CopilotOptions,
    userPrompt: string,
    shouldApplyChanges?: boolean
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
    
    // ============================================
    // PHASE 1: PARALLEL ANALYSIS (READ-ONLY)
    // ============================================
    logInfo(`\n📖 PHASE 1: Parallel analysis (read-only mode)`);
    
    // Create READ-ONLY tools for subagents (no propose_change, no apply_changes, no execute_command)
    const readOnlyTools = await this.createReadOnlySubagentTools(repositoryFiles, options);
    
    // Create tasks for each subagent (read-only phase)
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
      
      // Instructions for read-only phase
      const readOnlyInstruction = `\n\n**PHASE 1 - READ-ONLY ANALYSIS MODE**:
You are in READ-ONLY mode. Your task is to:
1. Read and analyze files using read_file and search_files
2. Understand the context and requirements
3. Propose changes using propose_change (changes will be stored in memory, NOT written to disk)
4. **DO NOT** call apply_changes or execute_command - these are disabled in this phase
5. Focus on understanding what needs to be changed and propose those changes

After you propose changes, a coordinator agent will execute them sequentially to avoid conflicts.`;
      
      return {
        name: `copilot-${index + 1}`,
        prompt: `${userPrompt}${fileListSection}${readOnlyInstruction}\n\n**Note:** You are one of ${fileGroups.length} subagents working in parallel. Focus on your assigned files, but you can access all repository files through the tools if needed.`,
        systemPrompt,
        tools: readOnlyTools
      };
    });
    
    logInfo(`🚀 Executing ${tasks.length} subagents in parallel (read-only)...`);
    const analysisResults = await agent.executeParallel(tasks);
    
    logInfo(`✅ All ${analysisResults.length} subagents completed analysis`);
    
    // Extract change plans from subagent results
    const changePlans = this.extractChangePlans(analysisResults);
    logInfo(`📋 Extracted ${changePlans.length} change plan(s) from subagents`);
    
    // ============================================
    // PHASE 2: SEQUENTIAL EXECUTION (COORDINATOR)
    // ============================================
    if (changePlans.length === 0) {
      logInfo(`\n📝 PHASE 2: No changes to execute, skipping coordinator phase`);
      // Combine analysis results only
      return this.combineSubagentResults(analysisResults);
    }
    
    logInfo(`\n✏️  PHASE 2: Sequential execution (coordinator)`);
    const coordinatorResult = await this.executeChangesSequentially(
      agent,
      repositoryFiles,
      options,
      userPrompt,
      changePlans,
      shouldApplyChanges
    );
    
    // Combine results from both phases
    return this.combinePhasesResults(analysisResults, coordinatorResult);
  }

  /**
   * Create READ-ONLY tools for subagents (Phase 1)
   * Only allows reading files, searching, and proposing changes (in memory)
   * Does NOT allow applying changes or executing commands
   */
  private static async createReadOnlySubagentTools(
    repositoryFiles: Map<string, string>,
    options: CopilotOptions
  ) {
    const virtualCodebase = new Map<string, string>(repositoryFiles);
    const workingDir = options.workingDirectory || process.cwd();
    
    const readFileTool = new ReadFileTool({
      getFileContent: (filePath: string) => {
        // First check virtual codebase
        if (virtualCodebase.has(filePath)) {
          return virtualCodebase.get(filePath);
        }
        
        // Then check if file exists on disk (for working directory files)
        const normalizedWorkingDir = path.resolve(workingDir);
        let normalizedFilePath: string;
        if (path.isAbsolute(filePath)) {
          normalizedFilePath = path.resolve(filePath);
        } else {
          normalizedFilePath = path.resolve(normalizedWorkingDir, filePath);
        }
        
        const isInWorkingDir = normalizedFilePath.startsWith(normalizedWorkingDir + path.sep) || 
                                normalizedFilePath === normalizedWorkingDir;
        if (isInWorkingDir && fs.existsSync(normalizedFilePath)) {
          try {
            return fs.readFileSync(normalizedFilePath, 'utf8');
          } catch (error) {
            // Ignore read errors
          }
        }
        
        // Finally check repository files
        return repositoryFiles.get(filePath);
      },
      repositoryFiles: virtualCodebase
    });

    const searchFilesTool = new SearchFilesTool({
      searchFiles: (query: string) => {
        return this.searchFiles(repositoryFiles, query);
      },
      getAllFiles: (): string[] => {
        return this.getAllFiles(repositoryFiles);
      }
    });
    
    // Propose change tool - ONLY updates virtual codebase (memory), NO auto-apply
    const proposeChangeTool = new ProposeChangeTool({
      applyChange: (change) => {
        try {
          if (change.change_type === 'create' || change.change_type === 'modify' || change.change_type === 'refactor') {
            virtualCodebase.set(change.file_path, change.suggested_code);
            logInfo(`📝 Proposed change (memory only): ${change.file_path} (${change.description || 'no description'})`);
            return true;
          } else if (change.change_type === 'delete') {
            virtualCodebase.delete(change.file_path);
            logInfo(`📝 Proposed deletion (memory only): ${change.file_path}`);
            return true;
          }
        } catch (error: any) {
          logError(`❌ Error proposing change to ${change.file_path}: ${error.message}`);
          return false;
        }
        return false;
      },
      onChangeApplied: (change: any) => {
        logInfo(`✅ Change proposed (memory only): ${change.file_path}`);
      },
      getUserPrompt: () => options.userPrompt,
      getShouldApplyChanges: () => false, // Always false in read-only phase
      // Disable auto-apply in read-only phase
      autoApplyToDisk: async () => {
        logWarn(`⚠️  Auto-apply disabled in read-only phase`);
        return false;
      }
    });

    // Initialize TODO manager for tracking tasks
    const manageTodosTool = await this.createManageTodosTool();
    
    // Return only read-only tools (NO apply_changes, NO execute_command)
    return [readFileTool, searchFilesTool, proposeChangeTool, manageTodosTool];
  }

  /**
   * Extract change plans from subagent results
   */
  private static extractChangePlans(
    results: Array<{ task: string; result: AgentResult }>
  ): ChangePlan[] {
    const changePlans: ChangePlan[] = [];
    
    for (const { task, result } of results) {
      // Create a map of toolCallId -> toolResult for quick lookup
      const toolResultMap = new Map<string, any>();
      for (const turn of result.turns) {
        if (turn.toolResults) {
          for (const toolResult of turn.toolResults) {
            toolResultMap.set(toolResult.toolCallId, toolResult);
          }
        }
      }

      // Look for propose_change tool calls
      for (const toolCall of result.toolCalls) {
        if (toolCall.name === 'propose_change') {
          const toolResult = toolResultMap.get(toolCall.id);
          if (toolResult && !toolResult.isError) {
            try {
              const changeData = toolCall.input;
              if (changeData && changeData.file_path) {
                changePlans.push({
                  file: changeData.file_path,
                  changeType: changeData.change_type || 'modify',
                  description: changeData.description || 'no description',
                  suggestedCode: changeData.suggested_code || '',
                  reasoning: changeData.reasoning || '',
                  proposedBy: task
                });
              }
            } catch (error) {
              logWarn(`⚠️  Error extracting change plan from ${task}: ${error}`);
            }
          }
        }
      }
    }
    
    return changePlans;
  }

  /**
   * Execute changes sequentially using coordinator agent (Phase 2)
   */
  private static async executeChangesSequentially(
    agent: Agent,
    repositoryFiles: Map<string, string>,
    options: CopilotOptions,
    userPrompt: string,
    changePlans: ChangePlan[],
    shouldApplyChanges?: boolean
  ): Promise<AgentResult> {
    // Initialize coordinator agent with full tools
    const optionsWithPrompt = { ...options, userPrompt, shouldApplyChanges };
    const { agent: coordinatorAgent } = await AgentInitializer.initialize(optionsWithPrompt);
    
    // Build prompt for coordinator with all change plans
    const changePlansSummary = changePlans.map((plan, index) => 
      `${index + 1}. ${plan.file} (${plan.changeType}) - ${plan.description} [proposed by ${plan.proposedBy}]`
    ).join('\n');
    
    const coordinatorPrompt = `You are the coordinator agent. Your task is to execute the following changes sequentially:

**Change Plans to Execute (${changePlans.length} total):**
${changePlansSummary}

**Instructions:**
1. Execute changes ONE BY ONE in the order listed above
2. For each change:
   - Call propose_change with the file_path, change_type, description, suggested_code, and reasoning
   - Then IMMEDIATELY call apply_changes to write to disk
   - Verify the change was applied correctly
3. After all changes are applied, you may run tests or commands to verify everything works
4. Report any errors or issues you encounter

**Original User Request:**
${userPrompt}

**Important:** Execute changes sequentially to avoid conflicts. Do not skip any changes.`;

    logInfo(`🎯 Coordinator executing ${changePlans.length} change(s) sequentially...`);
    const result = await coordinatorAgent.query(coordinatorPrompt);
    
    logInfo(`✅ Coordinator completed execution`);
    return result;
  }

  /**
   * Combine results from both phases
   */
  private static combinePhasesResults(
    analysisResults: Array<{ task: string; result: AgentResult }>,
    coordinatorResult: AgentResult
  ): CopilotResult {
    // Combine all tool calls and turns
    const allToolCalls: any[] = [];
    const allTurns: any[] = [];
    const allResponses: string[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let maxDuration = 0;
    
    // Add analysis phase results
    for (const { result } of analysisResults) {
      if (result.finalResponse) {
        allResponses.push(`[Analysis Phase] ${result.finalResponse}`);
      }
      allToolCalls.push(...result.toolCalls);
      allTurns.push(...result.turns);
      
      if (result.metrics) {
        totalInputTokens += result.metrics.totalTokens.input;
        totalOutputTokens += result.metrics.totalTokens.output;
        maxDuration = Math.max(maxDuration, result.metrics.totalDuration);
      }
    }
    
    // Add coordinator phase results
    if (coordinatorResult.finalResponse) {
      allResponses.push(`[Execution Phase] ${coordinatorResult.finalResponse}`);
    }
    allToolCalls.push(...coordinatorResult.toolCalls);
    allTurns.push(...coordinatorResult.turns);
    
    if (coordinatorResult.metrics) {
      totalInputTokens += coordinatorResult.metrics.totalTokens.input;
      totalOutputTokens += coordinatorResult.metrics.totalTokens.output;
      maxDuration = Math.max(maxDuration, coordinatorResult.metrics.totalDuration);
    }
    
    // Extract changes from coordinator result (these are the actual applied changes)
    const changes = this.extractChangesFromResult(coordinatorResult);
    
    // Combine responses
    const combinedResponse = allResponses.length > 0
      ? allResponses.join('\n\n---\n\n')
      : 'Analysis and execution completed.';
    
    // Create combined agent result
    const combinedResult: AgentResult = {
      finalResponse: combinedResponse,
      turns: allTurns,
      toolCalls: allToolCalls,
      messages: [...analysisResults.flatMap(r => r.result.messages), ...coordinatorResult.messages],
      metrics: {
        totalTokens: {
          input: totalInputTokens,
          output: totalOutputTokens
        },
        totalDuration: maxDuration,
        apiCalls: analysisResults.reduce((sum, r) => sum + (r.result.metrics?.apiCalls || 0), 0) + (coordinatorResult.metrics?.apiCalls || 0),
        toolCalls: allToolCalls.length,
        errors: analysisResults.reduce((sum, r) => sum + (r.result.metrics?.errors || 0), 0) + (coordinatorResult.metrics?.errors || 0),
        averageLatency: maxDuration / (allToolCalls.length || 1)
      }
    };
    
    return {
      response: combinedResponse,
      agentResult: combinedResult,
      changes: changes.length > 0 ? changes : undefined
    };
  }

  /**
   * Extract changes from agent result
   */
  private static extractChangesFromResult(result: AgentResult): Array<{
    file: string;
    changeType: ChangeType;
    description?: string;
  }> {
    const changes: Array<{
      file: string;
      changeType: ChangeType;
      description?: string;
    }> = [];

    // Create a map of toolCallId -> toolResult for quick lookup
    const toolResultMap = new Map<string, any>();
    for (const turn of result.turns) {
      if (turn.toolResults) {
        for (const toolResult of turn.toolResults) {
          toolResultMap.set(toolResult.toolCallId, toolResult);
        }
      }
    }

    // Look for apply_changes tool calls (these are the ones actually written to disk)
    for (const toolCall of result.toolCalls) {
      if (toolCall.name === 'apply_changes') {
        const toolResult = toolResultMap.get(toolCall.id);
        if (toolResult && !toolResult.isError) {
          try {
            const resultContent = toolResult.content || '';
            const lines = resultContent.split('\n');
            for (const line of lines) {
              const match = line.match(/^\s*-\s*(.+?)\s*\((\w+)\)/);
              if (match) {
                const changeType = match[2] as ChangeType;
                if (Object.values(ChangeType).includes(changeType)) {
                  changes.push({
                    file: match[1].trim(),
                    changeType,
                    description: `Applied ${match[2]}`
                  });
                }
              }
            }
          } catch (error) {
            // Ignore parsing errors
          }
        }
      } else if (toolCall.name === 'propose_change') {
        // Also track proposed changes
        const toolResult = toolResultMap.get(toolCall.id);
        if (toolResult && !toolResult.isError) {
          try {
            const changeData = toolCall.input;
            if (changeData && changeData.file_path) {
              changes.push({
                file: changeData.file_path,
                changeType: changeData.change_type || 'modify',
                description: `Proposed: ${changeData.description || 'no description'}`
              });
            }
          } catch (error) {
            // Ignore parsing errors
          }
        }
      }
    }

    return changes;
  }

  /**
   * Create tools for subagents (DEPRECATED - kept for backward compatibility)
   * @deprecated Use createReadOnlySubagentTools for Phase 1 instead
   */
  private static async createSubagentTools(
    repositoryFiles: Map<string, string>,
    options: CopilotOptions
  ) {
    // Virtual codebase for proposed changes (must be declared first)
    const virtualCodebase = new Map<string, string>(repositoryFiles);
    const workingDir = options.workingDirectory || process.cwd();
    
    const readFileTool = new ReadFileTool({
      getFileContent: (filePath: string) => {
        // First check virtual codebase
        if (virtualCodebase.has(filePath)) {
          return virtualCodebase.get(filePath);
        }
        
        // Then check if file exists on disk (for working directory files)
        // Normalize working directory first
        const normalizedWorkingDir = path.resolve(workingDir);
        
        // Resolve file path relative to working directory if it's a relative path
        // If filePath is already absolute, use it as-is; otherwise resolve from working directory
        let normalizedFilePath: string;
        if (path.isAbsolute(filePath)) {
          normalizedFilePath = path.resolve(filePath);
        } else {
          // Resolve relative path from working directory
          normalizedFilePath = path.resolve(normalizedWorkingDir, filePath);
        }
        
        // Check if file is within working directory and exists
        const isInWorkingDir = normalizedFilePath.startsWith(normalizedWorkingDir + path.sep) || 
                                normalizedFilePath === normalizedWorkingDir;
        if (isInWorkingDir && fs.existsSync(normalizedFilePath)) {
          try {
            return fs.readFileSync(normalizedFilePath, 'utf8');
          } catch (error) {
            // Ignore read errors
          }
        }
        
        // Finally check repository files
        return repositoryFiles.get(filePath);
      },
      repositoryFiles: virtualCodebase
    });

    const searchFilesTool = new SearchFilesTool({
      searchFiles: (query: string) => {
        return this.searchFiles(repositoryFiles, query);
      },
      getAllFiles: (): string[] => {
        return this.getAllFiles(repositoryFiles);
      }
    });
    
    // Propose change tool - only updates virtual codebase (memory)
    const proposeChangeTool = new ProposeChangeTool({
      applyChange: (change) => {
        try {
          if (change.change_type === 'create' || change.change_type === 'modify' || change.change_type === 'refactor') {
            // Only update virtual codebase (memory)
            virtualCodebase.set(change.file_path, change.suggested_code);
            logInfo(`📝 Proposed change (virtual): ${change.file_path} (${change.description || 'no description'})`);
            return true;
          } else if (change.change_type === 'delete') {
            // Only update virtual codebase (memory)
            virtualCodebase.delete(change.file_path);
            logInfo(`📝 Proposed deletion (virtual): ${change.file_path}`);
            return true;
          }
        } catch (error: any) {
          logError(`❌ Error proposing change to ${change.file_path}: ${error.message}`);
          return false;
        }
        
        return false;
      },
      onChangeApplied: (change: any) => {
        logInfo(`✅ Change proposed (virtual): ${change.file_path}`);
      },
      // Get user prompt for auto-detection (fallback if intent classifier not used)
      getUserPrompt: () => options.userPrompt,
      // Get pre-classified intent (from intent classifier)
      getShouldApplyChanges: () => options.shouldApplyChanges,
      // Auto-apply to disk when auto_apply=true is used
      autoApplyToDisk: async (filePath: string, operation?: ChangeType) => {
        try {
          // Normalize working directory first
          const normalizedWorkingDir = path.resolve(workingDir);
          
          // Resolve file path relative to working directory if it's a relative path
          // If filePath is already absolute, use it as-is; otherwise resolve from working directory
          let normalizedFilePath: string;
          if (path.isAbsolute(filePath)) {
            normalizedFilePath = path.resolve(filePath);
          } else {
            // Resolve relative path from working directory
            normalizedFilePath = path.resolve(normalizedWorkingDir, filePath);
          }
          
          // Check if file is within working directory
          const isInWorkingDir = normalizedFilePath.startsWith(normalizedWorkingDir + path.sep) || 
                                  normalizedFilePath === normalizedWorkingDir;
          if (!isInWorkingDir) {
            logWarn(`⚠️  Cannot auto-apply ${filePath} - outside working directory (${workingDir})`);
            return false;
          }

          // Handle delete operation
          if (operation === 'delete') {
            if (fs.existsSync(normalizedFilePath)) {
              fs.unlinkSync(normalizedFilePath);
              logInfo(`🗑️  Auto-deleted from disk: ${normalizedFilePath}`);
              return true;
            } else {
              logWarn(`⚠️  Cannot auto-delete ${filePath} - file does not exist on disk`);
              return false;
            }
          }

          // Handle create/modify/refactor operations
          const content = virtualCodebase.get(filePath);
          if (!content) {
            logWarn(`⚠️  Cannot auto-apply ${filePath} - not found in virtual codebase`);
            return false;
          }

          const fullPath = normalizedFilePath;
          const dir = path.dirname(fullPath);

          // Ensure directory exists
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            logInfo(`📁 Created directory: ${dir}`);
          }

          // Write file
          fs.writeFileSync(fullPath, content, 'utf8');
          logInfo(`💾 Auto-applied to disk: ${fullPath}`);
          return true;
        } catch (error: any) {
          logError(`❌ Error auto-applying ${filePath}: ${error.message}`);
          return false;
        }
      }
    });

    // Apply changes tool - writes virtual codebase to disk
    const applyChangesTool = new ApplyChangesTool({
      getVirtualCodebase: () => virtualCodebase,
      getWorkingDirectory: () => workingDir,
      onChangesApplied: (changes) => {
        logInfo(`✅ Applied ${changes.length} change(s) to disk`);
      }
    });

    // Execute command tool - runs shell commands
    const executeCommandTool = new ExecuteCommandTool({
      getWorkingDirectory: () => workingDir,
      autoCd: true, // Automatically prepend cd to working directory
      onCommandExecuted: (command, success, output) => {
        if (success) {
          logInfo(`✅ Command executed successfully: ${command.substring(0, 50)}...`);
        } else {
          logWarn(`⚠️  Command may have failed: ${command.substring(0, 50)}...`);
        }
      }
    });

    // Initialize TODO manager for tracking tasks
    const manageTodosTool = await this.createManageTodosTool();
    
    return [readFileTool, searchFilesTool, proposeChangeTool, applyChangesTool, executeCommandTool, manageTodosTool];
  }

  /**
   * Create ManageTodosTool
   */
  private static async createManageTodosTool(): Promise<ManageTodosTool> {
    const { ThinkTodoManager } = await import('../../../usecase/steps/common/think_todo_manager');
    const todoManager = new ThinkTodoManager();
    
    return new ManageTodosTool({
      createTodo: (content: string, status?: TodoStatus) => {
        const todoStatus = status && (status === TodoStatus.PENDING || status === TodoStatus.IN_PROGRESS) 
          ? status 
          : TodoStatus.PENDING;
        const todo = todoManager.createTodo(content, todoStatus);
        return {
          id: todo.id,
          content: todo.content,
          status: todo.status
        };
      },
      updateTodo: (id: string, updates: {
        status?: TodoStatus;
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
          .filter((todo: any) => todo.status !== TodoStatus.COMPLETED && todo.status !== TodoStatus.CANCELLED)
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
      changeType: ChangeType;
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
      // Create a map of toolCallId -> toolResult for quick lookup
      const toolResultMap = new Map<string, any>();
      for (const turn of result.turns) {
        if (turn.toolResults) {
          for (const toolResult of turn.toolResults) {
            toolResultMap.set(toolResult.toolCallId, toolResult);
          }
        }
      }

      // Look for apply_changes and propose_change tool calls
      for (const toolCall of result.toolCalls) {
        if (toolCall.name === 'apply_changes') {
          const toolResult = toolResultMap.get(toolCall.id);
          if (toolResult && !toolResult.isError) {
            try {
              // Extract applied changes from the result
              const resultContent = toolResult.content || '';
              const lines = resultContent.split('\n');
              for (const line of lines) {
                const match = line.match(/^\s*-\s*(.+?)\s*\((\w+)\)/);
                if (match) {
                  const changeType = match[2] as ChangeType;
                  if (Object.values(ChangeType).includes(changeType)) {
                    allChanges.push({
                      file: match[1].trim(),
                      changeType,
                      description: `Applied ${match[2]}`
                    });
                  }
                }
              }
            } catch (error) {
              // Ignore parsing errors
            }
          }
        } else if (toolCall.name === 'propose_change') {
          // Also track proposed changes
          const toolResult = toolResultMap.get(toolCall.id);
          if (toolResult && !toolResult.isError) {
            try {
              const changeData = toolCall.input;
              if (changeData && changeData.file_path) {
                allChanges.push({
                  file: changeData.file_path,
                  changeType: changeData.change_type || 'modify',
                  description: `Proposed: ${changeData.description || 'no description'}`
                });
              }
            } catch (error) {
              // Ignore parsing errors
            }
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


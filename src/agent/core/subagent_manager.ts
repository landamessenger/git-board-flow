/**
 * SubAgent Manager
 * Manages subagents and their coordination
 */

import { Agent } from './agent';
import { AgentOptions, AgentResult } from '../types';
import { ContextSharing } from './context_sharing';
import { Message } from '../types';
import { logInfo, logError, logDebugInfo } from '../../utils/logger';

export interface SubAgentOptions {
  name: string;
  systemPrompt?: string;
  tools?: any[]; // BaseTool[]
  inheritTools?: boolean; // Inherit tools from parent agent
  inheritContext?: boolean; // Inherit context from parent agent
  maxTurns?: number;
  maxTokens?: number;
  temperature?: number;
}

export interface Task {
  name: string;
  prompt: string;
  systemPrompt?: string;
  tools?: any[];
  options?: Partial<AgentOptions>;
}

export class SubAgentManager {
  private subAgents: Map<string, Agent> = new Map();
  private parentAgent: Agent;
  private sharedContext: Message[] = [];

  constructor(parentAgent: Agent) {
    this.parentAgent = parentAgent;
  }

  /**
   * Create a subagent
   */
  createSubAgent(options: SubAgentOptions): Agent {
    if (this.subAgents.has(options.name)) {
      logInfo(`SubAgent ${options.name} already exists, returning existing`);
      return this.subAgents.get(options.name)!;
    }

    logInfo(`🤖 Creating subagent: ${options.name}`);

    // Get parent options (access private property)
    // In TypeScript, private properties are accessible at runtime
    const parentOptions = (this.parentAgent as any).options as AgentOptions | undefined;
    
    if (!parentOptions) {
      // Fallback: create minimal options from agent's public methods
      // This shouldn't happen in practice, but helps with testing
      const fallbackOptions: AgentOptions = {
        model: 'unknown',
        serverUrl: 'http://localhost:4096',
        enableMCP: false
      };
      return this.createSubAgentWithOptions(options, fallbackOptions);
    }
    
    return this.createSubAgentWithOptions(options, parentOptions);
  }

  /**
   * Internal method to create subagent with options
   */
  private createSubAgentWithOptions(options: SubAgentOptions, parentOptions: AgentOptions): Agent {

    // Build subagent options
    const subAgentOptions: AgentOptions = {
      ...parentOptions,
      systemPrompt: options.systemPrompt || parentOptions.systemPrompt,
      maxTurns: options.maxTurns || parentOptions.maxTurns || 10,
      maxTokens: options.maxTokens || parentOptions.maxTokens,
      temperature: options.temperature || parentOptions.temperature,
      tools: [],
      enableMCP: false // Subagents don't initialize MCP by default
    };

    // Inherit tools if requested
    if (options.inheritTools !== false) {
      const parentTools = this.parentAgent.getAvailableTools();
      // Note: We can't directly get tool instances, so we'll need to pass them
      // For now, we'll rely on tools being passed explicitly
    }

    // Add explicit tools
    if (options.tools && options.tools.length > 0) {
      subAgentOptions.tools = options.tools;
    }

    // Create subagent
    const subAgent = new Agent(subAgentOptions);

    // Share context if requested
    if (options.inheritContext !== false) {
      const parentMessages = this.parentAgent.getMessages();
      ContextSharing.shareContext(
        parentMessages,
        subAgent['messageManager'],
        {
          includeSystem: true,
          maxMessages: 5 // Share recent context
        }
      );
    }

    this.subAgents.set(options.name, subAgent);
    return subAgent;
  }

  /**
   * Execute multiple agents in parallel
   */
  async executeParallel(
    tasks: Task[]
  ): Promise<Array<{ task: string; result: AgentResult }>> {
    logInfo(`🚀 Executing ${tasks.length} tasks in parallel`);

    // Create or get subagents for each task
    const agents: Array<{ agent: Agent; task: Task }> = [];
    
    for (const task of tasks) {
      let agent = this.subAgents.get(task.name);
      
      if (!agent) {
        // Create subagent for this task
        agent = this.createSubAgent({
          name: task.name,
          systemPrompt: task.systemPrompt,
          tools: task.tools,
          inheritContext: true
        });
      }

      agents.push({ agent, task });
    }

    // Execute all agents in parallel
    const promises = agents.map(async ({ agent, task }) => {
      try {
        logDebugInfo(`▶️ Executing task: ${task.name}`);
        const result = await agent.query(task.prompt);
        logDebugInfo(`✅ Completed task: ${task.name}`);
        return { task: task.name, result };
      } catch (error) {
        logError(`❌ Task ${task.name} failed: ${error}`);
        throw error;
      }
    });

    const results = await Promise.all(promises);
    logInfo(`✅ All ${results.length} tasks completed`);

    return results;
  }

  /**
   * Coordinate agents - execute with dependency management
   */
  async coordinateAgents(
    tasks: Array<Task & { dependsOn?: string[] }>
  ): Promise<Array<{ task: string; result: AgentResult }>> {
    logInfo(`🎯 Coordinating ${tasks.length} tasks with dependencies`);

    const results: Array<{ task: string; result: AgentResult }> = [];
    const completed = new Set<string>();

    // Build dependency graph
    const taskMap = new Map<string, Task & { dependsOn?: string[] }>();
    for (const task of tasks) {
      taskMap.set(task.name, task);
    }

    // Execute tasks respecting dependencies
    while (completed.size < tasks.length) {
      const readyTasks = tasks.filter(task => {
        if (completed.has(task.name)) return false;
        if (!task.dependsOn || task.dependsOn.length === 0) return true;
        return task.dependsOn.every(dep => completed.has(dep));
      });

      if (readyTasks.length === 0) {
        throw new Error('Circular dependency or missing dependency detected');
      }

      // Execute ready tasks in parallel
      const promises = readyTasks.map(async (task) => {
        let agent = this.subAgents.get(task.name);
        
        if (!agent) {
          agent = this.createSubAgent({
            name: task.name,
            systemPrompt: task.systemPrompt,
            tools: task.tools,
            inheritContext: true
          });
        }

        try {
          const result = await agent.query(task.prompt);
          completed.add(task.name);
          return { task: task.name, result };
        } catch (error) {
          logError(`Task ${task.name} failed: ${error}`);
          throw error;
        }
      });

      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    }

    logInfo(`✅ All coordinated tasks completed`);
    return results;
  }

  /**
   * Share context between subagents
   */
  shareContext(fromAgentName: string, toAgentName: string): void {
    const fromAgent = this.subAgents.get(fromAgentName);
    const toAgent = this.subAgents.get(toAgentName);

    if (!fromAgent || !toAgent) {
      throw new Error(`Agent not found: ${fromAgentName} or ${toAgentName}`);
    }

    const fromMessages = fromAgent.getMessages();
    ContextSharing.shareContext(
      fromMessages,
      toAgent['messageManager'],
      {
        includeSystem: false,
        maxMessages: 5
      }
    );

    logDebugInfo(`📤 Shared context from ${fromAgentName} to ${toAgentName}`);
  }

  /**
   * Get subagent by name
   */
  getSubAgent(name: string): Agent | undefined {
    return this.subAgents.get(name);
  }

  /**
   * Get all subagents
   */
  getAllSubAgents(): Agent[] {
    return Array.from(this.subAgents.values());
  }

  /**
   * Get subagent names
   */
  getSubAgentNames(): string[] {
    return Array.from(this.subAgents.keys());
  }

  /**
   * Remove subagent
   */
  removeSubAgent(name: string): void {
    this.subAgents.delete(name);
    logInfo(`🗑️ Removed subagent: ${name}`);
  }

  /**
   * Clear all subagents
   */
  clear(): void {
    this.subAgents.clear();
    logInfo(`🗑️ Cleared all subagents`);
  }
}


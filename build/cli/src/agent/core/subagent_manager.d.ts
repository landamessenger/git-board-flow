/**
 * SubAgent Manager
 * Manages subagents and their coordination
 */
import { Agent } from './agent';
import { AgentOptions, AgentResult } from '../types';
export interface SubAgentOptions {
    name: string;
    systemPrompt?: string;
    tools?: any[];
    inheritTools?: boolean;
    inheritContext?: boolean;
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
export declare class SubAgentManager {
    private subAgents;
    private parentAgent;
    private sharedContext;
    constructor(parentAgent: Agent);
    /**
     * Create a subagent
     */
    createSubAgent(options: SubAgentOptions): Agent;
    /**
     * Execute multiple agents in parallel
     */
    executeParallel(tasks: Task[]): Promise<Array<{
        task: string;
        result: AgentResult;
    }>>;
    /**
     * Coordinate agents - execute with dependency management
     */
    coordinateAgents(tasks: Array<Task & {
        dependsOn?: string[];
    }>): Promise<Array<{
        task: string;
        result: AgentResult;
    }>>;
    /**
     * Share context between subagents
     */
    shareContext(fromAgentName: string, toAgentName: string): void;
    /**
     * Get subagent by name
     */
    getSubAgent(name: string): Agent | undefined;
    /**
     * Get all subagents
     */
    getAllSubAgents(): Agent[];
    /**
     * Get subagent names
     */
    getSubAgentNames(): string[];
    /**
     * Remove subagent
     */
    removeSubAgent(name: string): void;
    /**
     * Clear all subagents
     */
    clear(): void;
}

/**
 * Manage TODOs Tool
 * Manages TODO list for task tracking
 */
import { BaseTool } from '../base_tool';
export interface ManageTodosToolOptions {
    createTodo: (content: string, status?: 'pending' | 'in_progress') => {
        id: string;
        content: string;
        status: string;
    };
    updateTodo: (id: string, updates: {
        status?: string;
        notes?: string;
    }) => boolean;
    getAllTodos: () => Array<{
        id: string;
        content: string;
        status: string;
        notes?: string;
    }>;
    getActiveTodos: () => Array<{
        id: string;
        content: string;
        status: string;
    }>;
}
export declare class ManageTodosTool extends BaseTool {
    private options;
    constructor(options: ManageTodosToolOptions);
    getName(): string;
    getDescription(): string;
    getInputSchema(): {
        type: 'object';
        properties: Record<string, any>;
        required: string[];
        additionalProperties?: boolean;
    };
    execute(input: Record<string, any>): Promise<string>;
}

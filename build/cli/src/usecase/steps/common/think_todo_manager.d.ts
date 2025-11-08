import { ThinkTodoItem } from '../../../data/model/think_response';
import { ProposedChange } from '../../../data/model/think_response';
/**
 * Manages TODO list for the reasoning process
 * Similar to how the assistant tracks high-level tasks vs iterative steps
 */
export declare class ThinkTodoManager {
    private todos;
    private nextId;
    /**
     * Initialize with optional initial todos
     */
    initialize(initialTodos?: Array<{
        content: string;
        status?: 'pending' | 'in_progress';
    }>): void;
    /**
     * Create a new TODO item
     */
    createTodo(content: string, status?: 'pending' | 'in_progress'): ThinkTodoItem;
    /**
     * Update an existing TODO item
     */
    updateTodo(id: string, updates: {
        status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
        notes?: string;
        related_files?: string[];
        related_changes?: string[];
    }): boolean;
    /**
     * Get all TODOs
     */
    getAllTodos(): ThinkTodoItem[];
    /**
     * Get TODOs by status
     */
    getTodosByStatus(status: ThinkTodoItem['status']): ThinkTodoItem[];
    /**
     * Get active TODOs (pending or in_progress)
     */
    getActiveTodos(): ThinkTodoItem[];
    /**
     * Get completion statistics
     */
    getStats(): {
        total: number;
        pending: number;
        in_progress: number;
        completed: number;
        cancelled: number;
        completion_rate: number;
    };
    /**
     * Get formatted TODO list for AI context
     */
    getContextForAI(): string;
    /**
     * Link a TODO to proposed changes
     */
    linkTodoToChanges(todoId: string, changes: ProposedChange[]): void;
    /**
     * Auto-update TODO status based on progress
     * If changes are applied for a TODO, mark it as in_progress or completed
     */
    autoUpdateFromChanges(changes: ProposedChange[]): void;
    /**
     * Get summary for final report
     */
    getSummary(): string;
}

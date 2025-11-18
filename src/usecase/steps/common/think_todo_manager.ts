import { ThinkTodoItem, ThinkTodoList, TodoStatus } from '../../../data/model/think_response';
import { ProposedChange } from '../../../data/model/think_response';
import { logDebugInfo, logInfo } from '../../../utils/logger';

/**
 * Manages TODO list for the reasoning process
 * Similar to how the assistant tracks high-level tasks vs iterative steps
 */
export class ThinkTodoManager {
    private todos: Map<string, ThinkTodoItem> = new Map();
    private nextId: number = 1;

    /**
     * Initialize with optional initial todos
     */
    initialize(initialTodos?: Array<{ content: string; status?: TodoStatus }>): void {
        this.todos.clear();
        this.nextId = 1;
        
        if (initialTodos && initialTodos.length > 0) {
            for (const todo of initialTodos) {
                const status = todo.status && (todo.status === TodoStatus.PENDING || todo.status === TodoStatus.IN_PROGRESS)
                    ? todo.status
                    : TodoStatus.PENDING;
                this.createTodo(todo.content, status);
            }
            logInfo(`📋 TODO list initialized with ${initialTodos.length} tasks`);
        } else {
            logInfo(`📋 TODO list initialized (empty)`);
        }
    }

    /**
     * Create a new TODO item
     */
    createTodo(content: string, status: TodoStatus = TodoStatus.PENDING): ThinkTodoItem {
        const id = `todo_${this.nextId++}`;
        const now = Date.now();
        const todo: ThinkTodoItem = {
            id,
            content,
            status,
            created_at: now,
            updated_at: now
        };
        this.todos.set(id, todo);
        logDebugInfo(`✅ Created TODO: ${content} (${status})`);
        return todo;
    }

    /**
     * Update an existing TODO item
     */
    updateTodo(id: string, updates: {
        status?: TodoStatus;
        notes?: string;
        related_files?: string[];
        related_changes?: string[];
    }): boolean {
        const todo = this.todos.get(id);
        if (!todo) {
            logDebugInfo(`⚠️ TODO ${id} not found for update`);
            return false;
        }

        const now = Date.now();
        const oldStatus = todo.status;

        if (updates.status) {
            todo.status = updates.status;
            if (updates.status === TodoStatus.COMPLETED && !todo.completed_at) {
                todo.completed_at = now;
            }
        }

        if (updates.notes !== undefined) {
            todo.notes = updates.notes;
        }

        if (updates.related_files) {
            todo.related_files = updates.related_files;
        }

        if (updates.related_changes) {
            todo.related_changes = updates.related_changes;
        }

        todo.updated_at = now;

        if (oldStatus !== todo.status) {
            // logInfo(`📝 Updated TODO ${id}: ${oldStatus} → ${todo.status}`);
        } else {
            // logDebugInfo(`📝 Updated TODO ${id} (notes/metadata)`);
        }

        return true;
    }

    /**
     * Get all TODOs
     */
    getAllTodos(): ThinkTodoItem[] {
        return Array.from(this.todos.values()).sort((a, b) => a.created_at - b.created_at);
    }

    /**
     * Get TODOs by status
     */
    getTodosByStatus(status: ThinkTodoItem['status']): ThinkTodoItem[] {
        return this.getAllTodos().filter(todo => todo.status === status);
    }

    /**
     * Get active TODOs (pending or in_progress)
     */
    getActiveTodos(): ThinkTodoItem[] {
        return this.getAllTodos().filter(todo => 
            todo.status === TodoStatus.PENDING || todo.status === TodoStatus.IN_PROGRESS
        );
    }

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
    } {
        const all = this.getAllTodos();
        const pending = all.filter(t => t.status === TodoStatus.PENDING).length;
        const in_progress = all.filter(t => t.status === TodoStatus.IN_PROGRESS).length;
        const completed = all.filter(t => t.status === TodoStatus.COMPLETED).length;
        const cancelled = all.filter(t => t.status === TodoStatus.CANCELLED).length;
        const total = all.length;
        const completion_rate = total > 0 ? (completed / total) * 100 : 0;

        return {
            total,
            pending,
            in_progress,
            completed,
            cancelled,
            completion_rate
        };
    }

    /**
     * Get formatted TODO list for AI context
     */
    getContextForAI(): string {
        const stats = this.getStats();
        const activeTodos = this.getActiveTodos();
        const completedTodos = this.getTodosByStatus(TodoStatus.COMPLETED).slice(-5); // Last 5 completed
        const allTodos = this.getAllTodos();

        const context: string[] = [];
        
        context.push(`\n## 📋 TODO List Status`);
        context.push(`- **Total Tasks**: ${stats.total}`);
        context.push(`- **Pending**: ${stats.pending}`);
        context.push(`- **In Progress**: ${stats.in_progress}`);
        context.push(`- **Completed**: ${stats.completed} (${stats.completion_rate.toFixed(1)}%)`);
        context.push(`- **Cancelled**: ${stats.cancelled}`);

        if (allTodos.length > 0) {
            context.push(`\n### 📝 All TODO Items (with IDs for reference):`);
            allTodos.forEach((todo, idx) => {
                const statusEmoji = 
                    todo.status === 'completed' ? '✅' :
                    todo.status === 'in_progress' ? '🔄' :
                    todo.status === 'cancelled' ? '❌' : '⏳';
                context.push(`${idx + 1}. ${statusEmoji} **[ID: ${todo.id}]** ${todo.status.toUpperCase()}: ${todo.content}`);
                if (todo.related_files && todo.related_files.length > 0) {
                    context.push(`   📁 Related files: ${todo.related_files.join(', ')}`);
                }
                if (todo.notes) {
                    context.push(`   📝 Notes: ${todo.notes}`);
                }
            });
            
            context.push(`\n**⚠️ IMPORTANT**: When updating TODOs, use the EXACT ID shown above (e.g., "${allTodos[0]?.id || 'todo_1'}"). Do NOT use numeric IDs like "1" or "2".`);
        }

        if (activeTodos.length > 0) {
            context.push(`\n### 🔄 Active Tasks to Work On (${activeTodos.length}):`);
            activeTodos.forEach((todo, idx) => {
                const statusEmoji = todo.status === 'in_progress' ? '🔄' : '⏳';
                context.push(`${idx + 1}. ${statusEmoji} **[ID: ${todo.id}]** ${todo.status.toUpperCase()}: ${todo.content}`);
                if (todo.related_files && todo.related_files.length > 0) {
                    context.push(`   📁 Related files: ${todo.related_files.join(', ')}`);
                }
                if (todo.notes) {
                    context.push(`   📝 Notes: ${todo.notes}`);
                }
            });
        }

        if (completedTodos.length > 0) {
            context.push(`\n### ✅ Recently Completed (${completedTodos.length}):`);
            completedTodos.forEach((todo, idx) => {
                context.push(`${idx + 1}. ✅ **[ID: ${todo.id}]** ${todo.content}`);
            });
        }

        if (activeTodos.length === 0 && stats.total > 0) {
            context.push(`\n🎉 All tasks completed!`);
        }

        return context.join('\n');
    }

    /**
     * Link a TODO to proposed changes
     */
    linkTodoToChanges(todoId: string, changes: ProposedChange[]): void {
        const todo = this.todos.get(todoId);
        if (!todo) return;

        const changeDescriptions = changes.map(c => 
            `${c.change_type}:${c.file_path}:${c.description.substring(0, 50)}`
        );
        
        if (!todo.related_changes) {
            todo.related_changes = [];
        }
        todo.related_changes.push(...changeDescriptions);
        
        // Also update related files
        const files = changes.map(c => c.file_path);
        if (!todo.related_files) {
            todo.related_files = [];
        }
        todo.related_files.push(...files);
        todo.related_files = [...new Set(todo.related_files)]; // Remove duplicates
        
        todo.updated_at = Date.now();
    }

    /**
     * Auto-update TODO status based on progress
     * If changes are applied for a TODO, mark it as in_progress or completed
     */
    autoUpdateFromChanges(changes: ProposedChange[]): void {
        // Find active TODOs that might be related to these changes
        const activeTodos = this.getActiveTodos();
        
        for (const todo of activeTodos) {
            // Check if any of the changes are related to this TODO's files
            if (todo.related_files) {
                const relatedChanges = changes.filter(c => 
                    todo.related_files!.includes(c.file_path)
                );
                
                if (relatedChanges.length > 0) {
                    // Link changes to TODO
                    this.linkTodoToChanges(todo.id, relatedChanges);
                    
                    // If TODO was pending, mark as in_progress
                    if (todo.status === TodoStatus.PENDING) {
                        this.updateTodo(todo.id, { 
                            status: TodoStatus.IN_PROGRESS,
                            notes: `Auto-updated: ${relatedChanges.length} change(s) applied`
                        });
                    }
                }
            }
        }
    }

    /**
     * Get summary for final report
     */
    getSummary(): string {
        const stats = this.getStats();
        const allTodos = this.getAllTodos();
        
        if (allTodos.length === 0) {
            return 'No TODO list was created during this analysis.';
        }

        const summary: string[] = [];
        summary.push(`\n## TODO List Summary`);
        summary.push(`- Total tasks: ${stats.total}`);
        summary.push(`- Completed: ${stats.completed} (${stats.completion_rate.toFixed(1)}%)`);
        summary.push(`- In Progress: ${stats.in_progress}`);
        summary.push(`- Pending: ${stats.pending}`);
        
        summary.push(`\n### All Tasks:`);
        allTodos.forEach((todo, idx) => {
            const statusIcon = 
                todo.status === 'completed' ? '✅' :
                todo.status === 'in_progress' ? '🔄' :
                todo.status === 'cancelled' ? '❌' : '⏳';
            summary.push(`${idx + 1}. ${statusIcon} **${todo.status.toUpperCase()}**: ${todo.content}`);
            if (todo.notes) {
                summary.push(`   Notes: ${todo.notes}`);
            }
        });

        return summary.join('\n');
    }
}


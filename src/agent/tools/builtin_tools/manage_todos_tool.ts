/**
 * Manage TODOs Tool
 * Manages TODO list for task tracking
 */

import { BaseTool } from '../base_tool';

export interface ManageTodosToolOptions {
  createTodo: (content: string, status?: 'pending' | 'in_progress') => { id: string; content: string; status: string };
  updateTodo: (id: string, updates: { 
    status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    notes?: string;
    related_files?: string[];
    related_changes?: string[];
  }) => boolean;
  getAllTodos: () => Array<{ id: string; content: string; status: string; notes?: string }>;
  getActiveTodos: () => Array<{ id: string; content: string; status: string }>;
}

export class ManageTodosTool extends BaseTool {
  constructor(private options: ManageTodosToolOptions) {
    super();
  }

  getName(): string {
    return 'manage_todos';
  }

  getDescription(): string {
    return 'Manage the TODO list. Create new TODOs, update their status (pending, in_progress, completed, cancelled), or add notes. Use this to track high-level tasks that may require multiple steps to complete.';
  }

  getInputSchema(): {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
    additionalProperties?: boolean;
  } {
    return {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'update', 'list'],
          description: 'Action to perform: create a new TODO, update an existing TODO, or list all TODOs'
        },
        content: {
          type: 'string',
          description: 'Content/description of the TODO (required for create action). This is the text that describes what needs to be done.'
        },
        todo_id: {
          type: 'string',
          description: 'ID of the TODO to update (required for update action). Get the ID from the list action.'
        },
        status: {
          type: 'string',
          enum: ['pending', 'in_progress', 'completed', 'cancelled'],
          description: 'Status to set (for create or update). For create, use "pending" or "in_progress".'
        },
        notes: {
          type: 'string',
          description: 'Additional notes about the TODO (for update action only)'
        }
      },
      required: ['action'],
      additionalProperties: true
    };
  }

  async execute(input: Record<string, any>): Promise<string> {
    const action = input.action as string;

    if (!['create', 'update', 'list'].includes(action)) {
      throw new Error('action must be one of: create, update, list');
    }

    if (action === 'create') {
      // Accept 'content', 'description', or 'text' for flexibility
      const content = (input.content || input.description || input.text || input.task) as string;
      const status = (input.status as string) || 'pending';

      if (!content || typeof content !== 'string') {
        throw new Error('content is required for create action. Provide the task description in the "content" field.');
      }

      if (!['pending', 'in_progress'].includes(status)) {
        throw new Error('status for create must be "pending" or "in_progress"');
      }

      const todo = this.options.createTodo(content, status as 'pending' | 'in_progress');
      return `TODO created: [${todo.id}] ${todo.content} (${todo.status})`;
    }

    if (action === 'update') {
      const todoId = input.todo_id as string;
      const status = input.status as string;
      const notes = input.notes as string;

      if (!todoId || typeof todoId !== 'string') {
        throw new Error('todo_id is required for update action');
      }

      const updates: { status?: string; notes?: string } = {};
      if (status) {
        if (!['pending', 'in_progress', 'completed', 'cancelled'].includes(status)) {
          throw new Error('status must be one of: pending, in_progress, completed, cancelled');
        }
        updates.status = status;
      }
      if (notes) {
        updates.notes = notes;
      }

      const success = this.options.updateTodo(todoId, {
        status: updates.status as 'pending' | 'in_progress' | 'completed' | 'cancelled' | undefined,
        notes: updates.notes
      });
      
      if (success) {
        return `TODO updated: [${todoId}]`;
      } else {
        return `Error: TODO [${todoId}] not found`;
      }
    }

    if (action === 'list') {
      const allTodos = this.options.getAllTodos();
      const activeTodos = this.options.getActiveTodos();

      if (allTodos.length === 0) {
        return 'No TODOs found.';
      }

      const todoList = allTodos.map(todo => {
        const statusEmoji = 
          todo.status === 'completed' ? '✅' :
          todo.status === 'in_progress' ? '🔄' :
          todo.status === 'cancelled' ? '❌' : '⏳';
        
        let line = `${statusEmoji} [${todo.id}] ${todo.status.toUpperCase()}: ${todo.content}`;
        if (todo.notes) {
          line += `\n   📝 Notes: ${todo.notes}`;
        }
        return line;
      }).join('\n\n');

      return `TODO List (${allTodos.length} total, ${activeTodos.length} active):\n\n${todoList}`;
    }

    throw new Error('Invalid action');
  }
}


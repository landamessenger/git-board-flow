/**
 * Manage TODOs Tool
 * 
 * Tool for managing TODO list items for task tracking and progress monitoring.
 * This tool allows agents to create, update, and list TODO items with different statuses
 * (pending, in_progress, completed, cancelled) to track high-level tasks that may
 * require multiple steps to complete.
 * 
 * @internal
 * This tool is used by reasoning agents (IntentClassifier, ErrorDetector, ProgressDetector)
 * to track tasks and maintain state across multiple agent turns. It provides a structured
 * way to manage task lists that persist throughout the agent's reasoning process.
 * 
 * The tool supports three main actions:
 * - CREATE: Add new TODO items (only with pending or in_progress status)
 * - UPDATE: Modify existing TODO items (change status, add notes)
 * - LIST: Retrieve all TODO items with their current status
 * 
 * @example
 * const tool = new ManageTodosTool({
 *   createTodo: (content, status) => { return { id: 'todo_1', content, status }; },
 *   updateTodo: (id, updates) => { return true; },
 *   getAllTodos: () => { return []; },
 *   getActiveTodos: () => { return []; }
 * });
 */

import { BaseTool } from '../base_tool';
import { TodoStatus, TodoAction } from '../../../data/model/think_response';

/**
 * Options for configuring the ManageTodosTool.
 * 
 * @internal
 * These callbacks are provided by the agent initializer and connect the tool
 * to the underlying TODO manager (ThinkTodoManager). The tool acts as a bridge
 * between the agent's tool calls and the actual TODO management logic.
 * 
 * @property createTodo - Callback to create a new TODO item. Returns the created TODO with id, content, and status.
 * @property updateTodo - Callback to update an existing TODO item. Returns true if update succeeded, false if TODO not found.
 * @property getAllTodos - Callback to retrieve all TODO items regardless of status.
 * @property getActiveTodos - Callback to retrieve only active TODO items (pending or in_progress status).
 */
export interface ManageTodosToolOptions {
  /**
   * Creates a new TODO item.
   * 
   * @internal
   * When creating a TODO, only PENDING or IN_PROGRESS statuses are allowed.
   * COMPLETED and CANCELLED statuses cannot be set during creation as they represent
   * terminal states that should only be reached through updates.
   * 
   * @param content - Description of the task to be done
   * @param status - Optional status (defaults to PENDING). Must be PENDING or IN_PROGRESS.
   * @returns Created TODO item with generated id, content, and status
   */
  createTodo: (content: string, status?: TodoStatus) => { id: string; content: string; status: string };
  
  /**
   * Updates an existing TODO item.
   * 
   * @internal
   * Updates can change the status to any valid TodoStatus value, including COMPLETED
   * and CANCELLED. Notes can be added or updated. Related files and changes can be
   * linked to track which files or changes are associated with this TODO.
   * 
   * @param id - Unique identifier of the TODO to update
   * @param updates - Object containing optional status, notes, related_files, and related_changes
   * @returns true if TODO was found and updated, false if TODO not found
   */
  updateTodo: (id: string, updates: { 
    status?: TodoStatus;
    notes?: string;
    related_files?: string[];
    related_changes?: string[];
  }) => boolean;
  
  /**
   * Retrieves all TODO items.
   * 
   * @internal
   * Returns all TODOs regardless of status. Used for listing and overview purposes.
   * 
   * @returns Array of all TODO items with id, content, status, and optional notes
   */
  getAllTodos: () => Array<{ id: string; content: string; status: string; notes?: string }>;
  
  /**
   * Retrieves only active TODO items.
   * 
   * @internal
   * Active TODOs are those with PENDING or IN_PROGRESS status. COMPLETED and CANCELLED
   * items are excluded. Used to show only actionable items.
   * 
   * @returns Array of active TODO items (pending or in_progress)
   */
  getActiveTodos: () => Array<{ id: string; content: string; status: string }>;
}

/**
 * ManageTodosTool - Tool for managing TODO list items.
 * 
 * This tool provides a structured interface for agents to manage task lists during
 * their reasoning process. It supports creating new tasks, updating existing ones,
 * and listing all tasks with their current status.
 * 
 * @internal
 * The tool validates all inputs and ensures type safety using TodoStatus and TodoAction
 * enums. It handles three distinct actions (CREATE, UPDATE, LIST) and provides clear
 * error messages when validation fails.
 * 
 * The tool is designed to be flexible - it accepts multiple field names for content
 * (content, description, text, task) to accommodate different agent response formats.
 */
export class ManageTodosTool extends BaseTool {
  /**
   * Creates a new ManageTodosTool instance.
   * 
   * @internal
   * The options parameter provides callbacks that connect this tool to the underlying
   * TODO manager. This separation allows the tool to be used with different TODO
   * management implementations.
   * 
   * @param options - Configuration object with callbacks for TODO operations
   */
  constructor(private options: ManageTodosToolOptions) {
    super();
  }

  /**
   * Returns the tool name used by the agent system.
   * 
   * @internal
   * This name is used when the agent calls the tool via tool calls.
   * 
   * @returns Tool identifier: 'manage_todos'
   */
  getName(): string {
    return 'manage_todos';
  }

  /**
   * Returns the tool description shown to the agent.
   * 
   * @internal
   * This description helps the agent understand when and how to use this tool.
   * It's included in the agent's available tools list.
   * 
   * @returns Human-readable description of the tool's purpose
   */
  getDescription(): string {
    return 'Manage the TODO list. Create new TODOs, update their status (pending, in_progress, completed, cancelled), or add notes. Use this to track high-level tasks that may require multiple steps to complete.';
  }

  /**
   * Returns the JSON schema for tool input validation.
   * 
   * @internal
   * The schema defines the structure and validation rules for the tool's input parameters.
   * It uses enums (TodoAction, TodoStatus) to ensure type safety and prevent invalid values.
   * The schema is used by the agent system to validate tool calls before execution.
   * 
   * @returns JSON schema object defining input structure and validation rules
   * 
   * @remarks
   * - action is required and must be one of: CREATE, UPDATE, LIST
   * - content is required for CREATE action
   * - todo_id is required for UPDATE action
   * - status uses TodoStatus enum values (pending, in_progress, completed, cancelled)
   * - notes is optional and only used for UPDATE action
   * - additionalProperties: true allows flexibility for future extensions
   */
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
          enum: Object.values(TodoAction),
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
          enum: Object.values(TodoStatus),
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

  /**
   * Executes the tool with the provided input.
   * 
   * This method handles three distinct actions:
   * 1. CREATE: Creates a new TODO item with content and optional status
   * 2. UPDATE: Updates an existing TODO item (status, notes)
   * 3. LIST: Returns a formatted list of all TODO items
   * 
   * @internal
   * The method validates all inputs before processing. It uses TodoAction and TodoStatus
   * enums to ensure type safety. For CREATE action, it accepts multiple field names
   * (content, description, text, task) for flexibility with different agent response formats.
   * 
   * @param input - Tool input containing action and action-specific parameters
   * @returns String response indicating success or error, or formatted TODO list
   * 
   * @throws Error if action is invalid, required fields are missing, or status values are invalid
   * 
   * @remarks
   * - CREATE action: Only PENDING or IN_PROGRESS status allowed during creation
   * - UPDATE action: All TodoStatus values allowed, including COMPLETED and CANCELLED
   * - LIST action: Returns formatted list with emojis and status indicators
   * - All actions log their execution for debugging and monitoring
   * 
   * @example
   * // Create a TODO
   * const result = await tool.execute({
   *   action: 'create',
   *   content: 'Fix bug in authentication',
   *   status: 'pending'
   * });
   * // Returns: "TODO created: [todo_1] Fix bug in authentication (pending)"
   * 
   * // Update a TODO
   * const result2 = await tool.execute({
   *   action: 'update',
   *   todo_id: 'todo_1',
   *   status: 'in_progress',
   *   notes: 'Working on it'
   * });
   * // Returns: "TODO updated: [todo_1]"
   * 
   * // List all TODOs
   * const result3 = await tool.execute({ action: 'list' });
   * // Returns formatted list with all TODOs
   */
  async execute(input: Record<string, any>): Promise<string> {
    const { logInfo } = require('../../../utils/logger');
    const action = input.action as string;
    logInfo(`   📋 Managing TODOs - Action: ${action}`);

    // Validate action is a valid TodoAction enum value
    // @internal This ensures type safety and prevents invalid action values
    if (!Object.values(TodoAction).includes(action as TodoAction)) {
      throw new Error(`action must be one of: ${Object.values(TodoAction).join(', ')}`);
    }

    // Handle CREATE action
    // @internal CREATE allows new TODO items to be added with PENDING or IN_PROGRESS status only
    if (action === TodoAction.CREATE) {
      // Accept multiple field names for flexibility (content, description, text, task)
      // @internal This accommodates different agent response formats and improves robustness
      const content = (input.content || input.description || input.text || input.task) as string;
      const status = (input.status as string) || TodoStatus.PENDING;

      // Validate content is provided and is a string
      // @internal Content is required for creating a meaningful TODO item
      if (!content || typeof content !== 'string') {
        throw new Error('content is required for create action. Provide the task description in the "content" field.');
      }

      // Validate status is PENDING or IN_PROGRESS for new TODOs
      // @internal COMPLETED and CANCELLED cannot be set during creation as they represent terminal states
      if (![TodoStatus.PENDING, TodoStatus.IN_PROGRESS].includes(status as TodoStatus)) {
        throw new Error(`status for create must be "${TodoStatus.PENDING}" or "${TodoStatus.IN_PROGRESS}"`);
      }

      // Create TODO via callback
      // @internal The callback connects to the underlying TODO manager (ThinkTodoManager)
      const todo = this.options.createTodo(content, status as TodoStatus);
      return `TODO created: [${todo.id}] ${todo.content} (${todo.status})`;
    }

    // Handle UPDATE action
    // @internal UPDATE allows modifying existing TODO items, including changing status to any valid value
    if (action === TodoAction.UPDATE) {
      const todoId = input.todo_id as string;
      const status = input.status as string;
      const notes = input.notes as string;

      // Validate todo_id is provided
      // @internal todo_id is required to identify which TODO to update
      if (!todoId || typeof todoId !== 'string') {
        throw new Error('todo_id is required for update action');
      }

      // Build updates object with validated values
      // @internal Only include fields that are provided and valid
      const updates: { status?: TodoStatus; notes?: string } = {};
      if (status) {
        // Validate status is a valid TodoStatus enum value
        // @internal UPDATE allows all status values including COMPLETED and CANCELLED
        if (!Object.values(TodoStatus).includes(status as TodoStatus)) {
          throw new Error(`status must be one of: ${Object.values(TodoStatus).join(', ')}`);
        }
        updates.status = status as TodoStatus;
      }
      if (notes) {
        updates.notes = notes;
      }

      // Update TODO via callback
      // @internal Returns true if TODO was found and updated, false if not found
      const success = this.options.updateTodo(todoId, {
        status: updates.status,
        notes: updates.notes
      });
      
      if (success) {
        return `TODO updated: [${todoId}]`;
      } else {
        return `Error: TODO [${todoId}] not found`;
      }
    }

    // Handle LIST action
    // @internal LIST returns a formatted view of all TODO items with their status and notes
    if (action === TodoAction.LIST) {
      const allTodos = this.options.getAllTodos();
      const activeTodos = this.options.getActiveTodos();

      // Return early if no TODOs exist
      // @internal Prevents unnecessary processing when list is empty
      if (allTodos.length === 0) {
        return 'No TODOs found.';
      }

      // Format each TODO with emoji based on status
      // @internal Emojis provide visual indicators: ✅ completed, 🔄 in_progress, ❌ cancelled, ⏳ pending
      const todoList = allTodos.map(todo => {
        const statusEmoji = 
          todo.status === TodoStatus.COMPLETED ? '✅' :
          todo.status === TodoStatus.IN_PROGRESS ? '🔄' :
          todo.status === TodoStatus.CANCELLED ? '❌' : '⏳';
        
        let line = `${statusEmoji} [${todo.id}] ${todo.status.toUpperCase()}: ${todo.content}`;
        // Include notes if present
        // @internal Notes provide additional context about the TODO's progress or blockers
        if (todo.notes) {
          line += `\n   📝 Notes: ${todo.notes}`;
        }
        return line;
      }).join('\n\n');

      // Return formatted list with summary
      // @internal Summary shows total count and active count (pending + in_progress)
      return `TODO List (${allTodos.length} total, ${activeTodos.length} active):\n\n${todoList}`;
    }

    // This should never be reached due to validation above, but included for type safety
    // @internal Fallback error for unexpected action values
    throw new Error('Invalid action');
  }
}


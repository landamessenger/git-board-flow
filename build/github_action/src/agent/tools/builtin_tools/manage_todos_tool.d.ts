/**
 * Manage TODOs Tool - Tool for managing TODO list items for task tracking and progress monitoring.
 *
 * This tool provides a structured interface for agents to manage task lists during their reasoning
 * process. It allows agents to create, update, and list TODO items with different statuses
 * (pending, in_progress, completed, cancelled) to track high-level tasks that may require
 * multiple steps to complete.
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
 * The tool validates all inputs and ensures type safety using TodoStatus and TodoAction enums.
 * It handles three distinct actions and provides clear error messages when validation fails.
 *
 * @remarks
 * - The tool is designed to be flexible - it accepts multiple field names for content
 *   (content, description, text, task) to accommodate different agent response formats
 * - CREATE action only allows PENDING or IN_PROGRESS status during creation
 * - UPDATE action allows all TodoStatus values including COMPLETED and CANCELLED
 * - LIST action returns formatted list with emojis and status indicators
 *
 * @example
 * ```typescript
 * const tool = new ManageTodosTool({
 *   createTodo: (content, status) => { return { id: 'todo_1', content, status }; },
 *   updateTodo: (id, updates) => { return true; },
 *   getAllTodos: () => { return []; },
 *   getActiveTodos: () => { return []; }
 * });
 *
 * // Create a TODO
 * await tool.execute({
 *   action: 'create',
 *   content: 'Fix bug in authentication',
 *   status: 'pending'
 * });
 *
 * // Update a TODO
 * await tool.execute({
 *   action: 'update',
 *   todo_id: 'todo_1',
 *   status: 'in_progress',
 *   notes: 'Working on it'
 * });
 *
 * // List all TODOs
 * await tool.execute({ action: 'list' });
 * ```
 */
import { BaseTool } from '../base_tool';
import { TodoStatus } from '../../../data/model/think_response';
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
    createTodo: (content: string, status?: TodoStatus) => {
        id: string;
        content: string;
        status: string;
    };
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
    getAllTodos: () => Array<{
        id: string;
        content: string;
        status: string;
        notes?: string;
    }>;
    /**
     * Retrieves only active TODO items.
     *
     * @internal
     * Active TODOs are those with PENDING or IN_PROGRESS status. COMPLETED and CANCELLED
     * items are excluded. Used to show only actionable items.
     *
     * @returns Array of active TODO items (pending or in_progress)
     */
    getActiveTodos: () => Array<{
        id: string;
        content: string;
        status: string;
    }>;
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
export declare class ManageTodosTool extends BaseTool {
    private options;
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
    constructor(options: ManageTodosToolOptions);
    /**
     * Returns the tool name used by the agent system.
     *
     * @internal
     * This name is used when the agent calls the tool via tool calls.
     *
     * @returns Tool identifier: 'manage_todos'
     */
    getName(): string;
    /**
     * Returns the tool description shown to the agent.
     *
     * @internal
     * This description helps the agent understand when and how to use this tool.
     * It's included in the agent's available tools list.
     *
     * @returns Human-readable description of the tool's purpose
     */
    getDescription(): string;
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
    };
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
    execute(input: Record<string, any>): Promise<string>;
}

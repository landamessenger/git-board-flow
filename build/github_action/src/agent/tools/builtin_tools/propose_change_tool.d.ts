/**
 * Propose Change Tool - Proposes changes to files in the virtual codebase.
 *
 * This tool allows agents to propose modifications to files in the virtual codebase (in-memory
 * representation). Changes can be created, modified, deleted, or refactored. The tool supports
 * automatic application to disk when the user prompt is detected as an order (not a question).
 *
 * @internal
 * This tool is used by agents to make code changes during their reasoning process. Changes are
 * first applied to the virtual codebase (in-memory), and can optionally be automatically written
 * to disk based on intent classification or explicit auto_apply parameter.
 *
 * The tool implements intelligent auto-apply detection:
 * - If user prompt is an ORDER (create, write, make, build, set up, modify): auto_apply is enabled
 * - If user prompt is a QUESTION (what, how, why, should, could): auto_apply is disabled
 * - Explicit auto_apply parameter can override the auto-detection
 *
 * @remarks
 * - Changes are always applied to virtual codebase first (in-memory)
 * - Auto-apply to disk happens when shouldApplyChanges is true (from intent classifier or prompt analysis)
 * - For clear orders: files are written to disk immediately
 * - For questions/doubts: changes stay in memory for discussion
 * - The tool validates all inputs and ensures type safety using ChangeType enum
 *
 * @example
 * ```typescript
 * const tool = new ProposeChangeTool({
 *   applyChange: (change) => { return true; },
 *   autoApplyToDisk: async (filePath) => { return true; },
 *   getUserPrompt: () => 'Create a new file',
 *   getShouldApplyChanges: () => true
 * });
 *
 * // Propose a change (auto-apply will be determined automatically)
 * await tool.execute({
 *   file_path: 'src/utils/helper.ts',
 *   change_type: 'create',
 *   description: 'Create helper utility',
 *   suggested_code: 'export function helper() {}',
 *   reasoning: 'User requested to create this file'
 * });
 * ```
 */
import { BaseTool } from '../base_tool';
import { ChangeType } from '../../../data/model/think_response';
/**
 * Options for configuring the ProposeChangeTool.
 *
 * @internal
 * These callbacks connect the tool to the underlying change management system and provide
 * hooks for auto-applying changes to disk when appropriate.
 *
 * @property applyChange - Callback to apply change to virtual codebase. Returns true if successful.
 * @property onChangeApplied - Optional callback invoked when change is applied to virtual codebase.
 * @property autoApplyToDisk - Optional callback to automatically write changes to disk when auto_apply is enabled.
 * @property getUserPrompt - Optional callback to get original user prompt for intent detection (fallback).
 * @property getShouldApplyChanges - Optional callback to get pre-classified intent from intent classifier.
 */
export interface ProposeChangeToolOptions {
    applyChange: (change: {
        file_path: string;
        change_type: ChangeType;
        description: string;
        suggested_code: string;
        reasoning: string;
    }) => boolean;
    onChangeApplied?: (change: any) => void;
    autoApplyToDisk?: (filePath: string, operation?: ChangeType) => Promise<boolean>;
    getUserPrompt?: () => string | undefined;
    getShouldApplyChanges?: () => boolean | undefined;
}
/**
 * ProposeChangeTool - Tool for proposing changes to files in the virtual codebase.
 *
 * This tool provides a structured interface for agents to propose file modifications. Changes
 * are applied to the virtual codebase (in-memory) and can optionally be automatically written
 * to disk based on intent classification or explicit configuration.
 *
 * @internal
 * The tool validates all inputs and ensures type safety using ChangeType enum. It implements
 * intelligent auto-apply detection based on user prompt analysis or pre-classified intent.
 */
export declare class ProposeChangeTool extends BaseTool {
    private options;
    /**
     * Creates a new ProposeChangeTool instance.
     *
     * @internal
     * The options parameter provides callbacks that connect this tool to the underlying change
     * management system and enable auto-apply functionality.
     *
     * @param options - Configuration object with callbacks for change operations
     */
    constructor(options: ProposeChangeToolOptions);
    /**
     * Returns the tool name used by the agent system.
     *
     * @internal
     * This name is used when the agent calls the tool via tool calls.
     *
     * @returns Tool identifier: 'propose_change'
     */
    getName(): string;
    getDescription(): string;
    getInputSchema(): {
        type: 'object';
        properties: Record<string, any>;
        required: string[];
        additionalProperties?: boolean;
    };
    /**
     * Detects if user prompt is an order (not a question).
     *
     * This method analyzes the user prompt to determine if it represents a clear instruction
     * to perform an action (order) versus a question seeking information.
     *
     * @internal
     * This is a fallback method used when intent classifier is not available. It uses pattern
     * matching to identify order indicators (create, write, make, build, etc.) and question
     * indicators (what, how, why, ?, etc.). Question indicators take priority - if a prompt
     * contains both, it's treated as a question.
     *
     * @param prompt - Optional user prompt to analyze
     * @returns true if prompt is detected as an order, false if it's a question or unclear
     *
     * @remarks
     * - Strong question indicators (?, what, how, why, etc.) take priority over order indicators
     * - Order indicators include: create, write, make, build, set up, modify, add, implement, etc.
     * - If prompt contains question mark or starts with question words, it's treated as a question
     * - Default behavior: if no question mark and has action verbs, treat as order
     */
    private isOrderPrompt;
    /**
     * Executes the tool with the provided input.
     *
     * This method handles the complete change proposal workflow:
     * 1. Validates all input parameters (file_path, change_type, description, suggested_code, reasoning)
     * 2. Applies change to virtual codebase (in-memory)
     * 3. Determines if auto-apply to disk should be enabled (explicit parameter, intent classifier, or prompt analysis)
     * 4. Optionally writes changes to disk if auto-apply is enabled
     *
     * @internal
     * The method validates all inputs before processing. It uses ChangeType enum to ensure
     * type safety. Auto-apply detection follows a priority order:
     * 1. Explicit auto_apply parameter (if provided)
     * 2. Pre-classified intent from intent classifier (if available)
     * 3. Fallback to user prompt analysis (if classifier not used)
     *
     * @param input - Tool input containing file_path, change_type, description, suggested_code, reasoning, and optional auto_apply
     * @returns String response indicating success or error, including whether changes were auto-applied to disk
     *
     * @throws Error if required fields are missing, change_type is invalid, or file operations fail
     *
     * @remarks
     * - All changes are applied to virtual codebase first (in-memory)
     * - Auto-apply to disk only happens if shouldAutoApply is true and autoApplyToDisk callback is provided
     * - For DELETE operations, special handling is required when writing to disk
     * - If auto-apply fails, the change remains in virtual codebase and user can use apply_changes tool manually
     *
     * @example
     * ```typescript
     * // Propose a change (auto-apply determined automatically)
     * const result = await tool.execute({
     *   file_path: 'src/utils/helper.ts',
     *   change_type: 'create',
     *   description: 'Create helper utility',
     *   suggested_code: 'export function helper() {}',
     *   reasoning: 'User requested to create this file'
     * });
     * // Returns: "Change proposed and automatically applied to disk: src/utils/helper.ts: Create helper utility"
     *
     * // Propose a change with explicit auto_apply
     * const result2 = await tool.execute({
     *   file_path: 'src/utils/helper.ts',
     *   change_type: 'modify',
     *   description: 'Update helper function',
     *   suggested_code: 'export function helper() { return true; }',
     *   reasoning: 'Add return value',
     *   auto_apply: true
     * });
     * ```
     */
    execute(input: Record<string, unknown>): Promise<string>;
}

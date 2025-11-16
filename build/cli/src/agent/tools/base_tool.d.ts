/**
 * Base class for all tools
 */
import { ToolDefinition, ToolExecutionResult } from '../types';
export declare abstract class BaseTool {
    /**
     * Get tool name
     */
    abstract getName(): string;
    /**
     * Get tool description
     */
    abstract getDescription(): string;
    /**
     * Get input schema (JSON Schema format)
     */
    abstract getInputSchema(): {
        type: 'object';
        properties: Record<string, any>;
        required: string[];
        additionalProperties?: boolean;
    };
    /**
     * Execute the tool
     */
    abstract execute(input: Record<string, any>): Promise<any>;
    /**
     * Get tool definition
     */
    getDefinition(): ToolDefinition;
    /**
     * Validate input against schema
     */
    validateInput(input: Record<string, any>): {
        valid: boolean;
        error?: string;
    };
    /**
     * Execute with validation
     */
    executeWithValidation(input: Record<string, any>): Promise<ToolExecutionResult>;
}

/**
 * Tool Permissions Manager
 * Controls which tools the agent can use
 */
import { ToolPermissions } from '../types/agent_types';
export declare class ToolPermissionsManager {
    private permissions;
    constructor(permissions?: ToolPermissions);
    /**
     * Check if a tool is allowed
     */
    isAllowed(toolName: string): boolean;
    /**
     * Get all allowed tool names from a list
     */
    filterAllowed(toolNames: string[]): string[];
    /**
     * Update permissions
     */
    updatePermissions(permissions: ToolPermissions): void;
    /**
     * Get current permissions
     */
    getPermissions(): ToolPermissions;
}

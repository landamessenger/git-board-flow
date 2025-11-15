/**
 * Tool Permissions Manager
 * Controls which tools the agent can use
 */

import { ToolPermissions, ToolPermissionStrategy } from '../types/agent_types';

export class ToolPermissionsManager {
  private permissions: ToolPermissions;

  constructor(permissions?: ToolPermissions) {
    this.permissions = permissions || { strategy: 'all' };
  }

  /**
   * Check if a tool is allowed
   */
  isAllowed(toolName: string): boolean {
    const { strategy, allowed = [], blocked = [] } = this.permissions;

    switch (strategy) {
      case 'all':
        return !blocked.includes(toolName);
      
      case 'allowlist':
        return allowed.includes(toolName);
      
      case 'blocklist':
        return !blocked.includes(toolName);
      
      default:
        return true;
    }
  }

  /**
   * Get all allowed tool names from a list
   */
  filterAllowed(toolNames: string[]): string[] {
    return toolNames.filter(name => this.isAllowed(name));
  }

  /**
   * Update permissions
   */
  updatePermissions(permissions: ToolPermissions): void {
    this.permissions = permissions;
  }

  /**
   * Get current permissions
   */
  getPermissions(): ToolPermissions {
    return { ...this.permissions };
  }
}


/**
 * Tests for ToolPermissionsManager
 */

import { ToolPermissionsManager } from '../core/tool_permissions';
import { ToolPermissions } from '../types/agent_types';

describe('ToolPermissionsManager', () => {
  describe('Strategy: all', () => {
    it('should allow all tools by default', () => {
      const manager = new ToolPermissionsManager();
      expect(manager.isAllowed('any_tool')).toBe(true);
    });

    it('should block tools in blocklist', () => {
      const permissions: ToolPermissions = {
        strategy: 'all',
        blocked: ['blocked_tool']
      };
      const manager = new ToolPermissionsManager(permissions);
      
      expect(manager.isAllowed('allowed_tool')).toBe(true);
      expect(manager.isAllowed('blocked_tool')).toBe(false);
    });
  });

  describe('Strategy: allowlist', () => {
    it('should only allow tools in allowlist', () => {
      const permissions: ToolPermissions = {
        strategy: 'allowlist',
        allowed: ['tool1', 'tool2']
      };
      const manager = new ToolPermissionsManager(permissions);
      
      expect(manager.isAllowed('tool1')).toBe(true);
      expect(manager.isAllowed('tool2')).toBe(true);
      expect(manager.isAllowed('tool3')).toBe(false);
    });
  });

  describe('Strategy: blocklist', () => {
    it('should block tools in blocklist', () => {
      const permissions: ToolPermissions = {
        strategy: 'blocklist',
        blocked: ['blocked_tool']
      };
      const manager = new ToolPermissionsManager(permissions);
      
      expect(manager.isAllowed('allowed_tool')).toBe(true);
      expect(manager.isAllowed('blocked_tool')).toBe(false);
    });
  });

  describe('filterAllowed', () => {
    it('should filter tool names by permissions', () => {
      const permissions: ToolPermissions = {
        strategy: 'allowlist',
        allowed: ['tool1', 'tool2']
      };
      const manager = new ToolPermissionsManager(permissions);
      
      const tools = ['tool1', 'tool2', 'tool3', 'tool4'];
      const allowed = manager.filterAllowed(tools);
      
      expect(allowed).toEqual(['tool1', 'tool2']);
    });
  });

  describe('updatePermissions', () => {
    it('should update permissions', () => {
      const manager = new ToolPermissionsManager({
        strategy: 'allowlist',
        allowed: ['tool1']
      });
      
      expect(manager.isAllowed('tool2')).toBe(false);
      
      manager.updatePermissions({
        strategy: 'allowlist',
        allowed: ['tool1', 'tool2']
      });
      
      expect(manager.isAllowed('tool2')).toBe(true);
    });
  });
});


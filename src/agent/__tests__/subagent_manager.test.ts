/**
 * Tests for SubAgent Manager
 */

import { SubAgentManager, SubAgentOptions, Task } from '../core/subagent_manager';
import { Agent } from '../core/agent';
import { AgentOptions } from '../types';

// Mock Agent
jest.mock('../core/agent');

describe('SubAgentManager', () => {
  let manager: SubAgentManager;
  let mockParentAgent: jest.Mocked<Agent>;

  beforeEach(() => {
    // Create a real Agent instance for testing
    mockParentAgent = new Agent({
      model: 'test-model',
      apiKey: 'test-key',
      enableMCP: false
    }) as any;

    // Mock the methods we need
    mockParentAgent.getMessages = jest.fn().mockReturnValue([]);
    mockParentAgent.getAvailableTools = jest.fn().mockReturnValue([]);

    manager = new SubAgentManager(mockParentAgent);
    jest.clearAllMocks();
  });

  describe('createSubAgent', () => {
    it('should create a subagent with provided options', () => {
      const options: SubAgentOptions = {
        name: 'test-agent',
        systemPrompt: 'You are a test agent',
        maxTurns: 5
      };

      const subAgent = manager.createSubAgent(options);

      expect(subAgent).toBeDefined();
      expect(manager.getSubAgent('test-agent')).toBe(subAgent);
    });

    it('should return existing subagent if name already exists', () => {
      const options: SubAgentOptions = {
        name: 'test-agent'
      };

      const agent1 = manager.createSubAgent(options);
      const agent2 = manager.createSubAgent(options);

      expect(agent1).toBe(agent2);
    });

    it('should inherit context from parent if enabled', () => {
      // Use real messageManager from the agent
      const realMessageManager = (mockParentAgent as any).messageManager;
      if (realMessageManager) {
        realMessageManager.addUserMessage('Hello');
        realMessageManager.addAssistantMessage('Hi there');
      }

      const options: SubAgentOptions = {
        name: 'test-agent',
        inheritContext: true
      };

      const subAgent = manager.createSubAgent(options);

      // Verify subagent was created
      expect(subAgent).toBeDefined();
      // Verify parent messages were accessed
      expect(mockParentAgent.getMessages).toHaveBeenCalled();
    });
  });

  describe('executeParallel', () => {
    it('should execute multiple tasks in parallel', async () => {
      const mockSubAgent = {
        query: jest.fn().mockResolvedValue({
          finalResponse: 'Result',
          turns: [],
          toolCalls: [],
          messages: []
        })
      } as any;

      // Mock createSubAgent to return our mock
      jest.spyOn(manager, 'createSubAgent').mockReturnValue(mockSubAgent as any);

      const tasks: Task[] = [
        {
          name: 'task1',
          prompt: 'Do task 1'
        },
        {
          name: 'task2',
          prompt: 'Do task 2'
        }
      ];

      const results = await manager.executeParallel(tasks);

      expect(results).toHaveLength(2);
      expect(results[0].task).toBe('task1');
      expect(results[1].task).toBe('task2');
      expect(mockSubAgent.query).toHaveBeenCalledTimes(2);
    });

    it('should handle errors in parallel execution', async () => {
      const mockSubAgent = {
        query: jest.fn().mockRejectedValue(new Error('Task failed'))
      } as any;

      jest.spyOn(manager, 'createSubAgent').mockReturnValue(mockSubAgent as any);

      const tasks: Task[] = [
        {
          name: 'task1',
          prompt: 'Do task 1'
        }
      ];

      await expect(manager.executeParallel(tasks)).rejects.toThrow('Task failed');
    });
  });

  describe('coordinateAgents', () => {
    it('should execute tasks respecting dependencies', async () => {
      const mockSubAgent1 = {
        query: jest.fn().mockResolvedValue({
          finalResponse: 'Result 1',
          turns: [],
          toolCalls: [],
          messages: []
        })
      } as any;

      const mockSubAgent2 = {
        query: jest.fn().mockResolvedValue({
          finalResponse: 'Result 2',
          turns: [],
          toolCalls: [],
          messages: []
        })
      } as any;

      jest.spyOn(manager, 'createSubAgent')
        .mockReturnValueOnce(mockSubAgent1 as any)
        .mockReturnValueOnce(mockSubAgent2 as any);

      const tasks: Array<Task & { dependsOn?: string[] }> = [
        {
          name: 'task1',
          prompt: 'Do task 1'
        },
        {
          name: 'task2',
          prompt: 'Do task 2',
          dependsOn: ['task1']
        }
      ];

      const results = await manager.coordinateAgents(tasks);

      expect(results).toHaveLength(2);
      // task1 should execute first (check call order)
      const callOrder1 = (mockSubAgent1.query as jest.Mock).mock.invocationCallOrder[0];
      const callOrder2 = (mockSubAgent2.query as jest.Mock).mock.invocationCallOrder[0];
      expect(callOrder1).toBeLessThan(callOrder2);
    });

    it('should throw error on circular dependencies', async () => {
      const tasks: Array<Task & { dependsOn?: string[] }> = [
        {
          name: 'task1',
          prompt: 'Do task 1',
          dependsOn: ['task2']
        },
        {
          name: 'task2',
          prompt: 'Do task 2',
          dependsOn: ['task1']
        }
      ];

      await expect(manager.coordinateAgents(tasks)).rejects.toThrow('Circular dependency');
    });
  });

  describe('shareContext', () => {
    it('should share context between subagents', () => {
      const agent1 = manager.createSubAgent({ name: 'agent1' });
      const agent2 = manager.createSubAgent({ name: 'agent2' });

      // Mock messages
      (agent1 as any).getMessages = jest.fn().mockReturnValue([
        { role: 'user', content: 'Hello' }
      ]);

      (agent2 as any)['messageManager'] = {
        addSystemMessage: jest.fn(),
        addUserMessage: jest.fn(),
        addAssistantMessage: jest.fn()
      };

      manager.shareContext('agent1', 'agent2');

      expect((agent2 as any)['messageManager'].addUserMessage).toHaveBeenCalled();
    });
  });

  describe('getSubAgent', () => {
    it('should return subagent by name', () => {
      // Ensure parent agent has options accessible
      (mockParentAgent as any).options = {
        model: 'test-model',
        apiKey: 'test-key',
        enableMCP: false
      };
      
      const agent = manager.createSubAgent({ name: 'test-agent' });

      expect(manager.getSubAgent('test-agent')).toBe(agent);
      expect(manager.getSubAgent('non-existent')).toBeUndefined();
    });
  });

  describe('removeSubAgent', () => {
    it('should remove subagent', () => {
      // Ensure parent agent has options accessible
      (mockParentAgent as any).options = {
        model: 'test-model',
        apiKey: 'test-key',
        enableMCP: false
      };
      
      manager.createSubAgent({ name: 'test-agent' });
      expect(manager.getSubAgent('test-agent')).toBeDefined();

      manager.removeSubAgent('test-agent');
      expect(manager.getSubAgent('test-agent')).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('should clear all subagents', () => {
      // Ensure parent agent has options accessible
      (mockParentAgent as any).options = {
        model: 'test-model',
        apiKey: 'test-key',
        enableMCP: false
      };
      
      manager.createSubAgent({ name: 'agent1' });
      manager.createSubAgent({ name: 'agent2' });

      expect(manager.getSubAgentNames()).toHaveLength(2);

      manager.clear();

      expect(manager.getSubAgentNames()).toHaveLength(0);
    });
  });
});


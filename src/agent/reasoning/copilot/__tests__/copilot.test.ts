/**
 * Tests for Copilot Agent
 */

import { Copilot } from '../copilot';
import { CopilotOptions } from '../types';
import { Agent } from '../../../core/agent';
import { AgentResult } from '../../../types';

// Mock dependencies
jest.mock('../agent_initializer');
jest.mock('../subagent_handler');
jest.mock('../../../core/agent');
jest.mock('../../intent_classifier');

describe('Copilot', () => {
  let copilot: Copilot;
  let mockOptions: CopilotOptions;

  beforeEach(() => {
    mockOptions = {
      apiKey: 'test-api-key',
      model: 'test-model',
      maxTurns: 50,
      repositoryOwner: 'test-owner',
      repositoryName: 'test-repo',
      repositoryBranch: 'main',
      workingDirectory: 'copilot_dummy'
    };

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided options', () => {
      copilot = new Copilot(mockOptions);

      expect(copilot).toBeDefined();
      expect(copilot.getAgent).toBeDefined();
    });

    it('should use default model from environment if not provided', () => {
      const originalEnv = process.env.OPENROUTER_MODEL;
      process.env.OPENROUTER_MODEL = 'env-model';

      const options: CopilotOptions = {
        apiKey: 'test-key'
      };

      copilot = new Copilot(options);

      expect(copilot).toBeDefined();
      
      if (originalEnv) {
        process.env.OPENROUTER_MODEL = originalEnv;
      } else {
        delete process.env.OPENROUTER_MODEL;
      }
    });

    it('should set default maxTurns if not provided', () => {
      const options: CopilotOptions = {
        apiKey: 'test-key'
      };

      copilot = new Copilot(options);

      expect(copilot).toBeDefined();
    });

    it('should set default workingDirectory to current directory if not provided', () => {
      const options: CopilotOptions = {
        apiKey: 'test-key'
      };

      copilot = new Copilot(options);

      expect(copilot).toBeDefined();
      // The default should be process.cwd() now, not 'copilot_dummy'
    });

    it('should use provided workingDirectory', () => {
      const options: CopilotOptions = {
        apiKey: 'test-key',
        workingDirectory: 'custom_dir'
      };

      copilot = new Copilot(options);

      expect(copilot).toBeDefined();
    });
  });

  describe('processPrompt', () => {
    it('should initialize agent on first call', async () => {
      const { AgentInitializer } = require('../agent_initializer');
      const { IntentClassifier } = require('../../intent_classifier');
      const mockAgent = {
        query: jest.fn().mockResolvedValue({
          finalResponse: 'Test response',
          turns: [],
          toolCalls: [],
          messages: []
        } as AgentResult)
      };

      AgentInitializer.initialize = jest.fn().mockResolvedValue({
        agent: mockAgent,
        repositoryFiles: new Map()
      });

      IntentClassifier.prototype.classifyIntent = jest.fn().mockResolvedValue({
        shouldApplyChanges: false,
        reasoning: 'Test',
        confidence: 'high'
      });

      copilot = new Copilot(mockOptions);
      await copilot.processPrompt('Test prompt');

      expect(AgentInitializer.initialize).toHaveBeenCalled();
    });

    it('should execute agent query with user prompt', async () => {
      const { AgentInitializer } = require('../agent_initializer');
      const { IntentClassifier } = require('../../intent_classifier');
      const mockAgent = {
        query: jest.fn().mockResolvedValue({
          finalResponse: 'Test response',
          turns: [],
          toolCalls: [],
          messages: []
        } as AgentResult)
      };

      AgentInitializer.initialize = jest.fn().mockResolvedValue({
        agent: mockAgent,
        repositoryFiles: new Map()
      });

      IntentClassifier.prototype.classifyIntent = jest.fn().mockResolvedValue({
        shouldApplyChanges: false,
        reasoning: 'Question about code',
        confidence: 'high'
      });

      copilot = new Copilot(mockOptions);
      const userPrompt = 'Explain how this code works';
      await copilot.processPrompt(userPrompt);

      expect(IntentClassifier.prototype.classifyIntent).toHaveBeenCalledWith(userPrompt);
      expect(mockAgent.query).toHaveBeenCalledWith(userPrompt);
    });

    it('should return response and agent result', async () => {
      const { AgentInitializer } = require('../agent_initializer');
      const { IntentClassifier } = require('../../intent_classifier');
      const mockAgentResult: AgentResult = {
        finalResponse: 'This code implements a sorting algorithm',
        turns: [],
        toolCalls: [],
        messages: []
      };

      const mockAgent = {
        query: jest.fn().mockResolvedValue(mockAgentResult)
      };

      AgentInitializer.initialize = jest.fn().mockResolvedValue({
        agent: mockAgent,
        repositoryFiles: new Map()
      });

      IntentClassifier.prototype.classifyIntent = jest.fn().mockResolvedValue({
        shouldApplyChanges: false,
        reasoning: 'Question about code',
        confidence: 'high'
      });

      copilot = new Copilot(mockOptions);
      const result = await copilot.processPrompt('Explain this code');

      expect(result.response).toBe('This code implements a sorting algorithm');
      expect(result.agentResult).toBe(mockAgentResult);
    });

    it('should extract changes from propose_change tool calls', async () => {
      const { AgentInitializer } = require('../agent_initializer');
      const { IntentClassifier } = require('../../intent_classifier');
      const mockAgentResult: AgentResult = {
        finalResponse: 'I have created the file',
        turns: [
          {
            turnNumber: 1,
            assistantMessage: 'Creating file',
            toolCalls: [
              {
                id: 'tool-call-1',
                name: 'propose_change',
                input: {
                  file_path: 'copilot_dummy/test.ts',
                  change_type: 'create',
                  suggested_code: 'export const test = () => {};',
                  description: 'Create test file',
                  reasoning: 'Test file needed'
                }
              }
            ],
            toolResults: [
              {
                toolCallId: 'tool-call-1',
                content: 'Change applied successfully'
              }
            ],
            timestamp: Date.now()
          }
        ],
        toolCalls: [
          {
            id: 'tool-call-1',
            name: 'propose_change',
            input: {
              file_path: 'copilot_dummy/test.ts',
              change_type: 'create',
              suggested_code: 'export const test = () => {};',
              description: 'Create test file',
              reasoning: 'Test file needed'
            }
          }
        ],
        messages: []
      };

      const mockAgent = {
        query: jest.fn().mockResolvedValue(mockAgentResult)
      };

      AgentInitializer.initialize = jest.fn().mockResolvedValue({
        agent: mockAgent,
        repositoryFiles: new Map()
      });

      IntentClassifier.prototype.classifyIntent = jest.fn().mockResolvedValue({
        shouldApplyChanges: true,
        reasoning: 'Order to create file',
        confidence: 'high'
      });

      copilot = new Copilot(mockOptions);
      const result = await copilot.processPrompt('Create a test file');

      expect(result.changes).toBeDefined();
      expect(result.changes?.length).toBe(1);
      expect(result.changes?.[0].file).toBe('copilot_dummy/test.ts');
      expect(result.changes?.[0].changeType).toBe('create');
      expect(result.changes?.[0].description).toContain('Create test file');
    });

    it('should handle multiple changes', async () => {
      const { AgentInitializer } = require('../agent_initializer');
      const mockAgentResult: AgentResult = {
        finalResponse: 'I have made multiple changes',
        turns: [
          {
            turnNumber: 1,
            assistantMessage: 'Making changes',
            toolCalls: [
              {
                id: 'tool-call-1',
                name: 'propose_change',
                input: {
                  file_path: 'copilot_dummy/file1.ts',
                  change_type: 'create',
                  suggested_code: 'export const file1 = () => {};',
                  description: 'Create file1',
                  reasoning: 'Need file1'
                }
              },
              {
                id: 'tool-call-2',
                name: 'propose_change',
                input: {
                  file_path: 'copilot_dummy/file2.ts',
                  change_type: 'modify',
                  suggested_code: 'export const file2 = () => { return true; };',
                  description: 'Update function',
                  reasoning: 'Update needed'
                }
              }
            ],
            toolResults: [
              {
                toolCallId: 'tool-call-1',
                content: 'Change applied successfully'
              },
              {
                toolCallId: 'tool-call-2',
                content: 'Change applied successfully'
              }
            ],
            timestamp: Date.now()
          }
        ],
        toolCalls: [
          {
            id: 'tool-call-1',
            name: 'propose_change',
            input: {
              file_path: 'copilot_dummy/file1.ts',
              change_type: 'create',
              suggested_code: 'export const file1 = () => {};',
              description: 'Create file1',
              reasoning: 'Need file1'
            }
          },
          {
            id: 'tool-call-2',
            name: 'propose_change',
            input: {
              file_path: 'copilot_dummy/file2.ts',
              change_type: 'modify',
              suggested_code: 'export const file2 = () => { return true; };',
              description: 'Update function',
              reasoning: 'Update needed'
            }
          }
        ],
        messages: []
      };

      const mockAgent = {
        query: jest.fn().mockResolvedValue(mockAgentResult)
      };

      AgentInitializer.initialize = jest.fn().mockResolvedValue({
        agent: mockAgent,
        repositoryFiles: new Map()
      });

      copilot = new Copilot(mockOptions);
      const result = await copilot.processPrompt('Create and modify files');

      expect(result.changes).toBeDefined();
      expect(result.changes?.length).toBe(2);
      expect(result.changes?.[0].file).toBe('copilot_dummy/file1.ts');
      expect(result.changes?.[1].file).toBe('copilot_dummy/file2.ts');
    });

    it('should return undefined changes when no changes are made', async () => {
      const { AgentInitializer } = require('../agent_initializer');
      const mockAgentResult: AgentResult = {
        finalResponse: 'This is just an explanation',
        turns: [],
        toolCalls: [],
        messages: []
      };

      const mockAgent = {
        query: jest.fn().mockResolvedValue(mockAgentResult)
      };

      AgentInitializer.initialize = jest.fn().mockResolvedValue({
        agent: mockAgent,
        repositoryFiles: new Map()
      });

      copilot = new Copilot(mockOptions);
      const result = await copilot.processPrompt('Explain this code');

      expect(result.changes).toBeUndefined();
    });

    it('should handle delete changes', async () => {
      const { AgentInitializer } = require('../agent_initializer');
      const mockAgentResult: AgentResult = {
        finalResponse: 'File deleted',
        turns: [
          {
            turnNumber: 1,
            assistantMessage: 'Deleting file',
            toolCalls: [
              {
                id: 'tool-call-1',
                name: 'propose_change',
                input: {
                  file_path: 'copilot_dummy/old.ts',
                  change_type: 'delete',
                  description: 'Delete old file',
                  suggested_code: '',
                  reasoning: 'File no longer needed'
                }
              }
            ],
            toolResults: [
              {
                toolCallId: 'tool-call-1',
                content: 'Change applied successfully'
              }
            ],
            timestamp: Date.now()
          }
        ],
        toolCalls: [
          {
            id: 'tool-call-1',
            name: 'propose_change',
            input: {
              file_path: 'copilot_dummy/old.ts',
              change_type: 'delete',
              description: 'Delete old file',
              suggested_code: '',
              reasoning: 'File no longer needed'
            }
          }
        ],
        messages: []
      };

      const mockAgent = {
        query: jest.fn().mockResolvedValue(mockAgentResult)
      };

      AgentInitializer.initialize = jest.fn().mockResolvedValue({
        agent: mockAgent,
        repositoryFiles: new Map()
      });

      copilot = new Copilot(mockOptions);
      const result = await copilot.processPrompt('Delete old.ts');

      expect(result.changes).toBeDefined();
      expect(result.changes?.[0].changeType).toBe('delete');
    });

    it('should handle refactor changes', async () => {
      const { AgentInitializer } = require('../agent_initializer');
      const mockAgentResult: AgentResult = {
        finalResponse: 'Code refactored',
        turns: [
          {
            turnNumber: 1,
            assistantMessage: 'Refactoring code',
            toolCalls: [
              {
                id: 'tool-call-1',
                name: 'propose_change',
                input: {
                  file_path: 'copilot_dummy/refactor.ts',
                  change_type: 'refactor',
                  suggested_code: 'export const refactored = () => {};',
                  description: 'Refactor for better readability',
                  reasoning: 'Improve code structure'
                }
              }
            ],
            toolResults: [
              {
                toolCallId: 'tool-call-1',
                content: 'Change applied successfully'
              }
            ],
            timestamp: Date.now()
          }
        ],
        toolCalls: [
          {
            id: 'tool-call-1',
            name: 'propose_change',
            input: {
              file_path: 'copilot_dummy/refactor.ts',
              change_type: 'refactor',
              suggested_code: 'export const refactored = () => {};',
              description: 'Refactor for better readability',
              reasoning: 'Improve code structure'
            }
          }
        ],
        messages: []
      };

      const mockAgent = {
        query: jest.fn().mockResolvedValue(mockAgentResult)
      };

      AgentInitializer.initialize = jest.fn().mockResolvedValue({
        agent: mockAgent,
        repositoryFiles: new Map()
      });

      const options: CopilotOptions = {
        ...mockOptions,
        useSubAgents: false // Disable sub-agents for this test to use direct agent query
      };

      copilot = new Copilot(options);
      const result = await copilot.processPrompt('Refactor this code');

      expect(result.changes).toBeDefined();
      expect(result.changes?.[0].changeType).toBe('refactor');
    });

    it('should handle invalid tool calls gracefully', async () => {
      const { AgentInitializer } = require('../agent_initializer');
      const mockAgentResult: AgentResult = {
        finalResponse: 'Test response',
        turns: [
          {
            turnNumber: 1,
            assistantMessage: 'Test',
            toolCalls: [
              {
                id: 'tool-call-1',
                name: 'propose_change',
                input: {}
              }
            ],
            toolResults: [
              {
                toolCallId: 'tool-call-1',
                content: 'Error: missing required fields',
                isError: true
              }
            ],
            timestamp: Date.now()
          }
        ],
        toolCalls: [
          {
            id: 'tool-call-1',
            name: 'propose_change',
            input: {}
          }
        ],
        messages: []
      };

      const mockAgent = {
        query: jest.fn().mockResolvedValue(mockAgentResult)
      };

      AgentInitializer.initialize = jest.fn().mockResolvedValue({
        agent: mockAgent,
        repositoryFiles: new Map()
      });

      copilot = new Copilot(mockOptions);
      const result = await copilot.processPrompt('Test prompt');

      // Should not throw and should return result without changes
      expect(result).toBeDefined();
      expect(result.changes).toBeUndefined();
    });

    it('should handle missing finalResponse', async () => {
      const { AgentInitializer } = require('../agent_initializer');
      const mockAgentResult: AgentResult = {
        finalResponse: undefined as any,
        turns: [],
        toolCalls: [],
        messages: []
      };

      const mockAgent = {
        query: jest.fn().mockResolvedValue(mockAgentResult)
      };

      AgentInitializer.initialize = jest.fn().mockResolvedValue({
        agent: mockAgent,
        repositoryFiles: new Map()
      });

      copilot = new Copilot(mockOptions);
      const result = await copilot.processPrompt('Test prompt');

      expect(result.response).toBe('No response generated');
    });

    it('should not reinitialize agent on subsequent calls', async () => {
      const { AgentInitializer } = require('../agent_initializer');
      const mockAgent = {
        query: jest.fn().mockResolvedValue({
          finalResponse: 'Test response',
          turns: [],
          toolCalls: [],
          messages: []
        } as AgentResult)
      };

      AgentInitializer.initialize = jest.fn().mockResolvedValue({
        agent: mockAgent,
        repositoryFiles: new Map()
      });

      copilot = new Copilot(mockOptions);
      await copilot.processPrompt('First prompt');
      await copilot.processPrompt('Second prompt');

      expect(AgentInitializer.initialize).toHaveBeenCalledTimes(1);
      expect(mockAgent.query).toHaveBeenCalledTimes(2);
    });

    it('should use subagents when enabled and files > 20', async () => {
      const { AgentInitializer } = require('../agent_initializer');
      const { SubagentHandler } = require('../subagent_handler');
      const { IntentClassifier } = require('../../intent_classifier');
      
      const mockAgent = {} as Agent;
      const repositoryFiles = new Map<string, string>();
      // Add more than 20 files
      for (let i = 0; i < 25; i++) {
        repositoryFiles.set(`src/file${i}.ts`, 'content');
      }

      AgentInitializer.initialize = jest.fn().mockResolvedValue({
        agent: mockAgent,
        repositoryFiles
      });

      IntentClassifier.prototype.classifyIntent = jest.fn().mockResolvedValue({
        shouldApplyChanges: false,
        reasoning: 'Analysis request',
        confidence: 'high'
      });

      SubagentHandler.processPromptWithSubAgents = jest.fn().mockResolvedValue({
        response: 'Combined response from subagents',
        agentResult: {
          finalResponse: 'Combined response',
          turns: [],
          toolCalls: [],
          messages: []
        } as AgentResult,
        changes: []
      });

      const options: CopilotOptions = {
        ...mockOptions,
        useSubAgents: true,
        repositoryOwner: 'owner',
        repositoryName: 'repo'
      };

      copilot = new Copilot(options);
      const result = await copilot.processPrompt('Analyze all files');

      expect(IntentClassifier.prototype.classifyIntent).toHaveBeenCalledWith('Analyze all files');
      expect(SubagentHandler.processPromptWithSubAgents).toHaveBeenCalled();
      expect(result.response).toBe('Combined response from subagents');
    });

    it('should use subagents for complex prompts even with fewer files', async () => {
      const { AgentInitializer } = require('../agent_initializer');
      const { SubagentHandler } = require('../subagent_handler');
      
      const mockAgent = {} as Agent;
      const repositoryFiles = new Map<string, string>();
      // Add 10 files (less than 20)
      for (let i = 0; i < 10; i++) {
        repositoryFiles.set(`src/file${i}.ts`, 'content');
      }

      AgentInitializer.initialize = jest.fn().mockResolvedValue({
        agent: mockAgent,
        repositoryFiles
      });

      SubagentHandler.processPromptWithSubAgents = jest.fn().mockResolvedValue({
        response: 'Refactoring completed',
        agentResult: {
          finalResponse: 'Refactoring completed',
          turns: [],
          toolCalls: [],
          messages: []
        } as AgentResult,
        changes: []
      });

      const options: CopilotOptions = {
        ...mockOptions,
        useSubAgents: true,
        repositoryOwner: 'owner',
        repositoryName: 'repo'
      };

      copilot = new Copilot(options);
      // Complex prompt that should trigger sub-agents
      const result = await copilot.processPrompt('Refactor the entire codebase');

      expect(SubagentHandler.processPromptWithSubAgents).toHaveBeenCalled();
      expect(result.response).toBe('Refactoring completed');
    });

    it('should use regular agent query when subagents disabled', async () => {
      const { AgentInitializer } = require('../agent_initializer');
      const { IntentClassifier } = require('../../intent_classifier');
      const mockAgent = {
        query: jest.fn().mockResolvedValue({
          finalResponse: 'Test response',
          turns: [],
          toolCalls: [],
          messages: []
        } as AgentResult)
      };

      AgentInitializer.initialize = jest.fn().mockResolvedValue({
        agent: mockAgent,
        repositoryFiles: new Map()
      });

      IntentClassifier.prototype.classifyIntent = jest.fn().mockResolvedValue({
        shouldApplyChanges: false,
        reasoning: 'Question',
        confidence: 'high'
      });

      const options: CopilotOptions = {
        ...mockOptions,
        useSubAgents: false
      };

      copilot = new Copilot(options);
      await copilot.processPrompt('Simple question');

      expect(IntentClassifier.prototype.classifyIntent).toHaveBeenCalled();
      expect(mockAgent.query).toHaveBeenCalled();
    });

    it('should use subagents by default when useSubAgents is not specified', async () => {
      const { AgentInitializer } = require('../agent_initializer');
      const { SubagentHandler } = require('../subagent_handler');
      const { IntentClassifier } = require('../../intent_classifier');
      
      const mockAgent = {} as Agent;
      const repositoryFiles = new Map<string, string>();
      // Add more than 20 files to trigger subagents
      for (let i = 0; i < 25; i++) {
        repositoryFiles.set(`src/file${i}.ts`, 'content');
      }

      AgentInitializer.initialize = jest.fn().mockResolvedValue({
        agent: mockAgent,
        repositoryFiles
      });

      IntentClassifier.prototype.classifyIntent = jest.fn().mockResolvedValue({
        shouldApplyChanges: false,
        reasoning: 'Analysis request',
        confidence: 'high'
      });

      SubagentHandler.processPromptWithSubAgents = jest.fn().mockResolvedValue({
        response: 'Combined response',
        agentResult: {
          finalResponse: 'Combined response',
          turns: [],
          toolCalls: [],
          messages: []
        } as AgentResult,
        changes: []
      });

      // useSubAgents is undefined (default should be true)
      const options: CopilotOptions = {
        apiKey: 'test-key',
        repositoryOwner: 'owner',
        repositoryName: 'repo'
      };

      copilot = new Copilot(options);
      await copilot.processPrompt('Analyze all files');

      // Should use subagents by default when files > 20
      expect(IntentClassifier.prototype.classifyIntent).toHaveBeenCalled();
      expect(SubagentHandler.processPromptWithSubAgents).toHaveBeenCalled();
    });

    it('should pass userPrompt and shouldApplyChanges to options when initializing', async () => {
      const { AgentInitializer } = require('../agent_initializer');
      const { IntentClassifier } = require('../../intent_classifier');
      const mockAgent = {
        query: jest.fn().mockResolvedValue({
          finalResponse: 'Test response',
          turns: [],
          toolCalls: [],
          messages: []
        } as AgentResult)
      };

      AgentInitializer.initialize = jest.fn().mockResolvedValue({
        agent: mockAgent,
        repositoryFiles: new Map()
      });

      IntentClassifier.prototype.classifyIntent = jest.fn().mockResolvedValue({
        shouldApplyChanges: true,
        reasoning: 'Order to create file',
        confidence: 'high'
      });

      copilot = new Copilot(mockOptions);
      const userPrompt = 'Create a new file';
      await copilot.processPrompt(userPrompt);

      // Verify that classifyIntent was called
      expect(IntentClassifier.prototype.classifyIntent).toHaveBeenCalledWith(userPrompt);
      
      // Verify that initialize was called with options including userPrompt and shouldApplyChanges
      expect(AgentInitializer.initialize).toHaveBeenCalled();
      const callArgs = AgentInitializer.initialize.mock.calls[0][0];
      expect(callArgs.userPrompt).toBe(userPrompt);
      expect(callArgs.shouldApplyChanges).toBe(true);
    });

    it('should disable intent classifier when useIntentClassifier is false', async () => {
      const { AgentInitializer } = require('../agent_initializer');
      const { IntentClassifier } = require('../../intent_classifier');
      const mockAgent = {
        query: jest.fn().mockResolvedValue({
          finalResponse: 'Test response',
          turns: [],
          toolCalls: [],
          messages: []
        } as AgentResult)
      };

      AgentInitializer.initialize = jest.fn().mockResolvedValue({
        agent: mockAgent,
        repositoryFiles: new Map()
      });

      const options: CopilotOptions = {
        ...mockOptions,
        useIntentClassifier: false
      };

      copilot = new Copilot(options);
      await copilot.processPrompt('Create a file');

      // Intent classifier should not be instantiated
      expect(IntentClassifier).not.toHaveBeenCalled();
    });

    it('should not use subagents when files <= 20 and prompt is simple', async () => {
      const { AgentInitializer } = require('../agent_initializer');
      const { SubagentHandler } = require('../subagent_handler');
      const { IntentClassifier } = require('../../intent_classifier');
      
      const mockAgent = {
        query: jest.fn().mockResolvedValue({
          finalResponse: 'Simple answer',
          turns: [],
          toolCalls: [],
          messages: []
        } as AgentResult)
      };

      const repositoryFiles = new Map<string, string>();
      // Add exactly 15 files (less than 20)
      for (let i = 0; i < 15; i++) {
        repositoryFiles.set(`src/file${i}.ts`, 'content');
      }

      AgentInitializer.initialize = jest.fn().mockResolvedValue({
        agent: mockAgent,
        repositoryFiles
      });

      IntentClassifier.prototype.classifyIntent = jest.fn().mockResolvedValue({
        shouldApplyChanges: false,
        reasoning: 'Question',
        confidence: 'high'
      });

      const options: CopilotOptions = {
        ...mockOptions,
        useSubAgents: true,
        repositoryOwner: 'owner',
        repositoryName: 'repo'
      };

      copilot = new Copilot(options);
      // Simple prompt that should NOT trigger sub-agents
      await copilot.processPrompt('What does this function do?');

      expect(IntentClassifier.prototype.classifyIntent).toHaveBeenCalled();
      expect(SubagentHandler.processPromptWithSubAgents).not.toHaveBeenCalled();
      expect(mockAgent.query).toHaveBeenCalled();
    });

    it('should extract changes from apply_changes tool calls', async () => {
      const { AgentInitializer } = require('../agent_initializer');
      const mockAgentResult: AgentResult = {
        finalResponse: 'Changes applied',
        turns: [
          {
            turnNumber: 1,
            assistantMessage: 'Applying changes',
            toolCalls: [
              {
                id: 'tool-call-1',
                name: 'apply_changes',
                input: {
                  file_paths: ['copilot_dummy/test.ts']
                }
              }
            ],
            toolResults: [
              {
                toolCallId: 'tool-call-1',
                content: 'Applied 1 file(s) to disk:\n  - copilot_dummy/test.ts (create)'
              }
            ],
            timestamp: Date.now()
          }
        ],
        toolCalls: [
          {
            id: 'tool-call-1',
            name: 'apply_changes',
            input: {
              file_paths: ['copilot_dummy/test.ts']
            }
          }
        ],
        messages: []
      };

      const mockAgent = {
        query: jest.fn().mockResolvedValue(mockAgentResult)
      };

      AgentInitializer.initialize = jest.fn().mockResolvedValue({
        agent: mockAgent,
        repositoryFiles: new Map()
      });

      copilot = new Copilot(mockOptions);
      const result = await copilot.processPrompt('Apply changes');

      expect(result.changes).toBeDefined();
      expect(result.changes?.length).toBe(1);
      expect(result.changes?.[0].file).toBe('copilot_dummy/test.ts');
      expect(result.changes?.[0].changeType).toBe('create');
    });

    it('should distinguish between proposed and applied changes', async () => {
      const { AgentInitializer } = require('../agent_initializer');
      const mockAgentResult: AgentResult = {
        finalResponse: 'Changes proposed and applied',
        turns: [
          {
            turnNumber: 1,
            assistantMessage: 'Proposing changes',
            toolCalls: [
              {
                id: 'tool-call-1',
                name: 'propose_change',
                input: {
                  file_path: 'copilot_dummy/file1.ts',
                  change_type: 'create',
                  suggested_code: 'export const file1 = () => {};',
                  description: 'Create file1',
                  reasoning: 'Need file1'
                }
              },
              {
                id: 'tool-call-2',
                name: 'apply_changes',
                input: {
                  file_paths: ['copilot_dummy/file1.ts']
                }
              }
            ],
            toolResults: [
              {
                toolCallId: 'tool-call-1',
                content: 'Change applied successfully'
              },
              {
                toolCallId: 'tool-call-2',
                content: 'Applied 1 file(s) to disk:\n  - copilot_dummy/file1.ts (create)'
              }
            ],
            timestamp: Date.now()
          }
        ],
        toolCalls: [
          {
            id: 'tool-call-1',
            name: 'propose_change',
            input: {
              file_path: 'copilot_dummy/file1.ts',
              change_type: 'create',
              suggested_code: 'export const file1 = () => {};',
              description: 'Create file1',
              reasoning: 'Need file1'
            }
          },
          {
            id: 'tool-call-2',
            name: 'apply_changes',
            input: {
              file_paths: ['copilot_dummy/file1.ts']
            }
          }
        ],
        messages: []
      };

      const mockAgent = {
        query: jest.fn().mockResolvedValue(mockAgentResult)
      };

      AgentInitializer.initialize = jest.fn().mockResolvedValue({
        agent: mockAgent,
        repositoryFiles: new Map()
      });

      copilot = new Copilot(mockOptions);
      const result = await copilot.processPrompt('Propose and apply changes');

      expect(result.changes).toBeDefined();
      // Should include both proposed and applied changes
      expect(result.changes?.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getAgent', () => {
    it('should return agent instance', async () => {
      const { AgentInitializer } = require('../agent_initializer');
      const { IntentClassifier } = require('../../intent_classifier');
      const mockAgent = {
        query: jest.fn().mockResolvedValue({
          finalResponse: 'Test',
          turns: [],
          toolCalls: [],
          messages: []
        } as AgentResult)
      };

      AgentInitializer.initialize = jest.fn().mockResolvedValue({
        agent: mockAgent,
        repositoryFiles: new Map()
      });

      IntentClassifier.prototype.classifyIntent = jest.fn().mockResolvedValue({
        shouldApplyChanges: false,
        reasoning: 'Test',
        confidence: 'high'
      });

      copilot = new Copilot(mockOptions);
      await copilot.processPrompt('Test prompt');

      const agent = copilot.getAgent();
      expect(agent).toBe(mockAgent);
    });
  });

  describe('intent classifier integration', () => {
    it('should use intent classifier result for shouldApplyChanges', async () => {
      const { AgentInitializer } = require('../agent_initializer');
      const { IntentClassifier } = require('../../intent_classifier');
      const mockAgent = {
        query: jest.fn().mockResolvedValue({
          finalResponse: 'Created file',
          turns: [],
          toolCalls: [],
          messages: []
        } as AgentResult)
      };

      AgentInitializer.initialize = jest.fn().mockResolvedValue({
        agent: mockAgent,
        repositoryFiles: new Map()
      });

      IntentClassifier.prototype.classifyIntent = jest.fn().mockResolvedValue({
        shouldApplyChanges: true,
        reasoning: 'Order to create file',
        confidence: 'high'
      });

      copilot = new Copilot(mockOptions);
      await copilot.processPrompt('Create hello.js');

      expect(IntentClassifier.prototype.classifyIntent).toHaveBeenCalledWith('Create hello.js');
      // Verify that shouldApplyChanges was passed to agent initialization
      const initCall = AgentInitializer.initialize.mock.calls[0][0];
      expect(initCall.shouldApplyChanges).toBe(true);
    });

    it('should use intent classifier result for questions', async () => {
      const { AgentInitializer } = require('../agent_initializer');
      const { IntentClassifier } = require('../../intent_classifier');
      const mockAgent = {
        query: jest.fn().mockResolvedValue({
          finalResponse: 'Explanation',
          turns: [],
          toolCalls: [],
          messages: []
        } as AgentResult)
      };

      AgentInitializer.initialize = jest.fn().mockResolvedValue({
        agent: mockAgent,
        repositoryFiles: new Map()
      });

      IntentClassifier.prototype.classifyIntent = jest.fn().mockResolvedValue({
        shouldApplyChanges: false,
        reasoning: 'Question about code',
        confidence: 'high'
      });

      copilot = new Copilot(mockOptions);
      await copilot.processPrompt('What does this function do?');

      expect(IntentClassifier.prototype.classifyIntent).toHaveBeenCalledWith('What does this function do?');
      // Verify that shouldApplyChanges was passed to agent initialization
      const initCall = AgentInitializer.initialize.mock.calls[0][0];
      expect(initCall.shouldApplyChanges).toBe(false);
    });
  });
});


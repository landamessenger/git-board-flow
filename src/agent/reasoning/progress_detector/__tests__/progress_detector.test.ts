/**
 * Tests for Progress Detector
 */

import { ProgressDetector } from '../progress_detector';
import { ProgressDetectionOptions } from '../types';
import { Agent } from '../../../core/agent';
import { AgentResult } from '../../../types';

// Mock dependencies
jest.mock('../agent_initializer');
jest.mock('../subagent_handler');
jest.mock('../../../core/agent');

describe('ProgressDetector', () => {
  let detector: ProgressDetector;
  let mockOptions: ProgressDetectionOptions;

  beforeEach(() => {
    mockOptions = {
      serverUrl: 'http://localhost:4096',
      model: 'test-model',
      maxTurns: 10,
      repositoryOwner: 'test-owner',
      repositoryName: 'test-repo',
      repositoryBranch: 'feature/123',
      issueNumber: 123,
      issueDescription: 'Test task description',
      changedFiles: [
        {
          filename: 'src/test.ts',
          status: 'modified',
          additions: 10,
          deletions: 5
        }
      ]
    };

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided options', () => {
      detector = new ProgressDetector(mockOptions);

      expect(detector).toBeDefined();
      expect(detector.getAgent).toBeDefined();
    });

    it('should use default model from environment if not provided', () => {
      const originalEnv = process.env.OPENCODE_MODEL;
      process.env.OPENCODE_MODEL = 'env-model';

      const options: ProgressDetectionOptions = {
        serverUrl: 'http://localhost:4096',
        repositoryOwner: 'owner',
        repositoryName: 'repo',
        repositoryBranch: 'branch'
      };

      detector = new ProgressDetector(options);

      expect(detector).toBeDefined();
      
      if (originalEnv) {
        process.env.OPENCODE_MODEL = originalEnv;
      } else {
        delete process.env.OPENCODE_MODEL;
      }
    });

    it('should set default maxTurns if not provided', () => {
      const options: ProgressDetectionOptions = {
        serverUrl: 'http://localhost:4096',
        repositoryOwner: 'owner',
        repositoryName: 'repo',
        repositoryBranch: 'branch'
      };

      detector = new ProgressDetector(options);

      expect(detector).toBeDefined();
    });

    it('should set default developmentBranch if not provided', () => {
      const options: ProgressDetectionOptions = {
        serverUrl: 'http://localhost:4096',
        repositoryOwner: 'owner',
        repositoryName: 'repo',
        repositoryBranch: 'branch'
      };

      detector = new ProgressDetector(options);

      expect(detector).toBeDefined();
    });
  });

  describe('detectProgress', () => {
    it('should initialize agent on first call', async () => {
      const { AgentInitializer } = require('../agent_initializer');
      const mockAgent = {
        query: jest.fn().mockResolvedValue({
          finalResponse: 'Test response',
          turns: [],
          toolCalls: [
            {
              id: 'tool-call-1',
              name: 'report_progress',
              input: {
                progress: 75,
                summary: 'Test summary'
              }
            }
          ],
          messages: []
        } as AgentResult)
      };

      AgentInitializer.initialize = jest.fn().mockResolvedValue({
        agent: mockAgent,
        repositoryFiles: new Map()
      });

      detector = new ProgressDetector(mockOptions);
      await detector.detectProgress();

      expect(AgentInitializer.initialize).toHaveBeenCalled();
    });

    it('should execute agent query', async () => {
      const { AgentInitializer } = require('../agent_initializer');
      const mockAgent = {
        query: jest.fn().mockResolvedValue({
          finalResponse: 'Test response',
          turns: [],
          toolCalls: [
            {
              id: 'tool-call-1',
              name: 'report_progress',
              input: {
                progress: 80,
                summary: 'Task is mostly complete'
              }
            }
          ],
          messages: []
        } as AgentResult)
      };

      AgentInitializer.initialize = jest.fn().mockResolvedValue({
        agent: mockAgent,
        repositoryFiles: new Map()
      });

      detector = new ProgressDetector(mockOptions);
      await detector.detectProgress();

      expect(mockAgent.query).toHaveBeenCalled();
    });

    it('should parse progress and return result', async () => {
      const { AgentInitializer } = require('../agent_initializer');
      const mockAgent = {
        query: jest.fn().mockResolvedValue({
          finalResponse: 'Test response',
          turns: [],
          toolCalls: [
            {
              id: 'tool-call-1',
              name: 'report_progress',
              input: {
                progress: 65,
                summary: 'Core functionality implemented, tests pending'
              }
            }
          ],
          messages: []
        } as AgentResult)
      };

      AgentInitializer.initialize = jest.fn().mockResolvedValue({
        agent: mockAgent,
        repositoryFiles: new Map()
      });

      detector = new ProgressDetector(mockOptions);
      const result = await detector.detectProgress();

      expect(result.progress).toBe(65);
      expect(result.summary).toBe('Core functionality implemented, tests pending');
      expect(result.agentResult).toBeDefined();
    });

    it('should handle custom prompt', async () => {
      const { AgentInitializer } = require('../agent_initializer');
      const mockAgent = {
        query: jest.fn().mockResolvedValue({
          finalResponse: 'Test response',
          turns: [],
          toolCalls: [
            {
              id: 'tool-call-1',
              name: 'report_progress',
              input: {
                progress: 50,
                summary: 'Halfway done'
              }
            }
          ],
          messages: []
        } as AgentResult)
      };

      AgentInitializer.initialize = jest.fn().mockResolvedValue({
        agent: mockAgent,
        repositoryFiles: new Map()
      });

      detector = new ProgressDetector(mockOptions);
      const customPrompt = 'Analyze progress for issue #123';
      await detector.detectProgress(customPrompt);

      expect(mockAgent.query).toHaveBeenCalledWith(customPrompt);
    });

    it('should use default prompt if not provided', async () => {
      const { AgentInitializer } = require('../agent_initializer');
      const mockAgent = {
        query: jest.fn().mockResolvedValue({
          finalResponse: 'Test response',
          turns: [],
          toolCalls: [
            {
              id: 'tool-call-1',
              name: 'report_progress',
              input: {
                progress: 100,
                summary: 'Task complete'
              }
            }
          ],
          messages: []
        } as AgentResult)
      };

      AgentInitializer.initialize = jest.fn().mockResolvedValue({
        agent: mockAgent,
        repositoryFiles: new Map()
      });

      detector = new ProgressDetector(mockOptions);
      await detector.detectProgress();

      expect(mockAgent.query).toHaveBeenCalled();
      const callArgs = mockAgent.query.mock.calls[0][0];
      expect(callArgs).toContain('issue #123');
    });

    it('should use subagents when enabled and files > 20', async () => {
      const { AgentInitializer } = require('../agent_initializer');
      const { SubagentHandler } = require('../subagent_handler');
      
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

      SubagentHandler.detectProgressWithSubAgents = jest.fn().mockResolvedValue({
        progress: 75,
        summary: 'Combined progress from subagents',
        agentResult: {
          finalResponse: 'Test',
          turns: [],
          toolCalls: [],
          messages: []
        } as AgentResult
      });

      const options: ProgressDetectionOptions = {
        ...mockOptions,
        useSubAgents: true
      };

      detector = new ProgressDetector(options);
      const result = await detector.detectProgress();

      expect(SubagentHandler.detectProgressWithSubAgents).toHaveBeenCalled();
      expect(result.progress).toBe(75);
    });

    it('should use regular agent query when subagents disabled', async () => {
      const { AgentInitializer } = require('../agent_initializer');
      const mockAgent = {
        query: jest.fn().mockResolvedValue({
          finalResponse: 'Test response',
          turns: [],
          toolCalls: [
            {
              id: 'tool-call-1',
              name: 'report_progress',
              input: {
                progress: 50,
                summary: 'Halfway done'
              }
            }
          ],
          messages: []
        } as AgentResult)
      };

      AgentInitializer.initialize = jest.fn().mockResolvedValue({
        agent: mockAgent,
        repositoryFiles: new Map()
      });

      const options: ProgressDetectionOptions = {
        ...mockOptions,
        useSubAgents: false
      };

      detector = new ProgressDetector(options);
      await detector.detectProgress();

      expect(mockAgent.query).toHaveBeenCalled();
    });

    it('should not use subagents when files <= 20 even if enabled', async () => {
      const { AgentInitializer } = require('../agent_initializer');
      const { SubagentHandler } = require('../subagent_handler');
      
      const mockAgent = {
        query: jest.fn().mockResolvedValue({
          finalResponse: 'Test response',
          turns: [],
          toolCalls: [
            {
              id: 'tool-call-1',
              name: 'report_progress',
              input: {
                progress: 60,
                summary: 'Progress report'
              }
            }
          ],
          messages: []
        } as AgentResult)
      };

      const repositoryFiles = new Map<string, string>();
      // Add exactly 20 files
      for (let i = 0; i < 20; i++) {
        repositoryFiles.set(`src/file${i}.ts`, 'content');
      }

      AgentInitializer.initialize = jest.fn().mockResolvedValue({
        agent: mockAgent,
        repositoryFiles
      });

      const options: ProgressDetectionOptions = {
        ...mockOptions,
        useSubAgents: true
      };

      detector = new ProgressDetector(options);
      await detector.detectProgress();

      expect(SubagentHandler.detectProgressWithSubAgents).not.toHaveBeenCalled();
      expect(mockAgent.query).toHaveBeenCalled();
    });

    it('should set default useSubAgents to false', () => {
      const options: ProgressDetectionOptions = {
        serverUrl: 'http://localhost:4096',
        repositoryOwner: 'owner',
        repositoryName: 'repo',
        repositoryBranch: 'branch'
      };

      detector = new ProgressDetector(options);
      expect(detector).toBeDefined();
    });

    it('should set default maxConcurrentSubAgents to 5', () => {
      const options: ProgressDetectionOptions = {
        serverUrl: 'http://localhost:4096',
        repositoryOwner: 'owner',
        repositoryName: 'repo',
        repositoryBranch: 'branch',
        useSubAgents: true
      };

      detector = new ProgressDetector(options);
      expect(detector).toBeDefined();
    });

    it('should handle empty repository files', async () => {
      const { AgentInitializer } = require('../agent_initializer');
      const mockAgent = {
        query: jest.fn().mockResolvedValue({
          finalResponse: 'Test response',
          turns: [],
          toolCalls: [
            {
              id: 'tool-call-1',
              name: 'report_progress',
              input: {
                progress: 0,
                summary: 'No files changed'
              }
            }
          ],
          messages: []
        } as AgentResult)
      };

      AgentInitializer.initialize = jest.fn().mockResolvedValue({
        agent: mockAgent,
        repositoryFiles: new Map()
      });

      detector = new ProgressDetector(mockOptions);
      const result = await detector.detectProgress();

      expect(result.progress).toBe(0);
    });

    it('should handle single file', async () => {
      const { AgentInitializer } = require('../agent_initializer');
      const mockAgent = {
        query: jest.fn().mockResolvedValue({
          finalResponse: 'Test response',
          turns: [],
          toolCalls: [
            {
              id: 'tool-call-1',
              name: 'report_progress',
              input: {
                progress: 100,
                summary: 'Single file complete'
              }
            }
          ],
          messages: []
        } as AgentResult)
      };

      const repositoryFiles = new Map<string, string>();
      repositoryFiles.set('src/single.ts', 'content');

      AgentInitializer.initialize = jest.fn().mockResolvedValue({
        agent: mockAgent,
        repositoryFiles
      });

      detector = new ProgressDetector(mockOptions);
      const result = await detector.detectProgress();

      expect(result.progress).toBe(100);
      expect(mockAgent.query).toHaveBeenCalled();
    });

    it('should handle very large number of files with subagents', async () => {
      const { AgentInitializer } = require('../agent_initializer');
      const { SubagentHandler } = require('../subagent_handler');
      
      const mockAgent = {} as Agent;
      const repositoryFiles = new Map<string, string>();
      // Add 100 files
      for (let i = 0; i < 100; i++) {
        repositoryFiles.set(`src/file${i}.ts`, 'content');
      }

      AgentInitializer.initialize = jest.fn().mockResolvedValue({
        agent: mockAgent,
        repositoryFiles
      });

      SubagentHandler.detectProgressWithSubAgents = jest.fn().mockResolvedValue({
        progress: 85,
        summary: 'Large codebase analyzed',
        agentResult: {
          finalResponse: 'Test',
          turns: [],
          toolCalls: [],
          messages: []
        } as AgentResult
      });

      const options: ProgressDetectionOptions = {
        ...mockOptions,
        useSubAgents: true,
        maxConcurrentSubAgents: 10
      };

      detector = new ProgressDetector(options);
      const result = await detector.detectProgress();

      expect(SubagentHandler.detectProgressWithSubAgents).toHaveBeenCalled();
      expect(result.progress).toBe(85);
    });

    it('should handle progress at boundaries (0% and 100%)', async () => {
      const { AgentInitializer } = require('../agent_initializer');
      
      // Test 0%
      let mockAgent = {
        query: jest.fn().mockResolvedValue({
          finalResponse: 'Test response',
          turns: [],
          toolCalls: [
            {
              id: 'tool-call-1',
              name: 'report_progress',
              input: {
                progress: 0,
                summary: 'Nothing done'
              }
            }
          ],
          messages: []
        } as AgentResult)
      };

      AgentInitializer.initialize = jest.fn().mockResolvedValue({
        agent: mockAgent,
        repositoryFiles: new Map()
      });

      detector = new ProgressDetector(mockOptions);
      let result = await detector.detectProgress();
      expect(result.progress).toBe(0);

      // Test 100%
      mockAgent = {
        query: jest.fn().mockResolvedValue({
          finalResponse: 'Test response',
          turns: [],
          toolCalls: [
            {
              id: 'tool-call-1',
              name: 'report_progress',
              input: {
                progress: 100,
                summary: 'Complete'
              }
            }
          ],
          messages: []
        } as AgentResult)
      };

      AgentInitializer.initialize = jest.fn().mockResolvedValue({
        agent: mockAgent,
        repositoryFiles: new Map()
      });

      detector = new ProgressDetector(mockOptions);
      result = await detector.detectProgress();
      expect(result.progress).toBe(100);
    });

    it('should handle missing issue number gracefully', async () => {
      const { AgentInitializer } = require('../agent_initializer');
      const mockAgent = {
        query: jest.fn().mockResolvedValue({
          finalResponse: 'Test response',
          turns: [],
          toolCalls: [
            {
              id: 'tool-call-1',
              name: 'report_progress',
              input: {
                progress: 50,
                summary: 'Progress without issue number'
              }
            }
          ],
          messages: []
        } as AgentResult)
      };

      AgentInitializer.initialize = jest.fn().mockResolvedValue({
        agent: mockAgent,
        repositoryFiles: new Map()
      });

      const options: ProgressDetectionOptions = {
        ...mockOptions,
        issueNumber: undefined
      };

      detector = new ProgressDetector(options);
      const result = await detector.detectProgress();

      expect(result.progress).toBe(50);
      const callArgs = mockAgent.query.mock.calls[0][0];
      expect(callArgs).toContain('the task');
    });

    it('should handle missing changed files', async () => {
      const { AgentInitializer } = require('../agent_initializer');
      const mockAgent = {
        query: jest.fn().mockResolvedValue({
          finalResponse: 'Test response',
          turns: [],
          toolCalls: [
            {
              id: 'tool-call-1',
              name: 'report_progress',
              input: {
                progress: 0,
                summary: 'No files changed'
              }
            }
          ],
          messages: []
        } as AgentResult)
      };

      AgentInitializer.initialize = jest.fn().mockResolvedValue({
        agent: mockAgent,
        repositoryFiles: new Map()
      });

      const options: ProgressDetectionOptions = {
        ...mockOptions,
        changedFiles: undefined
      };

      detector = new ProgressDetector(options);
      const result = await detector.detectProgress();

      expect(result.progress).toBe(0);
    });
  });

  describe('getAgent', () => {
    it('should return agent instance', async () => {
      const { AgentInitializer } = require('../agent_initializer');
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

      detector = new ProgressDetector(mockOptions);
      await detector.detectProgress();

      const agent = detector.getAgent();
      expect(agent).toBe(mockAgent);
    });
  });
});


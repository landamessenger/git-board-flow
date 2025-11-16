/**
 * Tests for Progress Detector
 */

import { ProgressDetector } from '../progress_detector';
import { ProgressDetectionOptions } from '../types';
import { Agent } from '../../../core/agent';
import { AgentResult } from '../../../types';

// Mock dependencies
jest.mock('../agent_initializer');
jest.mock('../../../core/agent');

describe('ProgressDetector', () => {
  let detector: ProgressDetector;
  let mockOptions: ProgressDetectionOptions;

  beforeEach(() => {
    mockOptions = {
      apiKey: 'test-api-key',
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
      const originalEnv = process.env.OPENROUTER_MODEL;
      process.env.OPENROUTER_MODEL = 'env-model';

      const options: ProgressDetectionOptions = {
        apiKey: 'test-key',
        repositoryOwner: 'owner',
        repositoryName: 'repo',
        repositoryBranch: 'branch'
      };

      detector = new ProgressDetector(options);

      expect(detector).toBeDefined();
      
      if (originalEnv) {
        process.env.OPENROUTER_MODEL = originalEnv;
      } else {
        delete process.env.OPENROUTER_MODEL;
      }
    });

    it('should set default maxTurns if not provided', () => {
      const options: ProgressDetectionOptions = {
        apiKey: 'test-key',
        repositoryOwner: 'owner',
        repositoryName: 'repo',
        repositoryBranch: 'branch'
      };

      detector = new ProgressDetector(options);

      expect(detector).toBeDefined();
    });

    it('should set default developmentBranch if not provided', () => {
      const options: ProgressDetectionOptions = {
        apiKey: 'test-key',
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


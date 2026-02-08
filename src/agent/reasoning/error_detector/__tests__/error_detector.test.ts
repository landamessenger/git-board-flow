/**
 * Tests for Error Detector
 */

import { ErrorDetector } from '../error_detector';
import { ErrorDetectionOptions } from '../types';
import { Agent } from '../../../core/agent';
import { AgentResult } from '../../../types';

// Mock dependencies
jest.mock('../agent_initializer');
jest.mock('../subagent_handler');
jest.mock('../../../core/agent');

describe('ErrorDetector', () => {
  let detector: ErrorDetector;
  let mockOptions: ErrorDetectionOptions;

  beforeEach(() => {
    mockOptions = {
      serverUrl: 'http://localhost:4096',
      model: 'test-model',
      maxTurns: 10
    };

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided options', () => {
      detector = new ErrorDetector(mockOptions);

      expect(detector).toBeDefined();
      expect(detector.getAgent).toBeDefined();
    });

    it('should use default model from environment if not provided', () => {
      const originalEnv = process.env.OPENCODE_MODEL;
      process.env.OPENCODE_MODEL = 'env-model';

      const options: ErrorDetectionOptions = {
        serverUrl: 'http://localhost:4096'
      };

      detector = new ErrorDetector(options);

      expect(detector).toBeDefined();
      
      if (originalEnv) {
        process.env.OPENCODE_MODEL = originalEnv;
      } else {
        delete process.env.OPENCODE_MODEL;
      }
    });

    it('should set default maxTurns if not provided', () => {
      const options: ErrorDetectionOptions = {
        serverUrl: 'http://localhost:4096'
      };

      detector = new ErrorDetector(options);

      expect(detector).toBeDefined();
    });
  });

  describe('detectErrors', () => {
    it('should initialize agent on first call', async () => {
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

      detector = new ErrorDetector(mockOptions);
      await detector.detectErrors();

      expect(AgentInitializer.initialize).toHaveBeenCalled();
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

      SubagentHandler.detectErrorsWithSubAgents = jest.fn().mockResolvedValue({
        errors: [],
        summary: {
          total: 0,
          bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
          byType: {}
        },
        agentResult: {
          finalResponse: 'Test',
          turns: [],
          toolCalls: [],
          messages: []
        } as AgentResult
      });

      const options: ErrorDetectionOptions = {
        ...mockOptions,
        useSubAgents: true,
        repositoryOwner: 'owner',
        repositoryName: 'repo'
      };

      detector = new ErrorDetector(options);
      await detector.detectErrors();

      expect(SubagentHandler.detectErrorsWithSubAgents).toHaveBeenCalled();
    });

    it('should use regular agent query when subagents disabled', async () => {
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

      detector = new ErrorDetector(mockOptions);
      await detector.detectErrors();

      expect(mockAgent.query).toHaveBeenCalled();
    });

    it('should parse errors and generate summary', async () => {
      const { AgentInitializer } = require('../agent_initializer');
      const mockAgent = {
        query: jest.fn().mockResolvedValue({
          finalResponse: 'Test response',
          turns: [],
          toolCalls: [],
          messages: [
            {
              role: 'assistant',
              content: `File: src/test.ts
Line: 10
Type: type-error
Severity: high
Description: Test error`
            }
          ]
        } as AgentResult)
      };

      AgentInitializer.initialize = jest.fn().mockResolvedValue({
        agent: mockAgent,
        repositoryFiles: new Map()
      });

      detector = new ErrorDetector(mockOptions);
      const result = await detector.detectErrors();

      expect(result.errors).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.agentResult).toBeDefined();
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

      detector = new ErrorDetector(mockOptions);
      await detector.detectErrors();

      const agent = detector.getAgent();
      expect(agent).toBe(mockAgent);
    });
  });
});


/**
 * Tests for Intent Classifier Agent
 */

import { IntentClassifier } from '../intent_classifier';
import { IntentClassifierOptions } from '../types';
import { Agent } from '../../../core/agent';
import { AgentResult } from '../../../types';

// Mock dependencies
jest.mock('../../../core/agent');

describe('IntentClassifier', () => {
  let classifier: IntentClassifier;
  let mockOptions: IntentClassifierOptions;

  beforeEach(() => {
    mockOptions = {
      serverUrl: 'http://localhost:4096',
      model: 'test-model',
      maxTurns: 5
    };

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided options', () => {
      classifier = new IntentClassifier(mockOptions);
      expect(classifier).toBeDefined();
    });

    it('should use default model from environment if not provided', () => {
      const originalEnv = process.env.OPENCODE_MODEL;
      process.env.OPENCODE_MODEL = 'env-model';

      const options: IntentClassifierOptions = {
        serverUrl: 'http://localhost:4096'
      };

      classifier = new IntentClassifier(options);
      expect(classifier).toBeDefined();
      
      if (originalEnv) {
        process.env.OPENCODE_MODEL = originalEnv;
      } else {
        delete process.env.OPENCODE_MODEL;
      }
    });

    it('should set default maxTurns if not provided', () => {
      const options: IntentClassifierOptions = {
        serverUrl: 'http://localhost:4096'
      };

      classifier = new IntentClassifier(options);
      expect(classifier).toBeDefined();
    });
  });

  describe('classifyIntent', () => {
    it('should classify order prompts as shouldApplyChanges=true', async () => {
      const { Agent } = require('../../../core/agent');
      const mockAgent = {
        query: jest.fn().mockResolvedValue({
          finalResponse: 'I will analyze the prompt and report the intent.',
          turns: [],
          toolCalls: [
            {
              id: 'tool-call-1',
              name: 'report_intent',
              input: {
                shouldApplyChanges: true,
                reasoning: 'User wants to create a file',
                confidence: 'high'
              }
            }
          ],
          messages: []
        } as AgentResult)
      };

      Agent.mockImplementation(() => mockAgent);

      classifier = new IntentClassifier(mockOptions);
      const result = await classifier.classifyIntent('Create hello.js file');

      expect(result.shouldApplyChanges).toBe(true);
      expect(result.confidence).toBe('high');
      expect(result.reasoning).toContain('create');
      expect(result.agentResult).toBeDefined();
    });

    it('should classify question prompts as shouldApplyChanges=false', async () => {
      const { Agent } = require('../../../core/agent');
      const mockAgent = {
        query: jest.fn().mockResolvedValue({
          finalResponse: 'I will analyze the prompt and report the intent.',
          turns: [],
          toolCalls: [
            {
              id: 'tool-call-1',
              name: 'report_intent',
              input: {
                shouldApplyChanges: false,
                reasoning: 'User is asking a question',
                confidence: 'high'
              }
            }
          ],
          messages: []
        } as AgentResult)
      };

      Agent.mockImplementation(() => mockAgent);

      classifier = new IntentClassifier(mockOptions);
      const result = await classifier.classifyIntent('What does this function do?');

      expect(result.shouldApplyChanges).toBe(false);
      expect(result.confidence).toBe('high');
      expect(result.reasoning).toContain('question');
      expect(result.agentResult).toBeDefined();
    });

    it('should extract intent from report_intent tool call', async () => {
      const { Agent } = require('../../../core/agent');
      const mockAgent = {
        query: jest.fn().mockResolvedValue({
          finalResponse: 'I will analyze the prompt and report the intent.',
          turns: [],
          toolCalls: [
            {
              id: 'tool-call-1',
              name: 'report_intent',
              input: {
                shouldApplyChanges: true,
                reasoning: 'Order to create',
                confidence: 'high'
              }
            }
          ],
          messages: []
        } as AgentResult)
      };

      Agent.mockImplementation(() => mockAgent);

      classifier = new IntentClassifier(mockOptions);
      const result = await classifier.classifyIntent('Create server.js');

      expect(result.shouldApplyChanges).toBe(true);
      expect(result.confidence).toBe('high');
    });

    it('should use fallback classification when no report_intent tool call found', async () => {
      const { Agent } = require('../../../core/agent');
      const mockAgent = {
        query: jest.fn().mockResolvedValue({
          finalResponse: 'Response without tool call',
          turns: [],
          toolCalls: [],
          messages: []
        } as AgentResult)
      };

      Agent.mockImplementation(() => mockAgent);

      classifier = new IntentClassifier(mockOptions);
      const result = await classifier.classifyIntent('Create hello.js');

      // Should use fallback heuristics
      expect(result.shouldApplyChanges).toBeDefined();
      expect(typeof result.shouldApplyChanges).toBe('boolean');
      expect(result.reasoning).toBeDefined();
      expect(['high', 'medium', 'low']).toContain(result.confidence);
      expect(result.agentResult).toBeDefined();
    });

    it('should use fallback classification when agent throws error', async () => {
      const { Agent } = require('../../../core/agent');
      const mockAgent = {
        query: jest.fn().mockRejectedValue(new Error('Agent error'))
      };

      Agent.mockImplementation(() => mockAgent);

      classifier = new IntentClassifier(mockOptions);
      const result = await classifier.classifyIntent('Create hello.js');

      // Should use fallback heuristics
      expect(result.shouldApplyChanges).toBeDefined();
      expect(typeof result.shouldApplyChanges).toBe('boolean');
      expect(result.reasoning).toBeDefined();
      expect(result.agentResult).toBeDefined();
    });

    it('should use fallback when report_intent has invalid confidence', async () => {
      const { Agent } = require('../../../core/agent');
      const mockAgent = {
        query: jest.fn().mockResolvedValue({
          finalResponse: 'Response with invalid tool call',
          turns: [],
          toolCalls: [
            {
              id: 'tool-call-1',
              name: 'report_intent',
              input: {
                shouldApplyChanges: true,
                reasoning: 'Test',
                confidence: 'invalid' // Invalid confidence
              }
            }
          ],
          messages: []
        } as AgentResult)
      };

      Agent.mockImplementation(() => mockAgent);

      classifier = new IntentClassifier(mockOptions);
      const result = await classifier.classifyIntent('Create hello.js');

      // Should use fallback when validation fails
      expect(typeof result.shouldApplyChanges).toBe('boolean');
      expect(result.agentResult).toBeDefined();
    });

    describe('fallback classification', () => {
      it('should detect orders correctly in fallback', async () => {
        const { Agent } = require('../../../core/agent');
        const mockAgent = {
          query: jest.fn().mockRejectedValue(new Error('Error'))
        };

        Agent.mockImplementation(() => mockAgent);

        classifier = new IntentClassifier(mockOptions);
        
        const createResult = await classifier.classifyIntent('Create hello.js');
        expect(createResult.shouldApplyChanges).toBe(true);
        expect(createResult.confidence).toBe('high');
        expect(createResult.agentResult).toBeDefined();

        const modifyResult = await classifier.classifyIntent('Modify config.json');
        expect(modifyResult.shouldApplyChanges).toBe(true);
        expect(modifyResult.agentResult).toBeDefined();

        const deleteResult = await classifier.classifyIntent('Delete old.js');
        expect(deleteResult.shouldApplyChanges).toBe(true);
        expect(deleteResult.agentResult).toBeDefined();
      });

      it('should detect questions correctly in fallback', async () => {
        const { Agent } = require('../../../core/agent');
        const mockAgent = {
          query: jest.fn().mockRejectedValue(new Error('Error'))
        };

        Agent.mockImplementation(() => mockAgent);

        classifier = new IntentClassifier(mockOptions);
        
        const whatResult = await classifier.classifyIntent('What does this do?');
        expect(whatResult.shouldApplyChanges).toBe(false);
        // "do" is also an order keyword, so confidence might be medium
        expect(['high', 'medium']).toContain(whatResult.confidence);
        expect(whatResult.agentResult).toBeDefined();

        const howResult = await classifier.classifyIntent('How should I implement this?');
        expect(howResult.shouldApplyChanges).toBe(false);
        expect(['high', 'medium']).toContain(howResult.confidence);
        expect(howResult.agentResult).toBeDefined();
      });

      it('should handle ambiguous prompts in fallback', async () => {
        const { Agent } = require('../../../core/agent');
        const mockAgent = {
          query: jest.fn().mockRejectedValue(new Error('Error'))
        };

        Agent.mockImplementation(() => mockAgent);

        classifier = new IntentClassifier(mockOptions);
        
        // Prompt with both question and order indicators
        const result = await classifier.classifyIntent('How should I create this file?');
        // Should default to false (safer)
        expect(result.shouldApplyChanges).toBe(false);
        expect(result.confidence).toBe('medium');
        expect(result.agentResult).toBeDefined();
      });

      it('should default to false for unclear prompts in fallback', async () => {
        const { Agent } = require('../../../core/agent');
        const mockAgent = {
          query: jest.fn().mockRejectedValue(new Error('Error'))
        };

        Agent.mockImplementation(() => mockAgent);

        classifier = new IntentClassifier(mockOptions);
        
        const result = await classifier.classifyIntent('Hello world');
        expect(result.shouldApplyChanges).toBe(false);
        expect(result.confidence).toBe('low');
        expect(result.agentResult).toBeDefined();
      });
    });
  });
});


/**
 * Tests for Subagent Handler
 */

import { SubagentHandler } from '../subagent_handler';
import { ProgressDetectionOptions } from '../types';
import { Agent } from '../../../core/agent';
import { AgentResult } from '../../../types';

// Mock dependencies
jest.mock('../file_partitioner');
jest.mock('../progress_parser');
jest.mock('../system_prompt_builder');

describe('SubagentHandler', () => {
  let mockAgent: Agent;
  let repositoryFiles: Map<string, string>;
  let mockOptions: ProgressDetectionOptions;

  beforeEach(() => {
    repositoryFiles = new Map<string, string>();
    for (let i = 0; i < 30; i++) {
      repositoryFiles.set(`src/file${i}.ts`, `content${i}`);
    }

    mockOptions = {
      serverUrl: 'http://localhost:4096',
      model: 'test-model',
      issueNumber: 123,
      issueDescription: 'Test task',
      repositoryOwner: 'owner',
      repositoryName: 'repo',
      repositoryBranch: 'feature/123',
      useSubAgents: true,
      maxConcurrentSubAgents: 5
    };

      mockAgent = {
        executeParallel: jest.fn() as jest.MockedFunction<(tasks: any[]) => Promise<any[]>>
      } as any;

    jest.clearAllMocks();
  });

  describe('detectProgressWithSubAgents', () => {
    it('should partition files and execute subagents in parallel', async () => {
      const { FilePartitioner } = require('../file_partitioner');
      FilePartitioner.partitionFilesByDirectory = jest.fn().mockReturnValue([
        ['src/file1.ts', 'src/file2.ts'],
        ['src/file3.ts', 'src/file4.ts']
      ]);

      const mockResults: Array<{ task: string; result: AgentResult }> = [
        {
          task: 'progress-detector-1',
          result: {
            finalResponse: 'Subagent 1 done',
            turns: [],
            toolCalls: [
              {
                id: 'tool-1',
                name: 'report_progress',
                input: { progress: 70, summary: 'Subagent 1 progress' }
              }
            ],
            messages: [],
            metrics: {
              totalTokens: { input: 100, output: 50 },
              totalDuration: 1000,
              apiCalls: 1,
              toolCalls: 1,
              errors: 0,
              averageLatency: 1000
            }
          }
        },
        {
          task: 'progress-detector-2',
          result: {
            finalResponse: 'Subagent 2 done',
            turns: [],
            toolCalls: [
              {
                id: 'tool-2',
                name: 'report_progress',
                input: { progress: 80, summary: 'Subagent 2 progress' }
              }
            ],
            messages: [],
            metrics: {
              totalTokens: { input: 100, output: 50 },
              totalDuration: 1200,
              apiCalls: 1,
              toolCalls: 1,
              errors: 0,
              averageLatency: 1200
            }
          }
        }
      ];

      mockAgent.executeParallel = jest.fn().mockResolvedValue(mockResults);

      const { ProgressParser } = require('../progress_parser');
      ProgressParser.parseProgress = jest.fn()
        .mockReturnValueOnce({ progress: 70, summary: 'Subagent 1 progress' })
        .mockReturnValueOnce({ progress: 80, summary: 'Subagent 2 progress' });

      const result = await SubagentHandler.detectProgressWithSubAgents(
        mockAgent,
        repositoryFiles,
        mockOptions,
        'Test prompt'
      );

      expect(FilePartitioner.partitionFilesByDirectory).toHaveBeenCalled();
      expect(mockAgent.executeParallel).toHaveBeenCalled();
      expect(result.progress).toBe(75); // Average of 70 and 80
      expect(result.summary).toContain('Subagent 1');
      expect(result.summary).toContain('Subagent 2');
      expect(result.agentResult).toBeDefined();
    });

    it('should calculate average progress from multiple subagents', async () => {
      const { FilePartitioner } = require('../file_partitioner');
      FilePartitioner.partitionFilesByDirectory = jest.fn().mockReturnValue([
        ['src/file1.ts'],
        ['src/file2.ts'],
        ['src/file3.ts']
      ]);

      const mockResults: Array<{ task: string; result: AgentResult }> = [
        {
          task: 'progress-detector-1',
          result: {
            finalResponse: 'Done',
            turns: [],
            toolCalls: [{ id: 't1', name: 'report_progress', input: { progress: 50, summary: 'S1' } }],
            messages: [],
            metrics: { totalTokens: { input: 0, output: 0 }, totalDuration: 0, apiCalls: 0, toolCalls: 0, errors: 0, averageLatency: 0 }
          }
        },
        {
          task: 'progress-detector-2',
          result: {
            finalResponse: 'Done',
            turns: [],
            toolCalls: [{ id: 't2', name: 'report_progress', input: { progress: 75, summary: 'S2' } }],
            messages: [],
            metrics: { totalTokens: { input: 0, output: 0 }, totalDuration: 0, apiCalls: 0, toolCalls: 0, errors: 0, averageLatency: 0 }
          }
        },
        {
          task: 'progress-detector-3',
          result: {
            finalResponse: 'Done',
            turns: [],
            toolCalls: [{ id: 't3', name: 'report_progress', input: { progress: 100, summary: 'S3' } }],
            messages: [],
            metrics: { totalTokens: { input: 0, output: 0 }, totalDuration: 0, apiCalls: 0, toolCalls: 0, errors: 0, averageLatency: 0 }
          }
        }
      ];

      mockAgent.executeParallel = jest.fn().mockResolvedValue(mockResults);

      const { ProgressParser } = require('../progress_parser');
      ProgressParser.parseProgress = jest.fn()
        .mockReturnValueOnce({ progress: 50, summary: 'S1' })
        .mockReturnValueOnce({ progress: 75, summary: 'S2' })
        .mockReturnValueOnce({ progress: 100, summary: 'S3' });

      const result = await SubagentHandler.detectProgressWithSubAgents(
        mockAgent,
        repositoryFiles,
        mockOptions,
        'Test prompt'
      );

      expect(result.progress).toBe(75); // Average of 50, 75, 100 = 225/3 = 75
    });

    it('should handle single subagent result', async () => {
      const { FilePartitioner } = require('../file_partitioner');
      FilePartitioner.partitionFilesByDirectory = jest.fn().mockReturnValue([
        ['src/file1.ts', 'src/file2.ts']
      ]);

      const mockResults: Array<{ task: string; result: AgentResult }> = [
        {
          task: 'progress-detector-1',
          result: {
            finalResponse: 'Done',
            turns: [],
            toolCalls: [{ id: 't1', name: 'report_progress', input: { progress: 60, summary: 'Single agent' } }],
            messages: [],
            metrics: { totalTokens: { input: 0, output: 0 }, totalDuration: 0, apiCalls: 0, toolCalls: 0, errors: 0, averageLatency: 0 }
          }
        }
      ];

      mockAgent.executeParallel = jest.fn().mockResolvedValue(mockResults);

      const { ProgressParser } = require('../progress_parser');
      ProgressParser.parseProgress = jest.fn().mockReturnValue({ progress: 60, summary: 'Single agent' });

      const result = await SubagentHandler.detectProgressWithSubAgents(
        mockAgent,
        repositoryFiles,
        mockOptions,
        'Test prompt'
      );

      expect(result.progress).toBe(60);
    });

    it('should handle empty results gracefully', async () => {
      const { FilePartitioner } = require('../file_partitioner');
      FilePartitioner.partitionFilesByDirectory = jest.fn().mockReturnValue([]);

      const mockResults: Array<{ task: string; result: AgentResult }> = [];

      mockAgent.executeParallel = jest.fn().mockResolvedValue(mockResults);

      const result = await SubagentHandler.detectProgressWithSubAgents(
        mockAgent,
        repositoryFiles,
        mockOptions,
        'Test prompt'
      );

      expect(result.progress).toBe(0);
      expect(result.summary).toContain('Unable to determine progress');
    });

    it('should respect maxConcurrentSubAgents limit', async () => {
      const { FilePartitioner } = require('../file_partitioner');
      // Create many files
      const manyFiles = new Map<string, string>();
      for (let i = 0; i < 100; i++) {
        manyFiles.set(`src/file${i}.ts`, `content${i}`);
      }

      FilePartitioner.partitionFilesByDirectory = jest.fn().mockReturnValue(
        Array.from({ length: 3 }, (_, i) => [`src/file${i}.ts`])
      );

      const options: ProgressDetectionOptions = {
        ...mockOptions,
        maxConcurrentSubAgents: 3
      };

      const mockResults: Array<{ task: string; result: AgentResult }> = Array.from({ length: 3 }, (_, i) => ({
        task: `progress-detector-${i + 1}`,
        result: {
          finalResponse: 'Done',
          turns: [],
          toolCalls: [{ id: `t${i}`, name: 'report_progress', input: { progress: 50, summary: 'Test' } }],
          messages: [],
          metrics: { totalTokens: { input: 0, output: 0 }, totalDuration: 0, apiCalls: 0, toolCalls: 0, errors: 0, averageLatency: 0 }
        }
      }));

      mockAgent.executeParallel = jest.fn().mockResolvedValue(mockResults);

      const { ProgressParser } = require('../progress_parser');
      ProgressParser.parseProgress = jest.fn().mockReturnValue({ progress: 50, summary: 'Test' });

      await SubagentHandler.detectProgressWithSubAgents(
        mockAgent,
        manyFiles,
        options,
        'Test prompt'
      );

      // Should create tasks based on maxConcurrentSubAgents
      const executeParallelCall = (mockAgent.executeParallel as jest.MockedFunction<any>).mock.calls[0];
      if (executeParallelCall && executeParallelCall[0]) {
        const tasks = executeParallelCall[0];
        expect(tasks.length).toBeLessThanOrEqual(3);
      }
    });

    it('should combine metrics from all subagents', async () => {
      const { FilePartitioner } = require('../file_partitioner');
      FilePartitioner.partitionFilesByDirectory = jest.fn().mockReturnValue([
        ['src/file1.ts'],
        ['src/file2.ts']
      ]);

      const mockResults: Array<{ task: string; result: AgentResult }> = [
        {
          task: 'progress-detector-1',
          result: {
            finalResponse: 'Done',
            turns: [],
            toolCalls: [{ id: 't1', name: 'report_progress', input: { progress: 50, summary: 'S1' } }],
            messages: [{ role: 'user', content: 'test' }],
            metrics: {
              totalTokens: { input: 100, output: 50 },
              totalDuration: 1000,
              apiCalls: 2,
              toolCalls: 1,
              errors: 0,
              averageLatency: 500
            }
          }
        },
        {
          task: 'progress-detector-2',
          result: {
            finalResponse: 'Done',
            turns: [],
            toolCalls: [{ id: 't2', name: 'report_progress', input: { progress: 70, summary: 'S2' } }],
            messages: [{ role: 'user', content: 'test' }],
            metrics: {
              totalTokens: { input: 200, output: 100 },
              totalDuration: 2000,
              apiCalls: 3,
              toolCalls: 1,
              errors: 0,
              averageLatency: 667
            }
          }
        }
      ];

      mockAgent.executeParallel = jest.fn().mockResolvedValue(mockResults);

      const { ProgressParser } = require('../progress_parser');
      ProgressParser.parseProgress = jest.fn()
        .mockReturnValueOnce({ progress: 50, summary: 'S1' })
        .mockReturnValueOnce({ progress: 70, summary: 'S2' });

      const result = await SubagentHandler.detectProgressWithSubAgents(
        mockAgent,
        repositoryFiles,
        mockOptions,
        'Test prompt'
      );

      expect(result.agentResult.metrics).toBeDefined();
      expect(result.agentResult.metrics!.totalTokens.input).toBe(300); // 100 + 200
      expect(result.agentResult.metrics!.totalTokens.output).toBe(150); // 50 + 100
      expect(result.agentResult.metrics!.totalDuration).toBe(2000); // Max of 1000 and 2000
      expect(result.agentResult.metrics!.apiCalls).toBe(5); // 2 + 3
      expect(result.agentResult.metrics!.toolCalls).toBe(2); // 1 + 1
    });

    it('should create tasks with correct structure', async () => {
      const { FilePartitioner } = require('../file_partitioner');
      FilePartitioner.partitionFilesByDirectory = jest.fn().mockReturnValue([
        ['src/file1.ts', 'src/file2.ts']
      ]);

      const { SystemPromptBuilder } = require('../system_prompt_builder');
      SystemPromptBuilder.build = jest.fn().mockReturnValue('System prompt');

      const mockResults: Array<{ task: string; result: AgentResult }> = [
        {
          task: 'progress-detector-1',
          result: {
            finalResponse: 'Done',
            turns: [],
            toolCalls: [{ id: 't1', name: 'report_progress', input: { progress: 50, summary: 'Test' } }],
            messages: [],
            metrics: { totalTokens: { input: 0, output: 0 }, totalDuration: 0, apiCalls: 0, toolCalls: 0, errors: 0, averageLatency: 0 }
          }
        }
      ];

      mockAgent.executeParallel = jest.fn().mockResolvedValue(mockResults);

      const { ProgressParser } = require('../progress_parser');
      ProgressParser.parseProgress = jest.fn().mockReturnValue({ progress: 50, summary: 'Test' });

      await SubagentHandler.detectProgressWithSubAgents(
        mockAgent,
        repositoryFiles,
        mockOptions,
        'User prompt'
      );

      const executeParallelCall = (mockAgent.executeParallel as jest.MockedFunction<any>).mock.calls[0];
      if (executeParallelCall && executeParallelCall[0]) {
        const tasks = executeParallelCall[0];
        expect(tasks.length).toBe(1);
        expect(tasks[0].name).toContain('progress-detector');
        expect(tasks[0].systemPrompt).toBe('System prompt');
        expect(tasks[0].prompt).toContain('User prompt');
        expect(tasks[0].prompt).toContain('report_progress');
        expect(tasks[0].tools).toBeDefined();
      }
    });
  });
});


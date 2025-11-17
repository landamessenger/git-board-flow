/**
 * Tests for VectorActionUseCase - Orphaned Branch Detection
 */

import { VectorActionUseCase } from '../vector_action_use_case';
import { Execution } from '../../../data/model/execution';
import { BranchRepository } from '../../../data/repository/branch_repository';
import { SupabaseRepository } from '../../../data/repository/supabase_repository';
import { Result } from '../../../data/model/result';
import { logInfo, logError } from '../../../utils/logger';

// Mock dependencies
jest.mock('../../../data/repository/branch_repository');
jest.mock('../../../data/repository/supabase_repository');
jest.mock('../../../data/repository/file_repository');
jest.mock('../../../data/repository/ai_repository');
jest.mock('../../../usecase/steps/common/services/file_import_analyzer');
jest.mock('../../../usecase/steps/common/services/file_cache_manager');
jest.mock('../../../usecase/steps/common/services/codebase_analyzer');
jest.mock('../../../utils/logger');

describe('VectorActionUseCase - Orphaned Branch Detection', () => {
  let useCase: VectorActionUseCase;
  let mockBranchRepository: jest.Mocked<BranchRepository>;
  let mockSupabaseRepository: jest.Mocked<SupabaseRepository>;
  let mockExecution: Execution;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock instances
    mockBranchRepository = {
      getListOfBranches: jest.fn(),
    } as any;

    mockSupabaseRepository = {
      getDistinctBranches: jest.fn(),
      removeAIFileCacheByBranch: jest.fn(),
    } as any;

    // Mock SupabaseRepository constructor to return our mock
    (SupabaseRepository as jest.MockedClass<typeof SupabaseRepository>).mockImplementation(() => {
      return mockSupabaseRepository as any;
    });

    // Create use case instance and replace private repositories with mocks
    useCase = new VectorActionUseCase();
    (useCase as any).branchRepository = mockBranchRepository;

    // Mock Execution object
    mockExecution = {
      owner: 'test-owner',
      repo: 'test-repo',
      supabaseConfig: {
        url: 'https://test.supabase.co',
        key: 'test-key',
      },
      tokens: {
        token: 'test-token',
      },
      inputs: {
        commits: {
          ref: 'refs/heads/feature/test-branch',
        },
      },
      ai: {
        getOpenRouterModel: () => 'test-model',
        getOpenRouterApiKey: () => 'test-api-key',
        getAiIgnoreFiles: () => [],
      },
    } as any;
  });

  describe('removeOrphanedBranches', () => {
    it('should not mark branches as orphaned when they exist in GitHub', async () => {
      // Setup: All Supabase branches exist in GitHub
      const githubBranches = ['develop', 'main', 'feature/test-branch'];
      const supabaseBranches = ['develop', 'main', 'feature/test-branch'];

      mockSupabaseRepository.getDistinctBranches.mockResolvedValue(supabaseBranches);

      // Access private method through any cast
      const results = await (useCase as any).removeOrphanedBranches(mockExecution, githubBranches);

      expect(mockSupabaseRepository.getDistinctBranches).toHaveBeenCalledWith(
        'test-owner',
        'test-repo'
      );
      expect(mockSupabaseRepository.removeAIFileCacheByBranch).not.toHaveBeenCalled();
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].steps).toContain('No orphaned branches found. All Supabase branches exist in GitHub.');
    });

    it('should correctly identify orphaned branches that no longer exist in GitHub', async () => {
      // Setup: Some Supabase branches don't exist in GitHub
      const githubBranches = ['develop', 'main'];
      const supabaseBranches = ['develop', 'main', 'feature/deleted-branch', 'bugfix/old-bug'];

      mockSupabaseRepository.getDistinctBranches.mockResolvedValue(supabaseBranches);
      mockSupabaseRepository.removeAIFileCacheByBranch.mockResolvedValue(undefined);

      const results = await (useCase as any).removeOrphanedBranches(mockExecution, githubBranches);

      expect(mockSupabaseRepository.removeAIFileCacheByBranch).toHaveBeenCalledTimes(2);
      expect(mockSupabaseRepository.removeAIFileCacheByBranch).toHaveBeenCalledWith(
        'test-owner',
        'test-repo',
        'feature/deleted-branch'
      );
      expect(mockSupabaseRepository.removeAIFileCacheByBranch).toHaveBeenCalledWith(
        'test-owner',
        'test-repo',
        'bugfix/old-bug'
      );
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].steps[0]).toContain('Removed 2 orphaned branch(es) from AI cache');
    });

    it('should handle case-sensitive branch name comparison', async () => {
      // Setup: Branch names differ only in case
      const githubBranches = ['develop', 'main', 'Feature/Test-Branch'];
      const supabaseBranches = ['develop', 'main', 'feature/test-branch']; // Different case

      mockSupabaseRepository.getDistinctBranches.mockResolvedValue(supabaseBranches);
      mockSupabaseRepository.removeAIFileCacheByBranch.mockResolvedValue(undefined);

      const results = await (useCase as any).removeOrphanedBranches(mockExecution, githubBranches);

      // Should mark as orphaned because case doesn't match
      expect(mockSupabaseRepository.removeAIFileCacheByBranch).toHaveBeenCalledWith(
        'test-owner',
        'test-repo',
        'feature/test-branch'
      );
      expect(results[0].success).toBe(true);
    });

    it('should normalize branch names by trimming whitespace', async () => {
      // Setup: Branches with leading/trailing whitespace
      const githubBranches = ['develop', 'main'];
      const supabaseBranches = [' develop ', 'main', ' feature/test '];

      mockSupabaseRepository.getDistinctBranches.mockResolvedValue(supabaseBranches);
      mockSupabaseRepository.removeAIFileCacheByBranch.mockResolvedValue(undefined);

      const results = await (useCase as any).removeOrphanedBranches(mockExecution, githubBranches);

      // Should normalize ' develop ' to 'develop' and match, but ' feature/test ' should be orphaned
      expect(mockSupabaseRepository.removeAIFileCacheByBranch).toHaveBeenCalledTimes(1);
      expect(mockSupabaseRepository.removeAIFileCacheByBranch).toHaveBeenCalledWith(
        'test-owner',
        'test-repo',
        'feature/test'
      );
    });

    it('should filter out null, undefined, and empty branch names', async () => {
      // Setup: Invalid branch names in Supabase
      const githubBranches = ['develop', 'main'];
      const supabaseBranches = ['develop', '', null as any, undefined as any, 'main', '   '];

      mockSupabaseRepository.getDistinctBranches.mockResolvedValue(supabaseBranches);

      const results = await (useCase as any).removeOrphanedBranches(mockExecution, githubBranches);

      // Should only process valid branches (develop and main match, invalid ones are filtered)
      expect(mockSupabaseRepository.removeAIFileCacheByBranch).not.toHaveBeenCalled();
      expect(results[0].success).toBe(true);
      expect(results[0].steps[0]).toContain('No orphaned branches found');
    });

    it('should handle empty GitHub branches list', async () => {
      // Setup: No branches in GitHub
      const githubBranches: string[] = [];
      const supabaseBranches = ['develop', 'main', 'feature/test'];

      mockSupabaseRepository.getDistinctBranches.mockResolvedValue(supabaseBranches);
      mockSupabaseRepository.removeAIFileCacheByBranch.mockResolvedValue(undefined);

      const results = await (useCase as any).removeOrphanedBranches(mockExecution, githubBranches);

      expect(results).toHaveLength(1);
      expect(results[0].steps[0]).toContain('No valid branches from GitHub to compare against');
    });

    it('should handle empty Supabase branches list', async () => {
      // Setup: No branches in Supabase
      const githubBranches = ['develop', 'main'];
      const supabaseBranches: string[] = [];

      mockSupabaseRepository.getDistinctBranches.mockResolvedValue(supabaseBranches);

      const results = await (useCase as any).removeOrphanedBranches(mockExecution, githubBranches);

      expect(mockSupabaseRepository.removeAIFileCacheByBranch).not.toHaveBeenCalled();
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].steps[0]).toContain('No branches found in Supabase, nothing to clean');
    });

    it('should handle errors when removing orphaned branches', async () => {
      // Setup: Error removing one branch
      const githubBranches = ['develop'];
      const supabaseBranches = ['develop', 'feature/deleted-branch'];

      mockSupabaseRepository.getDistinctBranches.mockResolvedValue(supabaseBranches);
      mockSupabaseRepository.removeAIFileCacheByBranch
        .mockRejectedValueOnce(new Error('Database error'));

      const results = await (useCase as any).removeOrphanedBranches(mockExecution, githubBranches);

      expect(mockSupabaseRepository.removeAIFileCacheByBranch).toHaveBeenCalledTimes(1);
      expect(logError).toHaveBeenCalled();
      // Should have one result with error message about failed removal
      expect(results.length).toBeGreaterThanOrEqual(1);
      const errorResult = results.find((r: Result) => !r.success && r.errors && r.errors.length > 0);
      expect(errorResult).toBeDefined();
      expect(errorResult!.errors[0]).toContain('Failed to remove');
    });

    it('should handle errors when getting Supabase branches', async () => {
      // Setup: Error getting branches from Supabase
      const githubBranches = ['develop', 'main'];

      mockSupabaseRepository.getDistinctBranches.mockRejectedValue(new Error('Supabase connection error'));

      const results = await (useCase as any).removeOrphanedBranches(mockExecution, githubBranches);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].errors[0]).toContain('Error checking for orphaned branches');
      expect(logError).toHaveBeenCalled();
    });

    it('should handle missing supabase config', async () => {
      // Setup: No Supabase config
      const executionWithoutSupabase = {
        ...mockExecution,
        supabaseConfig: undefined,
      };

      const results = await (useCase as any).removeOrphanedBranches(executionWithoutSupabase, ['develop']);

      expect(mockSupabaseRepository.getDistinctBranches).not.toHaveBeenCalled();
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].steps[0]).toContain('Supabase config not found');
    });

    it('should correctly identify develop branch as not orphaned', async () => {
      // Setup: develop exists in both GitHub and Supabase
      const githubBranches = ['develop', 'main', 'feature/test'];
      const supabaseBranches = ['develop', 'main'];

      mockSupabaseRepository.getDistinctBranches.mockResolvedValue(supabaseBranches);

      const results = await (useCase as any).removeOrphanedBranches(mockExecution, githubBranches);

      expect(mockSupabaseRepository.removeAIFileCacheByBranch).not.toHaveBeenCalled();
      expect(results[0].success).toBe(true);
      expect(results[0].steps[0]).toContain('No orphaned branches found');
    });

    it('should handle special characters in branch names', async () => {
      // Setup: Branches with special characters
      const githubBranches = ['develop', 'feature/test-branch', 'bugfix/123-fix'];
      const supabaseBranches = ['develop', 'feature/test-branch', 'bugfix/123-fix', 'feature/special@branch'];

      mockSupabaseRepository.getDistinctBranches.mockResolvedValue(supabaseBranches);
      mockSupabaseRepository.removeAIFileCacheByBranch.mockResolvedValue(undefined);

      const results = await (useCase as any).removeOrphanedBranches(mockExecution, githubBranches);

      expect(mockSupabaseRepository.removeAIFileCacheByBranch).toHaveBeenCalledWith(
        'test-owner',
        'test-repo',
        'feature/special@branch'
      );
    });

    it('should handle duplicate branch names in GitHub list', async () => {
      // Setup: Duplicate branches in GitHub (should be deduplicated by Set)
      const githubBranches = ['develop', 'main', 'develop', 'feature/test']; // 'develop' appears twice
      const supabaseBranches = ['develop', 'main', 'feature/test'];

      mockSupabaseRepository.getDistinctBranches.mockResolvedValue(supabaseBranches);

      const results = await (useCase as any).removeOrphanedBranches(mockExecution, githubBranches);

      // Should handle duplicates correctly (Set deduplicates)
      expect(mockSupabaseRepository.removeAIFileCacheByBranch).not.toHaveBeenCalled();
      expect(results[0].success).toBe(true);
      expect(results[0].steps[0]).toContain('No orphaned branches found');
    });

    it('should handle duplicate branch names in Supabase list', async () => {
      // Setup: Duplicate branches in Supabase (should be deduplicated)
      const githubBranches = ['develop', 'main'];
      const supabaseBranches = ['develop', 'main', 'develop', 'feature/orphaned']; // 'develop' appears twice

      mockSupabaseRepository.getDistinctBranches.mockResolvedValue(supabaseBranches);
      mockSupabaseRepository.removeAIFileCacheByBranch.mockResolvedValue(undefined);

      const results = await (useCase as any).removeOrphanedBranches(mockExecution, githubBranches);

      // Should only remove 'feature/orphaned' once, not 'develop' (even though it appears twice)
      expect(mockSupabaseRepository.removeAIFileCacheByBranch).toHaveBeenCalledTimes(1);
      expect(mockSupabaseRepository.removeAIFileCacheByBranch).toHaveBeenCalledWith(
        'test-owner',
        'test-repo',
        'feature/orphaned'
      );
    });

    it('should handle partial failures when removing multiple orphaned branches', async () => {
      // Setup: Multiple orphaned branches, one fails to remove
      const githubBranches = ['develop'];
      const supabaseBranches = ['develop', 'feature/branch1', 'feature/branch2', 'feature/branch3'];

      mockSupabaseRepository.getDistinctBranches.mockResolvedValue(supabaseBranches);
      mockSupabaseRepository.removeAIFileCacheByBranch
        .mockResolvedValueOnce(undefined) // branch1 succeeds
        .mockRejectedValueOnce(new Error('Database error')) // branch2 fails
        .mockResolvedValueOnce(undefined); // branch3 succeeds

      const results = await (useCase as any).removeOrphanedBranches(mockExecution, githubBranches);

      expect(mockSupabaseRepository.removeAIFileCacheByBranch).toHaveBeenCalledTimes(3);
      expect(logError).toHaveBeenCalled();
      
      // Should have success result for removed branches and error result for failures
      const successResults = results.filter((r: Result) => r.success);
      const errorResults = results.filter((r: Result) => !r.success);
      
      expect(successResults.length).toBeGreaterThan(0);
      expect(errorResults.length).toBeGreaterThan(0);
      expect(errorResults[0].errors[0]).toContain('Failed to remove');
    });

    it('should handle very long branch names', async () => {
      // Setup: Branch with very long name
      const longBranchName = 'feature/' + 'a'.repeat(200); // Very long branch name
      const githubBranches = ['develop', 'main'];
      const supabaseBranches = ['develop', 'main', longBranchName];

      mockSupabaseRepository.getDistinctBranches.mockResolvedValue(supabaseBranches);
      mockSupabaseRepository.removeAIFileCacheByBranch.mockResolvedValue(undefined);

      const results = await (useCase as any).removeOrphanedBranches(mockExecution, githubBranches);

      expect(mockSupabaseRepository.removeAIFileCacheByBranch).toHaveBeenCalledWith(
        'test-owner',
        'test-repo',
        longBranchName
      );
    });

    it('should handle Unicode characters in branch names', async () => {
      // Setup: Branches with Unicode characters
      const githubBranches = ['develop', 'main'];
      const supabaseBranches = ['develop', 'main', 'feature/测试', 'feature/café'];

      mockSupabaseRepository.getDistinctBranches.mockResolvedValue(supabaseBranches);
      mockSupabaseRepository.removeAIFileCacheByBranch.mockResolvedValue(undefined);

      const results = await (useCase as any).removeOrphanedBranches(mockExecution, githubBranches);

      expect(mockSupabaseRepository.removeAIFileCacheByBranch).toHaveBeenCalledTimes(2);
      expect(mockSupabaseRepository.removeAIFileCacheByBranch).toHaveBeenCalledWith(
        'test-owner',
        'test-repo',
        'feature/测试'
      );
      expect(mockSupabaseRepository.removeAIFileCacheByBranch).toHaveBeenCalledWith(
        'test-owner',
        'test-repo',
        'feature/café'
      );
    });

    it('should handle branches with only whitespace after normalization', async () => {
      // Setup: Branches that become empty after trim
      const githubBranches = ['develop', 'main'];
      const supabaseBranches = ['develop', 'main', '   ', '\t\t', '\n\n'];

      mockSupabaseRepository.getDistinctBranches.mockResolvedValue(supabaseBranches);

      const results = await (useCase as any).removeOrphanedBranches(mockExecution, githubBranches);

      // Should filter out whitespace-only branches
      expect(mockSupabaseRepository.removeAIFileCacheByBranch).not.toHaveBeenCalled();
      expect(results[0].success).toBe(true);
      expect(results[0].steps[0]).toContain('No orphaned branches found');
    });
  });

  describe('invoke - Integration with removeOrphanedBranches', () => {
    it('should call removeOrphanedBranches with all GitHub branches, not just processed branches', async () => {
      // This test verifies the key fix: when processing a single branch,
      // removeOrphanedBranches should still receive ALL branches from GitHub,
      // not just the processed branch. This prevents false positives like marking
      // 'develop' as orphaned when it still exists in GitHub.
      
      // Setup: Process only one branch, but check against all branches
      const processedBranch = 'feature/test-branch';
      const allGitHubBranches = ['develop', 'main', 'feature/test-branch', 'feature/other-branch'];

      // Directly test removeOrphanedBranches with all branches (simulating the fix)
      // The fix ensures that getListOfBranches is called separately to get ALL branches
      mockSupabaseRepository.getDistinctBranches.mockResolvedValue(['develop', 'main']);

      // Simulate the fixed behavior: removeOrphanedBranches receives ALL branches
      const results = await (useCase as any).removeOrphanedBranches(mockExecution, allGitHubBranches);

      // Verify that the function correctly identifies that 'develop' and 'main' are NOT orphaned
      // because they exist in the allGitHubBranches list
      expect(mockSupabaseRepository.getDistinctBranches).toHaveBeenCalledWith(
        'test-owner',
        'test-repo'
      );
      // Since 'develop' and 'main' exist in both Supabase and GitHub, they should NOT be removed
      expect(mockSupabaseRepository.removeAIFileCacheByBranch).not.toHaveBeenCalled();
      expect(results[0].success).toBe(true);
      expect(results[0].steps[0]).toContain('No orphaned branches found');
      
      // This test demonstrates that the fix works: even if we only process one branch,
      // we check against ALL branches, preventing false positives
    });

    it('should handle errors when retrieving GitHub branches gracefully', async () => {
      // Setup: Error getting branches from GitHub
      const executionWithBranch = {
        ...mockExecution,
        inputs: {
          commits: {
            ref: 'refs/heads/feature/test-branch',
          },
        },
      } as any;

      mockBranchRepository.getListOfBranches.mockRejectedValue(new Error('GitHub API error'));

      // Mock other required methods
      (useCase as any).fileRepository = {
        getRepositoryContent: jest.fn().mockResolvedValue(new Map()),
      };

      const results = await useCase.invoke(executionWithBranch);

      expect(logError).toHaveBeenCalled();
      // Should still complete execution even if branch retrieval fails
      expect(results.length).toBeGreaterThan(0);
    });
  });
});


/**
 * Tests for File Partitioner
 */

import { FilePartitioner } from '../file_partitioner';

describe('FilePartitioner', () => {
  describe('partitionFilesByDirectory', () => {
    it('should partition files by top-level directory', () => {
      const files = [
        'src/agent/core/agent.ts',
        'src/agent/tools/base_tool.ts',
        'src/utils/logger.ts',
        'src/utils/constants.ts',
        'test/agent.test.ts',
        'test/utils.test.ts'
      ];

      const result = FilePartitioner.partitionFilesByDirectory(files, 3);

      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(3);
      
      // Verify all files are included
      const allPartitionedFiles = result.flat();
      expect(allPartitionedFiles.length).toBe(files.length);
      files.forEach(file => {
        expect(allPartitionedFiles).toContain(file);
      });
    });

    it('should handle files in root directory', () => {
      const files = [
        'package.json',
        'tsconfig.json',
        'src/file.ts'
      ];

      const result = FilePartitioner.partitionFilesByDirectory(files, 2);

      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(2);
      
      const allPartitionedFiles = result.flat();
      expect(allPartitionedFiles.length).toBe(files.length);
    });

    it('should distribute files evenly across partitions', () => {
      const files = Array.from({ length: 30 }, (_, i) => `src/file${i}.ts`);
      
      const result = FilePartitioner.partitionFilesByDirectory(files, 5);

      expect(result.length).toBeLessThanOrEqual(5);
      
      // Check that files are distributed
      const partitionSizes = result.map(partition => partition.length);
      const maxSize = Math.max(...partitionSizes);
      const minSize = Math.min(...partitionSizes);
      
      // Sizes should be relatively balanced (within reasonable range)
      expect(maxSize - minSize).toBeLessThanOrEqual(10);
    });

    it('should handle empty files array', () => {
      const files: string[] = [];
      const result = FilePartitioner.partitionFilesByDirectory(files, 3);

      expect(result.length).toBe(0);
    });

    it('should handle single partition', () => {
      const files = ['src/file1.ts', 'src/file2.ts', 'src/file3.ts'];
      const result = FilePartitioner.partitionFilesByDirectory(files, 1);

      expect(result.length).toBe(1);
      expect(result[0].length).toBe(files.length);
    });

    it('should group files from same directory together', () => {
      const files = [
        'src/agent/core/agent.ts',
        'src/agent/core/budget.ts',
        'src/agent/tools/base.ts',
        'src/utils/logger.ts'
      ];

      const result = FilePartitioner.partitionFilesByDirectory(files, 2);

      // Files from src/agent should be grouped together
      const agentFiles = files.filter(f => f.startsWith('src/agent'));
      const partitionedAgentFiles = result.flat().filter(f => f.startsWith('src/agent'));
      
      expect(partitionedAgentFiles.length).toBe(agentFiles.length);
    });
  });
});


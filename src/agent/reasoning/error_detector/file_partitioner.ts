/**
 * File Partitioner
 * Partitions files by directory for subagent distribution
 */

export class FilePartitioner {
  /**
   * Partition files by directory to keep related files together
   * Tries to balance file distribution across groups
   */
  static partitionFilesByDirectory(files: string[], maxGroups: number): string[][] {
    // Group files by top-level directory
    const dirGroups = new Map<string, string[]>();
    
    for (const file of files) {
      const parts = file.split('/');
      const topDir = parts.length > 1 ? parts[0] : 'root';
      
      if (!dirGroups.has(topDir)) {
        dirGroups.set(topDir, []);
      }
      dirGroups.get(topDir)!.push(file);
    }
    
    // Convert to array and sort by size (largest first)
    const groups = Array.from(dirGroups.values()).sort((a, b) => b.length - a.length);
    
    // Initialize result groups
    const result: string[][] = Array(maxGroups).fill(null).map(() => []);
    
    // Distribute groups across subagents, trying to balance sizes
    // Use a balanced approach: always assign to the subagent with the least files
    for (let i = 0; i < groups.length; i++) {
      // Find the subagent with the least files
      let minIndex = 0;
      let minSize = result[0].length;
      for (let j = 1; j < result.length; j++) {
        if (result[j].length < minSize) {
          minSize = result[j].length;
          minIndex = j;
        }
      }
      result[minIndex].push(...groups[i]);
    }
    
    // Remove empty groups
    return result.filter(group => group.length > 0);
  }
}


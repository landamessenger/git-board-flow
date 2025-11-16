/**
 * File Partitioner
 * Partitions files by directory for subagent distribution
 */

export class FilePartitioner {
  /**
   * Partition files by directory to keep related files together
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
    
    // Distribute groups across maxGroups subagents
    const result: string[][] = Array(maxGroups).fill(null).map(() => []);
    
    for (let i = 0; i < groups.length; i++) {
      const targetIndex = i % maxGroups;
      result[targetIndex].push(...groups[i]);
    }
    
    // Remove empty groups
    return result.filter(group => group.length > 0);
  }
}


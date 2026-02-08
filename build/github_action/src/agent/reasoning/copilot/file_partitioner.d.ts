/**
 * File Partitioner
 * Partitions files by directory for subagent distribution
 */
export declare class FilePartitioner {
    /**
     * Partition files by directory to keep related files together
     * Tries to balance file distribution across groups
     */
    static partitionFilesByDirectory(files: string[], maxGroups: number): string[][];
}

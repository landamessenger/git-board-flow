/**
 * Service for building file indexes and searching files
 */
export declare class FileSearchService {
    /**
     * Build file index for quick lookup by filename or directory
     */
    buildFileIndex(files: Map<string, string>): Map<string, string[]>;
    /**
     * Search files by search terms (filename, directory, or pattern)
     */
    searchFiles(searchTerms: string[], fileIndex: Map<string, string[]>): string[];
}

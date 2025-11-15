export declare class FileRepository {
    /**
     * Normalize file path for consistent comparison
     * This must match the normalization used in FileCacheManager
     * Removes leading ./ and normalizes path separators
     */
    private normalizePath;
    private isMediaOrPdfFile;
    getFileContent: (owner: string, repository: string, path: string, token: string, branch: string) => Promise<string>;
    getRepositoryContent: (owner: string, repository: string, token: string, branch: string, ignoreFiles: string[], progress: (fileName: string) => void, ignoredFiles: (fileName: string) => void) => Promise<Map<string, string>>;
    private shouldIgnoreFile;
}

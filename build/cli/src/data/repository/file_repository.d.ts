export declare class FileRepository {
    private isMediaOrPdfFile;
    getFileContent: (owner: string, repository: string, path: string, token: string, branch: string) => Promise<string>;
    getRepositoryContent: (owner: string, repository: string, token: string, branch: string, ignoreFiles: string[], progress: (fileName: string) => void, ignoredFiles: (fileName: string) => void) => Promise<Map<string, string>>;
    private shouldIgnoreFile;
}

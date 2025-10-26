import { ChunkedFile } from "../model/chunked_file";
export interface FileTreeNodeWithNoContent {
    name: string;
    type: 'file' | 'directory';
    children?: FileTreeNodeWithNoContent[];
    path: string;
    content?: string;
}
export interface FileTreeNodeWithContent {
    name: string;
    type: 'file' | 'directory';
    children?: FileTreeNodeWithContent[];
    path: string;
    content?: string;
}
export declare class FileRepository {
    private isMediaOrPdfFile;
    getFileContent: (owner: string, repository: string, path: string, token: string, branch: string) => Promise<string>;
    getRepositoryContent: (owner: string, repository: string, token: string, branch: string, ignoreFiles: string[], progress: (fileName: string) => void, ignoredFiles: (fileName: string) => void) => Promise<Map<string, string>>;
    getChunkedRepositoryContent: (owner: string, repository: string, branch: string, chunkSize: number, token: string, ignoreFiles: string[], progress: (fileName: string) => void, ignoredFiles: (fileName: string) => void) => Promise<Map<string, ChunkedFile[]>>;
    getChunksByLines: (path: string, content: string, shasum: string, chunkSize: number) => ChunkedFile[];
    getChunksByBlocks: (path: string, content: string, shasum: string, chunkSize: number) => ChunkedFile[];
    private shouldIgnoreFile;
    private extractCodeBlocks;
    private shouldIgnoreLine;
    private shuffleArray;
    private calculateShasum;
    getFileTree: (owner: string, repository: string, token: string, branch: string, ignoreFiles: string[], progress: (fileName: string) => void, ignoredFiles: (fileName: string) => void) => Promise<{
        withContent: FileTreeNodeWithContent;
        withoutContent: FileTreeNodeWithNoContent;
    }>;
}

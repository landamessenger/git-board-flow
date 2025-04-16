import { ChunkedFile } from "../model/chunked_file";
export declare class FileRepository {
    private isMediaOrPdfFile;
    getFileContent: (owner: string, repository: string, path: string, token: string, branch: string) => Promise<string>;
    getRepositoryContent: (owner: string, repository: string, token: string, branch: string, ignoreFiles: string[], progress: (fileName: string) => void) => Promise<Map<string, string>>;
    getChunkedRepositoryContent: (owner: string, repository: string, branch: string, chunkSize: number, token: string, ignoreFiles: string[], progress: (fileName: string) => void) => Promise<ChunkedFile[]>;
    getChunksByLines: (path: string, content: string, chunkSize: number) => ChunkedFile[];
    getChunksByBlocks: (path: string, content: string, chunkSize: number) => ChunkedFile[];
    private shouldIgnoreFile;
    private extractCodeBlocks;
    private shouldIgnoreLine;
}

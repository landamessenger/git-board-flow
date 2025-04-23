import { ChunkedFile } from '../model/chunked_file';
import { ChunkedFileChunk } from '../model/chunked_file_chunk';
import { SupabaseConfig } from '../model/supabase_config';
export declare class SupabaseRepository {
    private readonly CHUNKS_TABLE;
    private readonly MAX_BATCH_SIZE;
    private readonly DEFAULT_TIMEOUT;
    private supabase;
    constructor(config: SupabaseConfig);
    setChunkedFile: (owner: string, repository: string, branch: string, chunkedFile: ChunkedFile) => Promise<void>;
    removeChunksByShasum: (owner: string, repository: string, branch: string, shasum: string) => Promise<void>;
    getChunkedFileByShasum: (owner: string, repository: string, branch: string, type: string, shasum: string) => Promise<ChunkedFileChunk[]>;
    getChunks: (owner: string, repository: string, branch: string, path: string, type: string, index: number) => Promise<ChunkedFileChunk[]>;
    getChunksByShasum: (owner: string, repository: string, branch: string, shasum: string) => Promise<ChunkedFileChunk[]>;
    updateVector: (owner: string, repository: string, branch: string, path: string, index: number, chunkIndex: number, vector: number[]) => Promise<void>;
    matchChunks: (owner: string, repository: string, branch: string, type: string, queryEmbedding: number[], matchCount?: number) => Promise<ChunkedFileChunk[]>;
    duplicateChunksByBranch: (owner: string, repository: string, sourceBranch: string, targetBranch: string) => Promise<void>;
    removeChunksByBranch: (owner: string, repository: string, branch: string) => Promise<void>;
    getDistinctPaths: (owner: string, repository: string, branch: string) => Promise<string[]>;
    removeChunksByPath: (owner: string, repository: string, branch: string, path: string) => Promise<void>;
    getShasumByPath: (owner: string, repository: string, branch: string, path: string) => Promise<string | undefined>;
}

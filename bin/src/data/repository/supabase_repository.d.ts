import { ChunkedFile } from '../model/chunked_file';
import { SupabaseConfig } from '../model/supabase_config';
export declare class SupabaseRepository {
    private readonly CHUNKS_TABLE;
    private readonly MAX_BATCH_SIZE;
    private readonly MAX_PARALLEL_BATCHES;
    private supabase;
    constructor(config: SupabaseConfig);
    setChunkedFile: (owner: string, repository: string, branch: string, chunkedFile: ChunkedFile) => Promise<void>;
    getChunkedFile: (owner: string, repository: string, branch: string, shasum: string) => Promise<ChunkedFile | undefined>;
    getChunksByFile: (owner: string, repository: string, branch: string, path: string) => Promise<ChunkedFile[]>;
    updateVector: (owner: string, repository: string, branch: string, path: string, index: number, chunkIndex: number, vector: number[]) => Promise<void>;
}

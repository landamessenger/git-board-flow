import { createClient } from '@supabase/supabase-js';
import { ChunkedFile } from '../model/chunked_file';
import { SupabaseConfig } from '../model/supabase_config';
import { createHash } from 'crypto';

export class SupabaseRepository {
    private readonly CHUNKS_TABLE = 'chunks';
    private readonly MAX_BATCH_SIZE = 500;
    private readonly MAX_PARALLEL_BATCHES = 5;
    private supabase: any;

    constructor(config: SupabaseConfig) {
        this.supabase = createClient(config.getUrl(), config.getKey());
    }

    setChunkedFile = async (
        owner: string,
        repository: string,
        branch: string,
        chunkedFile: ChunkedFile,
    ): Promise<void> => {
        chunkedFile.chunks.forEach(async (chunk, index) => {
            const { error } = await this.supabase
                .from(this.CHUNKS_TABLE)
                .insert({
                    owner,
                    repository,
                    branch,
                    path: chunkedFile.path,
                    index: chunkedFile.index,
                    chunk_index: index,
                    type: chunkedFile.type,
                    content: chunk,
                    shasum: createHash('sha256').update(chunk).digest('hex'),
                    vector: chunkedFile.vector[index],
                    updated_at: new Date().toISOString()
                }); 
            if (error) {
                throw error;
            }
        });
    }

    getChunkedFile = async (
        owner: string,
        repository: string,
        branch: string,
        shasum: string,
    ): Promise<ChunkedFile | undefined> => {
        const { data, error } = await this.supabase
            .from(this.CHUNKS_TABLE)
            .select('*')
            .eq('owner', owner)
            .eq('repository', repository)
            .eq('branch', branch)
            .eq('shasum', shasum)
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (!data) {
            return undefined;
        }

        return new ChunkedFile(
            data.path,
            data.index,
            data.type,
            data.content,
            [data.content]
        );
    }

    getChunksByFile = async (
        owner: string,
        repository: string,
        branch: string,
        path: string
    ): Promise<ChunkedFile[]> => {
        const { data, error } = await this.supabase
            .from(this.CHUNKS_TABLE)
            .select('*')
            .eq('owner', owner)
            .eq('repository', repository)
            .eq('branch', branch)
            .eq('path', path)
            .order('index')
            .order('chunk_index');

        if (error) {
            throw error;
        }

        return data.map((doc: any) => new ChunkedFile(
            doc.path,
            doc.index,
            doc.type,
            doc.content,
            [doc.content] // Since we store the content as a single string, we wrap it in an array
        ));
    }

    updateVector = async (
        owner: string,
        repository: string,
        branch: string,
        path: string,
        index: number,
        chunkIndex: number,
        vector: number[]
    ): Promise<void> => {
        const { error } = await this.supabase
            .from(this.CHUNKS_TABLE)
            .update({ vector })
            .eq('owner', owner)
            .eq('repository', repository)
            .eq('branch', branch)
            .eq('path', path)
            .eq('index', index)
            .eq('chunk_index', chunkIndex);

        if (error) {
            throw error;
        }
    }
} 
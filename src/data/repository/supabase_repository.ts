import { createClient } from '@supabase/supabase-js';
import { logError } from '../../utils/logger';
import { ChunkedFile } from '../model/chunked_file';
import { ChunkedFileChunk } from '../model/chunked_file_chunk';
import { SupabaseConfig } from '../model/supabase_config';

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
        try {
            const insertPromises = chunkedFile.chunks.map(async (chunk, index) => {
                const { error } = await this.supabase
                    .from(this.CHUNKS_TABLE)
                    .insert({
                        owner,
                        repository,
                        branch,
                        path: chunkedFile.path,
                        type: chunkedFile.type,
                        index: chunkedFile.index,
                        chunk_index: index,
                        content: chunk,
                        shasum: chunkedFile.shasum,
                        vector: chunkedFile.vector[index],
                        updated_at: new Date().toISOString()
                    });
                
                if (error) {
                    //logError(`Error inserting chunk ${index} for file ${chunkedFile.path}: ${JSON.stringify(error, null, 2)}`);
                    throw error;
                }
            });

            await Promise.all(insertPromises);
        } catch (error) {
            logError(`Error setting chunked file ${chunkedFile.path}: ${JSON.stringify(error, null, 2)}`);
            throw error;
        }
    }

    removeChunksByShasum = async (
        owner: string,
        repository: string,
        branch: string,
        shasum: string,
    ): Promise<void> => {
        try {
            const { error } = await this.supabase
                .from(this.CHUNKS_TABLE)
                .delete()
                .eq('owner', owner)
                .eq('repository', repository)
                .eq('branch', branch)
                .eq('shasum', shasum);

            if (error) {
                throw error;
            }
        } catch (error) {
            logError(`Error removing chunks by shasum: ${JSON.stringify(error, null, 2)}`);
            throw error;
        }
    }

    getChunkedFileByShasum = async (
        owner: string,
        repository: string,
        branch: string,
        type: string,
        shasum: string,
    ): Promise<ChunkedFileChunk[]> => {
        try {
            const { data, error } = await this.supabase
                .from(this.CHUNKS_TABLE)
                .select('*')
                .eq('owner', owner)
                .eq('repository', repository)
                .eq('branch', branch)
                .eq('type', type)
                .eq('shasum', shasum)
                .order('chunk_index');

            if (error) {
                logError(`Supabase error getting chunked file: ${JSON.stringify(error, null, 2)}`);
                return [];
            }

            if (!data) {
                return [];
            }

            return data.map((doc: any) => new ChunkedFileChunk(
                doc.owner,
                doc.repository,
                doc.branch,
                doc.path,
                doc.type,
                doc.index,
                doc.chunk_index,
                doc.content,
                doc.shasum,
                doc.vector
            ));
        } catch (error) {
            logError(`Error getting chunked file: ${JSON.stringify(error, null, 2)}`);
            return [];
        }
    }


    getChunks = async (
        owner: string,
        repository: string,
        branch: string,
        path: string,
        type: string,
        index: number,
    ): Promise<ChunkedFileChunk[]> => {
        try {
            const { data, error } = await this.supabase
                .from(this.CHUNKS_TABLE)
                .select('*')
                .eq('owner', owner)
                .eq('repository', repository)
                .eq('branch', branch)
                .eq('path', path)
                .eq('type', type)
                .eq('index', index)
                .order('chunk_index');

            if (error) {
                logError(`Supabase error getting chunked file: ${JSON.stringify(error, null, 2)}`);
                return [];
            }

            if (!data) {
                return [];
            }

            return data.map((doc: any) => new ChunkedFileChunk(
                doc.owner,
                doc.repository,
                doc.branch,
                doc.path,
                doc.type,
                doc.index,
                doc.chunk_index,
                doc.chunk,
                doc.shasum,
                doc.vector
            ));
        } catch (error) {
            logError(`Error getting chunked file: ${JSON.stringify(error, null, 2)}`);
            return [];
        }
    }

    getChunksByShasum = async (
        owner: string,
        repository: string,
        branch: string,
        shasum: string,
    ): Promise<ChunkedFileChunk[]> => {
        try {
            const { data, error } = await this.supabase
                .from(this.CHUNKS_TABLE)
                .select('*')
                .eq('owner', owner)
                .eq('repository', repository)
                .eq('branch', branch)
                .eq('shasum', shasum)
                .order('chunk_index');

            if (error) {
                throw error;
            }

            if (!data) {
                return [];
            }

            return data.map((doc: any) => new ChunkedFileChunk(
                doc.owner,
                doc.repository,
                doc.branch,
                doc.path,
                doc.type,
                doc.index,
                doc.chunk_index,
                doc.chunk,
                doc.shasum,
                doc.vector
            ));
        } catch (error) {
            logError(`Error getting chunked file: ${JSON.stringify(error, null, 2)}`);
            throw error;
        }
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
        try {
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
        } catch (error) {
            logError(`Error updating vector: ${JSON.stringify(error, null, 2)}`);
            throw error;
        }
    }

    matchChunks = async (
        owner: string,
        repository: string,
        branch: string,
        type: string,
        queryEmbedding: number[],
        matchCount: number = 5
    ): Promise<ChunkedFileChunk[]> => {
        try {
            const { data, error } = await this.supabase
                .rpc('match_chunks', {
                    owner_param: owner,
                    repository_param: repository,
                    branch_param: branch,
                    type_param: type,
                    query_embedding: queryEmbedding,
                    match_count: matchCount
                });

            if (error) {
                logError(`Error matching chunks: ${JSON.stringify(error, null, 2)}`);
                throw error;
            }

            return data.map((doc: any) => new ChunkedFileChunk(
                doc.owner,
                doc.repository,
                doc.branch,
                doc.path,
                doc.type,
                doc.index,
                doc.chunk_index,
                doc.content,
                doc.shasum,
                doc.vector
            ));
        } catch (error) {
            logError(`Error matching chunks: ${JSON.stringify(error, null, 2)}`);
            throw error;
        }
    }
} 
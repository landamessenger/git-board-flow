import { createClient } from '@supabase/supabase-js';
import { COMMAND } from '../../utils/constants';
import { logError, logInfo } from '../../utils/logger';
import { ChunkedFile } from '../model/chunked_file';
import { ChunkedFileChunk } from '../model/chunked_file_chunk';
import { SupabaseConfig } from '../model/supabase_config';

export class SupabaseRepository {
    private readonly CHUNKS_TABLE = 'chunks';
    private readonly MAX_BATCH_SIZE = 500;
    private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds
    private supabase: any;

    constructor(config: SupabaseConfig) {
        const customFetch = async (input: string | URL | Request, init?: RequestInit) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.DEFAULT_TIMEOUT);

            try {
                const response = await fetch(input, {
                    ...init,
                    signal: controller.signal
                });
                return response;
            } finally {
                clearTimeout(timeoutId);
            }
        };

        this.supabase = createClient(config.getUrl(), config.getKey(), {
            global: {
                headers: {
                    'X-Client-Info': COMMAND
                },
                fetch: customFetch
            },
            db: {
                schema: 'public'
            },
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true
            }
        });
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
                    chunkedFile.vector = [];
                    logError(`Error inserting index ${chunkedFile.index} chunk ${index} for file ${chunkedFile.path}: ${JSON.stringify(chunkedFile, null, 2)}`);
                    logError(`Inserting error: ${JSON.stringify(error, null, 2)}`);
                    throw error;
                }
            });

            await Promise.all(insertPromises);
        } catch (error) {
            logError(`Error setting chunked file ${chunkedFile.path}: ${JSON.stringify(error, null, 2)}`);
            // throw error;
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

    duplicateChunksByBranch = async (
        owner: string,
        repository: string,
        sourceBranch: string,
        targetBranch: string,
    ): Promise<void> => {
        let hasMoreChunks = true;
        let offset = 0;
        const limit = this.MAX_BATCH_SIZE;
        let totalChunksProcessed = 0;

        while (hasMoreChunks) {
            // Get chunks from the source branch with pagination
            const { data: sourceChunks, error: fetchError } = await this.supabase
                .from(this.CHUNKS_TABLE)
                .select('*')
                .eq('owner', owner)
                .eq('repository', repository)
                .eq('branch', sourceBranch)
                .order('path', { ascending: true })
                .order('type', { ascending: true })
                .order('index', { ascending: true })
                .order('chunk_index', { ascending: true })
                .range(offset, offset + limit - 1);

            if (fetchError) {
                logError(`Error fetching chunks from source branch: ${JSON.stringify(fetchError, null, 2)}`);
                throw fetchError;
            }

            if (!sourceChunks || sourceChunks.length === 0) {
                if (totalChunksProcessed === 0) {
                    logInfo(`No chunks to duplicate from ${sourceBranch} to ${targetBranch}`);
                }
                hasMoreChunks = false;
                continue;
            }

            // Prepare the chunks for insertion with the new branch
            const chunksToInsert = sourceChunks.map((chunk: any) => ({
                ...chunk,
                branch: targetBranch,
                updated_at: new Date().toISOString()
            }));

            // Insert the chunks in batches
            const { error: insertError } = await this.supabase
                .from(this.CHUNKS_TABLE)
                .insert(chunksToInsert);

            if (insertError) {
                logError(`Error inserting batch of chunks: ${JSON.stringify(insertError, null, 2)}`);
                throw insertError;
            }

            totalChunksProcessed += sourceChunks.length;
            logInfo(`Processed ${totalChunksProcessed} chunks from ${sourceBranch} to ${targetBranch}`);
            
            // Move to the next page
            offset += limit;
        }
    }

    removeChunksByBranch = async (
        owner: string,
        repository: string,
        branch: string,
    ): Promise<void> => {
        let hasMoreChunks = true;
        let offset = 0;
        const limit = this.MAX_BATCH_SIZE;
        let totalChunksRemoved = 0;

        while (hasMoreChunks) {
            // Delete chunks in batches
            const { count, error } = await this.supabase
                .from(this.CHUNKS_TABLE)
                .delete()
                .eq('owner', owner)
                .eq('repository', repository)
                .eq('branch', branch)
                .order('path', { ascending: true })
                .order('type', { ascending: true })
                .order('index', { ascending: true })
                .order('chunk_index', { ascending: true })
                .limit(limit)
                .select('count');

            if (error) {
                logError(`Error removing chunks by branch: ${JSON.stringify(error, null, 2)}`);
                throw error;
            }

            if (count === 0) {
                if (totalChunksRemoved === 0) {
                    logInfo(`No chunks to remove from branch ${branch}`);
                }
                hasMoreChunks = false;
                continue;
            }

            totalChunksRemoved += count;
            logInfo(`Removed ${totalChunksRemoved} chunks from branch ${branch}`);
            
            // Move to the next batch
            offset += limit;
        }
    }

    getDistinctPaths = async (
        owner: string,
        repository: string,
        branch: string,
    ): Promise<string[]> => {
        try {            
            const { data, error } = await this.supabase
                .rpc('get_distinct_paths', {
                    owner_param: owner,
                    repository_param: repository,
                    branch_param: branch
                });

            if (error) {
                logError(`Error getting distinct paths for ${owner}/${repository}/${branch}: ${JSON.stringify(error, null, 2)}`);
                return [];
            }

            if (!data) {
                logInfo(`No data found for ${owner}/${repository}/${branch}`);
                return [];
            }

            const paths = data.map((doc: { path: string }) => doc.path);
            return paths;
        } catch (error) {
            logError(`Unexpected error getting distinct paths for ${owner}/${repository}/${branch}: ${JSON.stringify(error, null, 2)}`);
            if (error instanceof Error) {
                logError(`Error details: ${error.message}`);
                logError(`Error stack: ${error.stack}`);
            }
            return [];
        }
    }

    removeChunksByPath = async (
        owner: string,
        repository: string,
        branch: string,
        path: string,
    ): Promise<void> => {
        try {
            const { error } = await this.supabase
                .from(this.CHUNKS_TABLE)
                .delete()
                .eq('owner', owner)
                .eq('repository', repository)
                .eq('branch', branch)
                .eq('path', path);

            if (error) {
                throw error;
            }
        } catch (error) {
            logError(`Error removing chunks by path: ${JSON.stringify(error, null, 2)}`);
            throw error;
        }
    }

    getShasumByPath = async (
        owner: string,
        repository: string,
        branch: string,
        path: string,
    ): Promise<string | undefined> => {
        try {
            const { data, error } = await this.supabase
                .from(this.CHUNKS_TABLE)
                .select('*')
                .eq('owner', owner)
                .eq('repository', repository)
                .eq('branch', branch)
                .eq('path', path)
                .order('index')
                .order('chunk_index')
                .limit(1);

            if (error) {
                logError(`Supabase error getting chunks by path: ${JSON.stringify(error, null, 2)}`);
                return undefined;
            }

            if (!data) {
                return undefined;
            }

            return data[0].shasum;
        } catch (error) {
            // logError(`Error getting shasum by path: ${JSON.stringify(error, null, 2)}`);
            return undefined;
        }
    }
} 
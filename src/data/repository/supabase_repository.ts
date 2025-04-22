import { createClient } from '@supabase/supabase-js';
import { logError, logInfo } from '../../utils/logger';
import { ChunkedFile } from '../model/chunked_file';
import { ChunkedFileChunk } from '../model/chunked_file_chunk';
import { SupabaseConfig } from '../model/supabase_config';

export class SupabaseRepository {
    private readonly CHUNKS_TABLE = 'chunks';
    private readonly MAX_BATCH_SIZE = 500;
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

    duplicateChunksByBranch = async (
        owner: string,
        repository: string,
        sourceBranch: string,
        targetBranch: string,
    ): Promise<void> => {
        try {
            // First, check if there are any entries for the source branch
            const { count, error: countError } = await this.supabase
                .from(this.CHUNKS_TABLE)
                .select('*', { count: 'exact', head: true })
                .eq('owner', owner)
                .eq('repository', repository)
                .eq('branch', sourceBranch);

            if (countError) {
                logError(`Error checking source branch entries: ${JSON.stringify(countError, null, 2)}`);
                throw countError;
            }

            if (count === 0) {
                return; // No entries exist for source branch, exit early
            }

            // Get all chunks from the source branch
            const { data: sourceChunks, error: fetchError } = await this.supabase
                .from(this.CHUNKS_TABLE)
                .select('*')
                .eq('owner', owner)
                .eq('repository', repository)
                .eq('branch', sourceBranch);

            if (fetchError) {
                logError(`Error fetching chunks from source branch: ${JSON.stringify(fetchError, null, 2)}`);
                throw fetchError;
            }

            if (!sourceChunks || sourceChunks.length === 0) {
                return; // No chunks to duplicate
            }

            // Prepare the chunks for insertion with the new branch
            const chunksToInsert = sourceChunks.map((chunk: any) => ({
                ...chunk,
                branch: targetBranch,
                updated_at: new Date().toISOString()
            }));

            // Insert the chunks in batches
            const batchSize = this.MAX_BATCH_SIZE;
            for (let i = 0; i < chunksToInsert.length; i += batchSize) {
                const batch = chunksToInsert.slice(i, i + batchSize);
                const { error: insertError } = await this.supabase
                    .from(this.CHUNKS_TABLE)
                    .insert(batch);

                if (insertError) {
                    logError(`Error inserting batch of chunks: ${JSON.stringify(insertError, null, 2)}`);
                    throw insertError;
                }
            }
        } catch (error) {
            logError(`Error duplicating chunks by branch: ${JSON.stringify(error, null, 2)}`);
            throw error;
        }
    }

    removeChunksByBranch = async (
        owner: string,
        repository: string,
        branch: string,
    ): Promise<void> => {
        try {
            const { error } = await this.supabase
                .from(this.CHUNKS_TABLE)
                .delete()
                .eq('owner', owner)
                .eq('repository', repository)
                .eq('branch', branch);

            if (error) {
                logError(`Error removing chunks by branch: ${JSON.stringify(error, null, 2)}`);
                throw error;
            }
        } catch (error) {
            logError(`Error removing chunks by branch: ${JSON.stringify(error, null, 2)}`);
            throw error;
        }
    }

    getDistinctPaths = async (
        owner: string,
        repository: string,
        branch: string,
    ): Promise<string[]> => {
        try {
            logInfo(`Getting distinct paths for ${owner}/${repository}/${branch}`);
            
            // Verify connection
            const { data: testData, error: testError } = await this.supabase
                .from(this.CHUNKS_TABLE)
                .select('count')
                .limit(1);

            if (testError) {
                logError(`Supabase connection error: ${JSON.stringify(testError, null, 2)}`);
                return [];
            }

            logInfo(`Supabase connection verified for ${owner}/${repository}/${branch}`);
            
            const { data, error } = await this.supabase
                .from(this.CHUNKS_TABLE)
                .select('path')
                .eq('owner', owner)
                .eq('repository', repository)
                .eq('branch', branch)
                .order('path')
                .distinct();

            if (error) {
                logError(`Error getting distinct paths for ${owner}/${repository}/${branch}: ${JSON.stringify(error, null, 2)}`);
                return [];
            }

            if (!data) {
                logInfo(`No data found for ${owner}/${repository}/${branch}`);
                return [];
            }

            const paths = (data as { path: string }[]).map(doc => doc.path);
            logInfo(`Found ${paths.length} distinct paths for ${owner}/${repository}/${branch}`);
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
} 
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
        const count = await this.countBranchEntries(owner, repository, sourceBranch);
        logInfo(`Counting chunks in branch ${sourceBranch}: ${count}`);

        if (count < 10000) {
            await this.duplicateBranchEntries(owner, repository, sourceBranch, targetBranch);
        } else {
            const filePaths = await this.getDistinctPaths(owner, repository, sourceBranch);
            logInfo(`Counting files in branch ${sourceBranch}: ${filePaths.length}`);
            for (const path of filePaths) {
                await this.duplicateFileEntries(owner, repository, sourceBranch, path, targetBranch);
            }
        }
    }

    removeChunksByBranch = async (
        owner: string,
        repository: string,
        branch: string,
    ): Promise<void> => {
        const { error } = await this.supabase
            .rpc('delete_branch_entries', {
                owner_param: owner,
                repository_param: repository,
                branch_param: branch
            });

        if (error) {
            logError(`Error removing chunks from branch: ${JSON.stringify(error, null, 2)}`);
            throw error;
        }

        logInfo(`Checking if all chunks are deleted from branch ${branch}`);

         // Retry logic to ensure all chunks are deleted
         const maxRetries = 5;
         const retryDelay = 10000; // 1 second
         let retryCount = 0;
 
         while (retryCount < maxRetries) {
             const { data: chunks, error: chunksError } = await this.supabase
                 .from(this.CHUNKS_TABLE)
                 .select('*')
                 .eq('owner', owner)
                 .eq('repository', repository)
                 .eq('branch', branch)
 
             if (chunksError) {
                 logError(`Error checking chunks by branch: ${JSON.stringify(chunksError, null, 2)}`);
                 throw chunksError;
             }
 
             if (!chunks || chunks.length === 0) {
                 // No chunks found, deletion successful
                 logInfo(`Removed all chunks from branch ${branch}`);
                 return;
             }
 
             retryCount++;
             if (retryCount < maxRetries) {
                 logInfo(`Chunks still present for branch ${branch}, retrying in ${retryDelay}ms (attempt ${retryCount}/${maxRetries})`);
                 await new Promise(resolve => setTimeout(resolve, retryDelay));
             }
         }
 
         // If we reach here, we've exhausted all retries and chunks still exist
         logError(`There are still chunks left for this branch after ${maxRetries} attempts: ${branch}`);
         throw new Error(`There are still chunks left for this branch after ${maxRetries} attempts: ${branch}`);
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

    countBranchEntries = async (
        owner: string,
        repository: string,
        branch: string,
    ): Promise<number> => {
        try {
            const { data, error } = await this.supabase
                .rpc('count_branch_entries', {
                    owner_param: owner,
                    repository_param: repository,
                    branch_param: branch
                });

            if (error) {
                logError(`Error counting branch entries: ${JSON.stringify(error, null, 2)}`);
                return 0;
            }

            return data || 0;
        } catch (error) {
            logError(`Error counting branch entries: ${JSON.stringify(error, null, 2)}`);
            return 0;
        }
    }

    private duplicateFileEntries = async (
        owner: string,
        repository: string,
        sourceBranch: string,
        path: string,
        targetBranch: string,
    ): Promise<void> => {
        try {
            logInfo(`Duplicating file entries for ${owner}/${repository}/${sourceBranch}/${path} to ${targetBranch}`);

            const { error } = await this.supabase
                .rpc('duplicate_file_entries', {
                    owner_param: owner,
                    repository_param: repository,
                    source_branch_param: sourceBranch,
                    path_param: path,
                    target_branch_param: targetBranch
                });

            if (error) {
                logError(`Error duplicating file entries: ${JSON.stringify(error, null, 2)}`);
                throw error;
            }
        } catch (error) {
            logError(`Error duplicating file entries: ${JSON.stringify(error, null, 2)}`);
            throw error;
        }
    }

    private duplicateBranchEntries = async (
        owner: string,
        repository: string,
        sourceBranch: string,
        targetBranch: string,
    ): Promise<void> => {
        try {
            logInfo(`Duplicating branch entries for ${owner}/${repository}/${sourceBranch} to ${targetBranch}`);
            const { error } = await this.supabase
                .rpc('duplicate_branch_entries', {
                    owner_param: owner,
                    repository_param: repository,
                    source_branch_param: sourceBranch,
                    target_branch_param: targetBranch
                });

            if (error) {
                logError(`Error duplicating branch entries: ${JSON.stringify(error, null, 2)}`);
                throw error;
            }
        } catch (error) {
            logError(`Error duplicating branch entries: ${JSON.stringify(error, null, 2)}`);
            throw error;
        }
    }
} 
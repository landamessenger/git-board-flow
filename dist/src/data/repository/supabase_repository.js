"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabaseRepository = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const logger_1 = require("../../utils/logger");
const chunked_file_chunk_1 = require("../model/chunked_file_chunk");
class SupabaseRepository {
    constructor(config) {
        this.CHUNKS_TABLE = 'chunks';
        this.MAX_BATCH_SIZE = 500;
        this.MAX_PARALLEL_BATCHES = 5;
        this.setChunkedFile = async (owner, repository, branch, chunkedFile) => {
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
            }
            catch (error) {
                (0, logger_1.logError)(`Error setting chunked file ${chunkedFile.path}: ${JSON.stringify(error, null, 2)}`);
                throw error;
            }
        };
        this.removeChunksByShasum = async (owner, repository, branch, shasum) => {
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
            }
            catch (error) {
                (0, logger_1.logError)(`Error removing chunks by shasum: ${JSON.stringify(error, null, 2)}`);
                throw error;
            }
        };
        this.getChunkedFileByShasum = async (owner, repository, branch, type, shasum) => {
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
                    (0, logger_1.logError)(`Supabase error getting chunked file: ${JSON.stringify(error, null, 2)}`);
                    return [];
                }
                if (!data) {
                    return [];
                }
                return data.map((doc) => new chunked_file_chunk_1.ChunkedFileChunk(doc.owner, doc.repository, doc.branch, doc.path, doc.type, doc.index, doc.chunk_index, doc.content, doc.shasum, doc.vector));
            }
            catch (error) {
                (0, logger_1.logError)(`Error getting chunked file: ${JSON.stringify(error, null, 2)}`);
                return [];
            }
        };
        this.getChunks = async (owner, repository, branch, path, type, index) => {
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
                    (0, logger_1.logError)(`Supabase error getting chunked file: ${JSON.stringify(error, null, 2)}`);
                    return [];
                }
                if (!data) {
                    return [];
                }
                return data.map((doc) => new chunked_file_chunk_1.ChunkedFileChunk(doc.owner, doc.repository, doc.branch, doc.path, doc.type, doc.index, doc.chunk_index, doc.chunk, doc.shasum, doc.vector));
            }
            catch (error) {
                (0, logger_1.logError)(`Error getting chunked file: ${JSON.stringify(error, null, 2)}`);
                return [];
            }
        };
        this.getChunksByShasum = async (owner, repository, branch, shasum) => {
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
                return data.map((doc) => new chunked_file_chunk_1.ChunkedFileChunk(doc.owner, doc.repository, doc.branch, doc.path, doc.type, doc.index, doc.chunk_index, doc.chunk, doc.shasum, doc.vector));
            }
            catch (error) {
                (0, logger_1.logError)(`Error getting chunked file: ${JSON.stringify(error, null, 2)}`);
                throw error;
            }
        };
        this.updateVector = async (owner, repository, branch, path, index, chunkIndex, vector) => {
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
            }
            catch (error) {
                (0, logger_1.logError)(`Error updating vector: ${JSON.stringify(error, null, 2)}`);
                throw error;
            }
        };
        this.matchChunks = async (owner, repository, branch, type, queryEmbedding, matchCount = 5) => {
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
                    (0, logger_1.logError)(`Error matching chunks: ${JSON.stringify(error, null, 2)}`);
                    throw error;
                }
                return data.map((doc) => new chunked_file_chunk_1.ChunkedFileChunk(doc.owner, doc.repository, doc.branch, doc.path, doc.type, doc.index, doc.chunk_index, doc.content, doc.shasum, doc.vector));
            }
            catch (error) {
                (0, logger_1.logError)(`Error matching chunks: ${JSON.stringify(error, null, 2)}`);
                throw error;
            }
        };
        this.duplicateChunksByBranch = async (owner, repository, sourceBranch, targetBranch) => {
            try {
                // First, get all chunks from the source branch
                const { data: sourceChunks, error: fetchError } = await this.supabase
                    .from(this.CHUNKS_TABLE)
                    .select('*')
                    .eq('owner', owner)
                    .eq('repository', repository)
                    .eq('branch', sourceBranch);
                if (fetchError) {
                    (0, logger_1.logError)(`Error fetching chunks from source branch: ${JSON.stringify(fetchError, null, 2)}`);
                    throw fetchError;
                }
                if (!sourceChunks || sourceChunks.length === 0) {
                    return; // No chunks to duplicate
                }
                // Prepare the chunks for insertion with the new branch
                const chunksToInsert = sourceChunks.map((chunk) => ({
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
                        (0, logger_1.logError)(`Error inserting batch of chunks: ${JSON.stringify(insertError, null, 2)}`);
                        throw insertError;
                    }
                }
            }
            catch (error) {
                (0, logger_1.logError)(`Error duplicating chunks by branch: ${JSON.stringify(error, null, 2)}`);
                throw error;
            }
        };
        this.supabase = (0, supabase_js_1.createClient)(config.getUrl(), config.getKey());
    }
}
exports.SupabaseRepository = SupabaseRepository;

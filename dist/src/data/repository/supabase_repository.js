"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabaseRepository = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const chunked_file_1 = require("../model/chunked_file");
const crypto_1 = require("crypto");
class SupabaseRepository {
    constructor(config) {
        this.CHUNKS_TABLE = 'chunks';
        this.MAX_BATCH_SIZE = 500;
        this.MAX_PARALLEL_BATCHES = 5;
        this.setChunkedFile = async (owner, repository, branch, chunkedFile) => {
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
                    shasum: (0, crypto_1.createHash)('sha256').update(chunk).digest('hex'),
                    vector: chunkedFile.vector[index],
                    updated_at: new Date().toISOString()
                });
                if (error) {
                    throw error;
                }
            });
        };
        this.getChunkedFile = async (owner, repository, branch, shasum) => {
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
            return new chunked_file_1.ChunkedFile(data.path, data.index, data.type, data.content, [data.content]);
        };
        this.getChunksByFile = async (owner, repository, branch, path) => {
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
            return data.map((doc) => new chunked_file_1.ChunkedFile(doc.path, doc.index, doc.type, doc.content, [doc.content] // Since we store the content as a single string, we wrap it in an array
            ));
        };
        this.updateVector = async (owner, repository, branch, path, index, chunkIndex, vector) => {
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
        };
        this.supabase = (0, supabase_js_1.createClient)(config.getUrl(), config.getKey());
    }
}
exports.SupabaseRepository = SupabaseRepository;

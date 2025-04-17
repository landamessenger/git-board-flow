"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorActionUseCase = void 0;
const result_1 = require("../data/model/result");
const docker_repository_1 = require("../data/repository/docker_repository");
const file_repository_1 = require("../data/repository/file_repository");
const supabase_repository_1 = require("../data/repository/supabase_repository");
const logger_1 = require("../utils/logger");
class VectorActionUseCase {
    constructor() {
        this.taskId = 'VectorActionUseCase';
        this.dockerRepository = new docker_repository_1.DockerRepository();
        this.fileRepository = new file_repository_1.FileRepository();
        this.CODE_INSTRUCTION_BLOCK = "Represent the code for semantic search";
        this.CODE_INSTRUCTION_LINE = "Represent each line of code for retrieval";
    }
    async invoke(param) {
        (0, logger_1.logInfo)(`Executing ${this.taskId}.`);
        const results = [];
        try {
            if (!param.supabaseConfig) {
                results.push(new result_1.Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [
                        `Supabase config not found.`,
                    ],
                }));
                return results;
            }
            const supabaseRepository = new supabase_repository_1.SupabaseRepository(param.supabaseConfig);
            await this.dockerRepository.startContainer(param);
            const systemInfo = await this.dockerRepository.getSystemInfo(param);
            const chunkSize = systemInfo.parameters.chunk_size;
            const maxWorkers = systemInfo.parameters.max_workers;
            (0, logger_1.logInfo)(`🧑‍🏭 Max workers: ${maxWorkers}`);
            (0, logger_1.logInfo)(`🚚 Chunk size: ${chunkSize}`);
            (0, logger_1.logInfo)(`📦 Getting chunked files for ${param.owner}/${param.repo}/${param.commit.branch}`);
            const chunkedFiles = await this.fileRepository.getChunkedRepositoryContent(param.owner, param.repo, param.commit.branch, chunkSize, param.tokens.token, param.ai.getAiIgnoreFiles(), (fileName) => {
                (0, logger_1.logSingleLine)(`Checking file ${fileName}`);
            });
            (0, logger_1.logInfo)(`📦 ✅ Chunked files: ${chunkedFiles.length}`, true);
            const processedChunkedFiles = [];
            const totalFiles = chunkedFiles.length;
            const startTime = Date.now();
            for (let i = 0; i < chunkedFiles.length; i++) {
                const chunkedFile = chunkedFiles[i];
                const currentTime = Date.now();
                const elapsedTime = (currentTime - startTime) / 1000; // in seconds
                const progress = ((i + 1) / totalFiles) * 100;
                // Calculate estimated time remaining
                const estimatedTotalTime = (elapsedTime / (i + 1)) * totalFiles;
                const remainingTime = estimatedTotalTime - elapsedTime;
                (0, logger_1.logSingleLine)(`🔘 ${i + 1}/${totalFiles} (${progress.toFixed(1)}%) - Estimated time remaining: ${Math.ceil(remainingTime)} seconds | Checking [${chunkedFile.path}]`);
                let remoteChunkedFiles;
                try {
                    remoteChunkedFiles = await supabaseRepository.getChunksByShasum(param.owner, param.repo, param.commit.branch, chunkedFile.shasum);
                }
                catch (error) {
                    (0, logger_1.logError)(`Error checking file ${chunkedFile.path} in Supabase: ${JSON.stringify(error, null, 2)}`);
                    remoteChunkedFiles = [];
                }
                if (remoteChunkedFiles.length > 0 && remoteChunkedFiles.length === chunkedFile.chunks.length) {
                    processedChunkedFiles.push(chunkedFile);
                    (0, logger_1.logDebugInfo)(`📦 ✅ Chunk already exists in Supabase: [${chunkedFile.path}] [${chunkedFile.index}]`, true);
                    continue;
                }
                else if (remoteChunkedFiles.length > 0 && remoteChunkedFiles.length !== chunkedFile.chunks.length) {
                    (0, logger_1.logDebugInfo)(`📦 ❌ Chunk has a different number of chunks in Supabase: [${chunkedFile.path}] [${chunkedFile.index}]`, true);
                }
                (0, logger_1.logSingleLine)(`🟡 ${i + 1}/${totalFiles} (${progress.toFixed(1)}%) - Estimated time remaining: ${Math.ceil(remainingTime)} seconds | Vectorizing [${chunkedFile.path}]`);
                const embeddings = await this.dockerRepository.getEmbedding(param, chunkedFile.chunks.map(chunk => [chunkedFile.type === 'block' ? this.CODE_INSTRUCTION_BLOCK : this.CODE_INSTRUCTION_LINE, chunk]));
                chunkedFile.vector = embeddings;
                (0, logger_1.logSingleLine)(`🟢 ${i + 1}/${totalFiles} (${progress.toFixed(1)}%) - Estimated time remaining: ${Math.ceil(remainingTime)} seconds | Storing [${chunkedFile.path}]`);
                await supabaseRepository.setChunkedFile(param.owner, param.repo, param.commit.branch, chunkedFile);
                processedChunkedFiles.push(chunkedFile);
            }
            const totalDurationSeconds = (Date.now() - startTime) / 1000;
            (0, logger_1.logDebugInfo)(`📦 🚀 All chunked files stored ${param.owner}/${param.repo}/${param.commit.branch}. Total duration: ${Math.ceil(totalDurationSeconds)} seconds`, true);
            results.push(new result_1.Result({
                id: this.taskId,
                success: true,
                executed: true,
                steps: [
                    `Vector action executed successfully.`,
                ],
            }));
        }
        catch (error) {
            (0, logger_1.logError)('Error in VectorActionUseCase: ' + JSON.stringify(error, null, 2));
            results.push(new result_1.Result({
                id: this.taskId,
                success: false,
                executed: true,
                steps: [
                    `Error in VectorActionUseCase: ${JSON.stringify(error, null, 2)}`,
                ],
            }));
        }
        finally {
            await this.dockerRepository.stopContainer(param);
        }
        return results;
    }
}
exports.VectorActionUseCase = VectorActionUseCase;

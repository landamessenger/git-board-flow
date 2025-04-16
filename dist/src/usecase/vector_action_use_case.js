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
        this.CODE_INSTRUCTION = "Represent the code for semantic search";
    }
    async invoke(param) {
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
            (0, logger_1.logDebugInfo)(`System info: ${JSON.stringify(systemInfo, null, 2)}`);
            const chunkSize = systemInfo.parameters.chunk_size;
            const maxWorkers = systemInfo.parameters.max_workers;
            (0, logger_1.logDebugInfo)(`Getting chunked files for ${param.repo} ${param.commit.branch}`);
            const chunkedFiles = await this.fileRepository.getChunkedRepositoryContent(param.owner, param.repo, param.commit.branch, chunkSize, param.tokens.token, param.ai.getAiIgnoreFiles(), (fileName) => {
                (0, logger_1.logSingleLine)(`Checking file ${fileName}`);
            });
            (0, logger_1.logDebugInfo)(`Chunked files: ${chunkedFiles.length}`);
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
                (0, logger_1.logDebugInfo)(`Processing file ${i + 1}/${totalFiles} (${progress.toFixed(1)}%) - Estimated time remaining: ${Math.ceil(remainingTime)} seconds`);
                const remoteChunkedFile = await supabaseRepository.getChunkedFile(param.owner, param.repo, param.commit.branch, chunkedFile.shasum);
                if (remoteChunkedFile && remoteChunkedFile.vector.length > 0) {
                    processedChunkedFiles.push(chunkedFile);
                    continue;
                }
                const embeddings = await this.dockerRepository.getEmbedding(param, chunkedFile.chunks.map(chunk => [this.CODE_INSTRUCTION, chunk]));
                chunkedFile.vector = embeddings;
                await supabaseRepository.setChunkedFile(param.owner, param.repo, param.commit.branch, chunkedFile);
                processedChunkedFiles.push(chunkedFile);
            }
            (0, logger_1.logDebugInfo)(`All chunked files set to firestore for ${param.repo} ${param.commit.branch}`);
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

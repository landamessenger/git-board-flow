"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AskActionUseCase = void 0;
const result_1 = require("../../data/model/result");
const docker_repository_1 = require("../../data/repository/docker_repository");
const file_repository_1 = require("../../data/repository/file_repository");
const supabase_repository_1 = require("../../data/repository/supabase_repository");
const logger_1 = require("../../utils/logger");
class AskActionUseCase {
    constructor() {
        this.taskId = 'AskActionUseCase';
        this.dockerRepository = new docker_repository_1.DockerRepository();
        this.fileRepository = new file_repository_1.FileRepository();
        this.CODE_INSTRUCTION_BLOCK = "Represent the code for semantic search";
        this.CODE_INSTRUCTION_LINE = "Represent each line of code for retrieval";
        this.CODE_INSTRUCTION_ASK = "Represent the question for retrieving relevant code snippets";
    }
    async invoke(param) {
        (0, logger_1.logInfo)(`Executing ${this.taskId}.`);
        const results = [];
        try {
            /**
             * Check if the user from the token is found.
             */
            if (!param.tokenUser) {
                results.push(new result_1.Result({
                    id: this.taskId,
                    success: false,
                    executed: false,
                    errors: [
                        `User from token not found.`,
                    ],
                }));
                return results;
            }
            /**
             * Get the comment body.
             */
            let commentBody = '';
            if (param.issue.isIssueComment) {
                commentBody = param.issue.commentBody;
            }
            else if (param.pullRequest.isPullRequestReviewComment) {
                commentBody = param.pullRequest.commentBody;
            }
            else {
                (0, logger_1.logError)(`Not a valid comment body.`);
                results.push(new result_1.Result({
                    id: this.taskId,
                    success: true,
                    executed: false,
                }));
                return results;
            }
            /**
             * Check if the comment body includes the user from the token.
             */
            if (!commentBody.includes(param.tokenUser)) {
                results.push(new result_1.Result({
                    id: this.taskId,
                    success: true,
                    executed: false,
                }));
                return results;
            }
            else {
                commentBody = commentBody.replace(param.tokenUser, '').trim();
            }
            /**
             * Check if the supabase config is found.
             */
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
            const startTime = Date.now();
            const embeddings = await this.dockerRepository.getEmbedding(param, [
                [this.CODE_INSTRUCTION_ASK, commentBody]
            ]);
            (0, logger_1.logInfo)(`🔎 Embeddings: ${JSON.stringify(embeddings, null, 2)}`);
            const types = ['line', 'block'];
            const chunks = [];
            for (const type of types) {
                (0, logger_1.logInfo)(`📦 🔎 Matching chunks for ${param.owner}/${param.repo}/${param.commit.branch}`);
                const foundChunks = await supabaseRepository.matchChunks(param.owner, param.repo, param.commit.branch, type, embeddings[0], 5);
                for (const chunk of foundChunks) {
                    (0, logger_1.logDebugInfo)(`📦 🔎 Chunk type: ${type} - ${chunk.path}`);
                }
                chunks.push(...foundChunks);
            }
            const totalDurationSeconds = (Date.now() - startTime) / 1000;
            (0, logger_1.logInfo)(`📦 🔎 Matched chunks for ${param.owner}/${param.repo}/${param.commit.branch}:\n Total duration: ${Math.ceil(totalDurationSeconds)} seconds`);
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
            (0, logger_1.logError)(`Error in ${this.taskId}: ${JSON.stringify(error, null, 2)}`);
            results.push(new result_1.Result({
                id: this.taskId,
                success: false,
                executed: true,
                steps: [
                    `Error in ${this.taskId}: ${JSON.stringify(error, null, 2)}`,
                ],
            }));
        }
        finally {
            await this.dockerRepository.stopContainer(param);
        }
        return results;
    }
}
exports.AskActionUseCase = AskActionUseCase;

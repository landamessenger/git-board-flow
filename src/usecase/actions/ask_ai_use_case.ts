import { ChunkedFile } from '../../data/model/chunked_file';
import { ChunkedFileChunk } from '../../data/model/chunked_file_chunk';
import { Execution } from '../../data/model/execution';
import { Result } from '../../data/model/result';
import { DockerRepository } from '../../data/repository/docker_repository';
import { FileRepository } from '../../data/repository/file_repository';
import { SupabaseRepository } from '../../data/repository/supabase_repository';
import { logDebugInfo, logError, logInfo, logSingleLine } from '../../utils/logger';
import { ParamUseCase } from '../base/param_usecase';

export class AskActionUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'AskActionUseCase';
    private dockerRepository: DockerRepository = new DockerRepository();
    private fileRepository: FileRepository = new FileRepository();
    private readonly CODE_INSTRUCTION_BLOCK = "Represent the code for semantic search";
    private readonly CODE_INSTRUCTION_LINE = "Represent each line of code for retrieval";
    private readonly CODE_INSTRUCTION_ASK = "Represent the question for retrieving relevant code snippets";

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId}.`)

        const results: Result[] = [];

        try {
            /**
             * Check if the user from the token is found.
             */
            if (!param.tokenUser) {
                results.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: false,
                        errors: [
                            `User from token not found.`,
                        ],
                    })
                )
                return results;
            }

            /**
             * Get the comment body.
             */
            let commentBody = '';
            if (param.issue.isIssueComment) {
                commentBody = param.issue.commentBody;
            } else if (param.pullRequest.isPullRequestReviewComment) {
                commentBody = param.pullRequest.commentBody;
            } else {
                logError(`Not a valid comment body.`);
                results.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: false,
                    })
                )
                return results;
            }

            /**
             * Check if the comment body includes the user from the token.
             */
            if (!commentBody.includes(param.tokenUser)) {
                results.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: false,
                    })
                )
                return results;
            } else {
                commentBody = commentBody.replace(param.tokenUser, '').trim();
            }

            /**
             * Check if the supabase config is found.
             */
            if (!param.supabaseConfig) {
                results.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: true,
                        steps: [
                            `Supabase config not found.`,
                        ],
                    })
                )
                return results;
            }

            const supabaseRepository: SupabaseRepository = new SupabaseRepository(param.supabaseConfig);

            await this.dockerRepository.startContainer(param);

            const systemInfo = await this.dockerRepository.getSystemInfo(param);
            const chunkSize = systemInfo.parameters.chunk_size as number;
            const maxWorkers = systemInfo.parameters.max_workers as number;

            logInfo(`🧑‍🏭 Max workers: ${maxWorkers}`);
            logInfo(`🚚 Chunk size: ${chunkSize}`);
            logInfo(`📦 Getting chunked files for ${param.owner}/${param.repo}/${param.commit.branch}`);

            const startTime = Date.now();
            
            const embeddings = await this.dockerRepository.getEmbedding(
                param,
                [
                    [this.CODE_INSTRUCTION_ASK, commentBody]
                ]
            );

            logInfo(`🔎 Embeddings: ${JSON.stringify(embeddings, null, 2)}`);

            const types = ['line', 'block'];
            const chunks: ChunkedFileChunk[] = [];
            for (const type of types) {
                logInfo(`📦 🔎 Matching chunks for ${param.owner}/${param.repo}/${param.commit.branch}`);
                const foundChunks = await supabaseRepository.matchChunks(
                    param.owner,
                    param.repo,
                    param.commit.branch,
                    type,
                    embeddings[0],
                    5
                );

                for (const chunk of foundChunks) {
                    logDebugInfo(`📦 🔎 Chunk type: ${type} - ${chunk.path}`);
                }

                chunks.push(...foundChunks);
            }



            const totalDurationSeconds = (Date.now() - startTime) / 1000;
            logInfo(`📦 🔎 Matched chunks for ${param.owner}/${param.repo}/${param.commit.branch}:\n Total duration: ${Math.ceil(totalDurationSeconds)} seconds`);
                        
            results.push(
                new Result({
                    id: this.taskId,
                    success: true,
                    executed: true,
                    steps: [
                        `Vector action executed successfully.`,
                    ],
                })
            );

        } catch (error) {
            logError(`Error in ${this.taskId}: ${JSON.stringify(error, null, 2)}`);
            results.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [
                        `Error in ${this.taskId}: ${JSON.stringify(error, null, 2)}`,
                    ],
                })
            );
        } finally {
            await this.dockerRepository.stopContainer(param);
        }

        return results;
    }
} 
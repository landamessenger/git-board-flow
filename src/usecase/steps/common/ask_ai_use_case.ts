import { AiResponse } from '../../../data/model/ai_response';
import { ChunkedFileChunk } from '../../../data/model/chunked_file_chunk';
import { Execution } from '../../../data/model/execution';
import { Result } from '../../../data/model/result';
import { AiRepository } from '../../../data/repository/ai_repository';
import { DockerRepository } from '../../../data/repository/docker_repository';
import { FileRepository, FileTreeNodeWithContent } from '../../../data/repository/file_repository';
import { IssueRepository } from '../../../data/repository/issue_repository';
import { SupabaseRepository } from '../../../data/repository/supabase_repository';
import { logDebugInfo, logError, logInfo, logSingleLine } from '../../../utils/logger';
import { ParamUseCase } from '../../base/param_usecase';

export class AskActionUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'AskActionUseCase';
    private dockerRepository: DockerRepository = new DockerRepository();
    private fileRepository: FileRepository = new FileRepository();
    private aiRepository: AiRepository = new AiRepository();
    private issueRepository: IssueRepository = new IssueRepository();

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

            let description = '';
            let commentBody = '';

            /**
             * Get the comment body.
             */
            if (param.issue.isIssueComment) {
                commentBody = param.issue.commentBody;
                description = await this.issueRepository.getDescription(
                    param.owner,
                    param.repo,
                    param.issueNumber,
                    param.tokenUser
                ) ?? '';
            } else if (param.pullRequest.isPullRequestReviewComment) {
                commentBody = param.pullRequest.commentBody;
                description = await this.issueRepository.getDescription(
                    param.owner,
                    param.repo,
                    param.issueNumber,
                    param.tokenUser
                ) ?? '';
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

            if (commentBody.length === 0 || !commentBody.includes(`@${param.tokenUser}`)) {
                results.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: false,
                    })
                );
                return results;
            } else {
                commentBody = commentBody.replace(param.tokenUser, '').trim();
            }

            if (param.ai.getOpenRouterModel().length === 0 || param.ai.getOpenRouterApiKey().length === 0) {
                results.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: false,
                        errors: [
                            `OpenRouter model or API key not found.`,
                        ],
                    })
                )
                return results;
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

            // logInfo(`🔎 Embeddings: ${JSON.stringify(embeddings, null, 2)}`);

            const types = [
                // 'line',
                'block'
            ];
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

            const { withContent, withoutContent } = await this.fileRepository.getFileTree(
                param.owner,
                param.repo,
                param.tokens.token,
                param.commit.branch,
                param.ai.getAiIgnoreFiles(),
                (fileName: string) => {
                    logSingleLine(`Checking file ${fileName}`);
                }
            );

            let workComplete = false;
            let relatedFiles: Map<string, string> = new Map();
            let finalResponse = '';

            while (!workComplete) {
                const prompt = `
                You are a highly skilled code analysis assistant. I will provide you with:
                1. A user's question about a codebase
                2. A file tree representing the structure of the project
                3. The most relevant code snippets from the codebase related to their query

                Your tasks are:
                - Analyze the code snippets in the context of the user's question.
                - Use the file tree to provide additional context if needed (e.g., to understand module relationships).
                - Provide your answer **only** in a JSON format, following this structure:

                {
                    "text_response": "Your detailed analysis or answer here.",
                    "action": "none" | "analyze_files",
                    "related_files": ["optional", "list", "of", "files"],
                    "complete": true | false
                }

                Explanation:
                - If the provided code snippets and file tree are sufficient to confidently answer the question, set "complete": true and "action": "none".
                - If you determine that you need to review additional files to provide a complete and accurate answer, set "complete": false, "action": "analyze_files", and list the related file paths you need to investigate further in "related_files".
                - Do not invent file paths; only request files that logically relate to the question based on the information available.
                - Always provide a "text_response" with your reasoning, even if requesting more files.

                Important:
                - **Respond only with the JSON object**, without any extra commentary or text outside of the JSON.

                Information provided:
                User's question:
                ${commentBody}

                File tree:
                ${JSON.stringify(withoutContent, null, 2)}

                Relevant code snippets:
                ${relatedFiles.size > 0 
                    ? Array.from(relatedFiles.entries()).map(([path, content]) => `\nFile: ${path}\nCode:\n${content}`).join('\n')
                    : chunks.map(chunk => `\nFile: ${chunk.path}\nCode:\n${chunk.chunk}`).join('\n')}
                `;

                const jsonResponse = await this.aiRepository.askJson(
                    param.ai,
                    prompt,
                ) as AiResponse;

                if (!jsonResponse) {
                    logError(`No result from AI.`);
                    results.push(
                        new Result({
                            id: this.taskId,
                            success: false,
                            executed: true,
                            steps: [
                                `Error in ${this.taskId}: No result from AI.`,
                            ],
                        })
                    );
                    return results;
                }

                logInfo(`🔎 Result: ${JSON.stringify(jsonResponse, null, 2)}`);

                workComplete = jsonResponse.complete;

                if (jsonResponse.action === 'analyze_files') {
                    relatedFiles = this.getRelatedFiles(jsonResponse.related_files, withContent);
                } else if (jsonResponse.action === 'none') {
                    finalResponse = jsonResponse.text_response;
                }
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

    private getRelatedFiles(relatedFiles: string[], tree: FileTreeNodeWithContent): Map<string, string> {
        const result = new Map<string, string>();
        
        const findFile = (node: FileTreeNodeWithContent, targetPath: string): FileTreeNodeWithContent | null => {
            if (node.path === targetPath) {
                return node;
            }
            
            if (node.children) {
                for (const child of node.children) {
                    const found = findFile(child, targetPath);
                    if (found) {
                        return found;
                    }
                }
            }
            
            return null;
        };
        
        for (const filePath of relatedFiles) {
            const fileNode = findFile(tree, filePath);
            if (fileNode && fileNode.type === 'file' && fileNode.content) {
                result.set(filePath, fileNode.content);
            }
        }
        
        return result;
    }
} 
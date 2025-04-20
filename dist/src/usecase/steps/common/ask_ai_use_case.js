"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AskActionUseCase = void 0;
const result_1 = require("../../../data/model/result");
const ai_repository_1 = require("../../../data/repository/ai_repository");
const docker_repository_1 = require("../../../data/repository/docker_repository");
const file_repository_1 = require("../../../data/repository/file_repository");
const issue_repository_1 = require("../../../data/repository/issue_repository");
const supabase_repository_1 = require("../../../data/repository/supabase_repository");
const logger_1 = require("../../../utils/logger");
class AskActionUseCase {
    constructor() {
        this.taskId = 'AskActionUseCase';
        this.dockerRepository = new docker_repository_1.DockerRepository();
        this.fileRepository = new file_repository_1.FileRepository();
        this.aiRepository = new ai_repository_1.AiRepository();
        this.issueRepository = new issue_repository_1.IssueRepository();
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
            let description = '';
            let commentBody = '';
            /**
             * Get the comment body.
             */
            if (param.issue.isIssueComment) {
                commentBody = param.issue.commentBody;
                description = await this.issueRepository.getDescription(param.owner, param.repo, param.issueNumber, param.tokenUser) ?? '';
            }
            else if (param.pullRequest.isPullRequestReviewComment) {
                commentBody = param.pullRequest.commentBody;
                description = await this.issueRepository.getDescription(param.owner, param.repo, param.issueNumber, param.tokenUser) ?? '';
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
            if (commentBody.length === 0 || !commentBody.includes(`@${param.tokenUser}`)) {
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
            if (param.ai.getOpenRouterModel().length === 0 || param.ai.getOpenRouterApiKey().length === 0) {
                results.push(new result_1.Result({
                    id: this.taskId,
                    success: false,
                    executed: false,
                    errors: [
                        `OpenRouter model or API key not found.`,
                    ],
                }));
                return results;
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
            // logInfo(`🔎 Embeddings: ${JSON.stringify(embeddings, null, 2)}`);
            const types = [
                // 'line',
                'block'
            ];
            const chunks = [];
            for (const type of types) {
                (0, logger_1.logInfo)(`📦 🔎 Matching chunks for ${param.owner}/${param.repo}/${param.commit.branch}`);
                const foundChunks = await supabaseRepository.matchChunks(param.owner, param.repo, param.commit.branch, type, embeddings[0], 5);
                for (const chunk of foundChunks) {
                    (0, logger_1.logDebugInfo)(`📦 🔎 Chunk type: ${type} - ${chunk.path}`);
                }
                chunks.push(...foundChunks);
            }
            const { withContent, withoutContent } = await this.fileRepository.getFileTree(param.owner, param.repo, param.tokens.token, param.commit.branch, param.ai.getAiIgnoreFiles(), (fileName) => {
                (0, logger_1.logSingleLine)(`Checking file ${fileName}`);
            });
            let workComplete = false;
            let relatedFiles = new Map();
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
                const jsonResponse = await this.aiRepository.askJson(param.ai, prompt);
                if (!jsonResponse) {
                    (0, logger_1.logError)(`No result from AI.`);
                    results.push(new result_1.Result({
                        id: this.taskId,
                        success: false,
                        executed: true,
                        steps: [
                            `Error in ${this.taskId}: No result from AI.`,
                        ],
                    }));
                    return results;
                }
                (0, logger_1.logInfo)(`🔎 Result: ${JSON.stringify(jsonResponse, null, 2)}`);
                workComplete = jsonResponse.complete;
                if (jsonResponse.action === 'analyze_files') {
                    relatedFiles = this.getRelatedFiles(jsonResponse.related_files, withContent);
                }
                else if (jsonResponse.action === 'none') {
                    finalResponse = jsonResponse.text_response;
                }
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
    getRelatedFiles(relatedFiles, tree) {
        const result = new Map();
        const findFile = (node, targetPath) => {
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
exports.AskActionUseCase = AskActionUseCase;

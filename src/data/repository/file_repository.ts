import * as github from "@actions/github";
import { logError } from "../../utils/logger";
import { ChunkedFile } from "../model/chunked_file";

export class FileRepository {
    getFileContent = async (
        owner: string,
        repository: string,
        path: string,
        token: string,
        branch: string
    ): Promise<string> => {
        const octokit = github.getOctokit(token);

        try {
            const { data } = await octokit.rest.repos.getContent({
                owner,
                repo: repository,
                path,
                ref: branch
            });

            if ('content' in data) {
                return Buffer.from(data.content, 'base64').toString();
            }
            return '';
        } catch (error) {
            logError(`Error getting file content: ${error}.`);
            return '';
        }
    };

    getRepositoryContent = async (
        owner: string,
        repository: string,
        token: string,
        branch: string
    ): Promise<Map<string, string>> => {
        const octokit = github.getOctokit(token);
        const fileContents = new Map<string, string>();

        try {
            const getContentRecursively = async (path: string = '') => {
                const { data } = await octokit.rest.repos.getContent({
                    owner,
                    repo: repository,
                    path,
                    ref: branch
                });

                if (Array.isArray(data)) {
                    for (const item of data) {
                        if (item.type === 'file') {
                            const content = await this.getFileContent(owner, repository, item.path, token, branch);
                            fileContents.set(item.path, content);
                        } else if (item.type === 'dir') {
                            await getContentRecursively(item.path);
                        }
                    }
                }
            };

            await getContentRecursively();
            return fileContents;
        } catch (error) {
            logError(`Error getting repository content: ${error}.`);
            return new Map();
        }
    }

    getChunkedRepositoryContent = async (
        owner: string,
        repository: string,
        branch: string,
        chunkSize: number,
        token: string,
    ): Promise<ChunkedFile[]> => {
        const fileContents = await this.getRepositoryContent(owner, repository, token, branch);
        const chunkedFiles: ChunkedFile[] = [];

        for (const [path, content] of fileContents.entries()) {
            const lines = content.split('\n');
            const chunks: string[][] = [];
            let currentChunk: string[] = [];

            for (const line of lines) {
                currentChunk.push(line);
                if (currentChunk.length >= chunkSize) {
                    chunks.push([...currentChunk]);
                    currentChunk = [];
                }
            }

            // Add the last chunk if it's not empty
            if (currentChunk.length > 0) {
                chunks.push(currentChunk);
            }

            // Create ChunkedFile objects for each chunk
            chunks.forEach((chunkLines, index) => {
                const chunkContent = chunkLines.join('\n');
                chunkedFiles.push(new ChunkedFile(`${path}-${index}`, path, index, chunkContent, chunkLines));
            });
        }

        return chunkedFiles;    
    }
} 
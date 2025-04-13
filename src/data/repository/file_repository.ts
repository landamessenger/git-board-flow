import * as github from "@actions/github";
import { logError } from "../../utils/logger";

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
} 
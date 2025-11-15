import * as github from "@actions/github";
import { logError } from "../../utils/logger";

export class FileRepository {
    private isMediaOrPdfFile(path: string): boolean {
        const mediaExtensions = [
            // Image formats
            '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp', '.ico',
            // Audio formats
            '.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac',
            // Video formats
            '.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm',
            // PDF
            '.pdf'
        ];
        const extension = path.toLowerCase().substring(path.lastIndexOf('.'));
        return mediaExtensions.includes(extension);
    }

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
        branch: string,
        ignoreFiles: string[],
        progress: (fileName: string) => void,
        ignoredFiles: (fileName: string) => void,
    ): Promise<Map<string, string>> => {
        const octokit = github.getOctokit(token);
        const fileContents = new Map<string, string>();

        try {
            const getContentRecursively = async (path: string = ''): Promise<void> => {
                const { data } = await octokit.rest.repos.getContent({
                    owner,
                    repo: repository,
                    path,
                    ref: branch
                });

                if (Array.isArray(data)) {
                    const promises: Promise<void>[] = [];

                    for (const item of data) {
                        if (item.type === 'file') {
                            if (this.isMediaOrPdfFile(item.path) || this.shouldIgnoreFile(item.path, ignoreFiles)) {
                                ignoredFiles(item.path);
                                continue;
                            }
                            progress(item.path);
                            const filePromise = (async () => {
                                const content = await this.getFileContent(owner, repository, item.path, token, branch);
                                fileContents.set(item.path, content);
                            })();
                            promises.push(filePromise);
                        } else if (item.type === 'dir') {
                            promises.push(getContentRecursively(item.path));
                        }
                    }

                    await Promise.all(promises);
                }
            };

            await getContentRecursively();
            return fileContents;
        } catch (error) {
            logError(`Error getting repository content: ${error}.`);
            return new Map();
        }
    }

    private shouldIgnoreFile(filename: string, ignorePatterns: string[]): boolean {
        // First check for .DS_Store
        if (filename.endsWith('.DS_Store')) {
            return true;
        }

        return ignorePatterns.some(pattern => {
            // Convert glob pattern to regex
            const regexPattern = pattern
                .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special regex characters (sin afectar *)
                .replace(/\*/g, '.*') // Convert * to match anything
                .replace(/\//g, '\\/'); // Escape forward slashes
    
            // Allow pattern ending on /* to ignore also subdirectories and files inside
            if (pattern.endsWith("/*")) {
                return new RegExp(`^${regexPattern.replace(/\\\/\.\*$/, "(\\/.*)?")}$`).test(filename);
            }
    
            const regex = new RegExp(`^${regexPattern}$`);
            return regex.test(filename);
        });
    }
} 
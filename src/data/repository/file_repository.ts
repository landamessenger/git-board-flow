import * as github from "@actions/github";
import { logError, logInfo } from "../../utils/logger";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

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
        const fileContents = new Map<string, string>();
        let tempDir: string | null = null;

        try {
            // Create temporary directory
            tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'git-clone-'));
            const repoPath = path.join(tempDir, repository);

            // Clone repository using git clone with authentication
            // GitHub tokens are typically safe to use directly in URLs
            const repoUrl = `https://${token}@github.com/${owner}/${repository}.git`;
            logInfo(`📥 Cloning repository ${owner}/${repository} (branch: ${branch})...`);
            
            // Use --single-branch to optimize clone and --depth 1 for shallow clone
            // This significantly reduces clone time and size
            await execAsync(`git clone --depth 1 --single-branch --branch ${branch} ${repoUrl} ${repoPath}`, {
                cwd: tempDir,
                env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
                maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large outputs
            });

            logInfo(`✅ Repository cloned successfully`);

            // Read files recursively from filesystem
            const readFilesRecursively = async (dirPath: string, relativePath: string = ''): Promise<void> => {
                const entries = await fs.readdir(dirPath, { withFileTypes: true });

                for (const entry of entries) {
                    const fullPath = path.join(dirPath, entry.name);
                    const relativeFilePath = relativePath ? path.join(relativePath, entry.name) : entry.name;
                    // Normalize path separators to forward slashes (GitHub style)
                    const normalizedPath = relativeFilePath.replace(/\\/g, '/');

                    if (entry.isDirectory()) {
                        // Skip .git directory
                        if (entry.name === '.git') {
                            continue;
                        }
                        await readFilesRecursively(fullPath, normalizedPath);
                    } else if (entry.isFile()) {
                        // Check if file should be ignored
                        if (this.isMediaOrPdfFile(normalizedPath) || this.shouldIgnoreFile(normalizedPath, ignoreFiles)) {
                            ignoredFiles(normalizedPath);
                            continue;
                        }

                        progress(normalizedPath);
                        try {
                            const content = await fs.readFile(fullPath, 'utf-8');
                            fileContents.set(normalizedPath, content);
                        } catch (error) {
                            logError(`Error reading file ${normalizedPath}: ${error}`);
                        }
                    }
                }
            };

            await readFilesRecursively(repoPath);
            return fileContents;
        } catch (error) {
            logError(`Error getting repository content: ${error}.`);
            return new Map();
        } finally {
            // Clean up temporary directory
            if (tempDir) {
                try {
                    await fs.rm(tempDir, { recursive: true, force: true });
                    logInfo(`🧹 Cleaned up temporary directory`);
                } catch (cleanupError) {
                    logError(`Error cleaning up temporary directory: ${cleanupError}`);
                }
            }
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
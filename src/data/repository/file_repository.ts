import * as github from "@actions/github";
import { logError } from "../../utils/logger";
import { ChunkedFile } from "../model/chunked_file";
import { createHash } from "crypto";

type Block = {
    type: 'function' | 'class' | 'other';
    name?: string;
    content: string;
    startLine: number;
    endLine: number;
};

export interface FileTreeNodeWithNoContent {
    name: string;
    type: 'file' | 'directory';
    children?: FileTreeNodeWithNoContent[];
    path: string;
    content?: string;
}

export interface FileTreeNodeWithContent {
    name: string;
    type: 'file' | 'directory';
    children?: FileTreeNodeWithContent[];
    path: string;
    content?: string;
}

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
                        if (item.type === 'file' && !this.isMediaOrPdfFile(item.path) && !this.shouldIgnoreFile(item.path, ignoreFiles)) {
                            progress(item.path);
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
        ignoreFiles: string[],
        progress: (fileName: string) => void
    ): Promise<ChunkedFile[]> => {
        const fileContents = await this.getRepositoryContent(owner, repository, token, branch, ignoreFiles, progress);
        const chunkedFiles: ChunkedFile[] = [];

        for (const [path, content] of fileContents.entries()) {
            chunkedFiles.push(...this.getChunksByLines(path, content, chunkSize));
            chunkedFiles.push(...this.getChunksByBlocks(path, content, chunkSize));
        }

        return this.shuffleArray(chunkedFiles);    
    }

    getChunksByLines = (path: string, content: string, chunkSize: number): ChunkedFile[] => {
        const chunkedFiles: ChunkedFile[] = [];
        const lines = content.split('\n');
        const chunks: string[][] = [];
        let currentChunk: string[] = [];

        for (const line of lines) {
            if (this.shouldIgnoreLine(line)) {
                continue;
            }
            currentChunk.push(line.trim());
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
            chunkedFiles.push(
                new ChunkedFile(
                    path,
                    index,
                    'line',
                    chunkContent,
                    this.calculateShasum(chunkContent),
                    chunkLines
                )
            );
        });

        return chunkedFiles;
    }

    getChunksByBlocks = (path: string, content: string, chunkSize: number): ChunkedFile[] => {
        const chunkedFiles: ChunkedFile[] = [];
        const blocks = this.extractCodeBlocks(content);
        const chunks: string[][] = [];
        let currentChunk: string[] = [];

        for (const block of blocks) {
            currentChunk.push(block.content);
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
            chunkedFiles.push(
                new ChunkedFile(
                    path,
                    index,
                    'block',
                    chunkContent,
                    this.calculateShasum(chunkContent),
                    chunkLines
                )
            );
        });

        return chunkedFiles;
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
      
    private extractCodeBlocks = (code: string): Block[] => {
        const lines = code.split('\n');
        const blocks: Block[] = [];
      
        let currentBlock: Block | undefined;
        let braceDepth = 0;
        let indentLevel = 0;
      
        const startBlock = (type: Block['type'], name: string, line: string, lineNumber: number) => {
          currentBlock = {
            type,
            name,
            content: line + '\n',
            startLine: lineNumber,
            endLine: lineNumber,
          };
          braceDepth = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
          indentLevel = line.match(/^(\s*)/)?.[1].length ?? 0;
        };
      
        const endBlock = (lineNumber: number) => {
          if (currentBlock) {
            currentBlock.endLine = lineNumber;
            blocks.push(currentBlock);
            currentBlock = undefined;
          }
        };
      
        lines.forEach((line, idx) => {
          const trimmed = line.trim();
          const lineNumber = idx + 1;
      
          // Detect class or function headers
          const functionMatch = trimmed.match(/(?:function|def|fn|async|const|let)\s+(\w+)/);
          const classMatch = trimmed.match(/class\s+(\w+)/);
      
          if (!currentBlock && functionMatch) {
            startBlock('function', functionMatch[1], line, lineNumber);
          } else if (!currentBlock && classMatch) {
            startBlock('class', classMatch[1], line, lineNumber);
          } else if (currentBlock) {
            currentBlock.content += line + '\n';
      
            // Update brace depth
            braceDepth += (line.match(/{/g) || []).length;
            braceDepth -= (line.match(/}/g) || []).length;
      
            // Or detect dedentation (for Python-style)
            const currentIndent = line.match(/^(\s*)/)?.[1].length ?? 0;
            const dedented = currentIndent < indentLevel;
      
            if (braceDepth <= 0 && trimmed.endsWith('}') || dedented) {
              endBlock(lineNumber);
            }
          }
        });
      
        // Catch any unfinished block
        if (currentBlock) {
          currentBlock.endLine = lines.length;
          blocks.push(currentBlock);
        }
      
        return blocks;
    }
      
    private shouldIgnoreLine = (line: string) => {
        const trimmed = line.trim();
      
        return (
          trimmed === '' ||
          /^[}\]);]+;?$/.test(trimmed) ||
          /^import\s.+from\s.+;?$/.test(trimmed) ||
          /^(return|break|continue|pass);?$/.test(trimmed) ||
          /^\/\/[-=]*$/.test(trimmed) || // comentarios de separación
          /^\/\/\s*(TODO|FIXME)?\s*$/i.test(trimmed) ||
          /^[\]],?;?$/.test(trimmed) ||
          /^try\s*{$/.test(trimmed) ||
          /^}\s*else\s*{$/.test(trimmed) ||
          /^`;?$/.test(trimmed) ||
          /^\/\*\*$/.test(trimmed) ||
          /^\*\/$/.test(trimmed)
        );
    };

    private shuffleArray<T>(array: T[]): T[] {
        return [...array].sort(() => Math.random() - 0.5);
    }

    private calculateShasum(content: string): string {
        return createHash('sha256').update(content).digest('hex');
    }

    getFileTree = async (
        owner: string,
        repository: string,
        token: string,
        branch: string,
        ignoreFiles: string[],
        progress: (fileName: string) => void,
    ): Promise<{ withContent: FileTreeNodeWithContent; withoutContent: FileTreeNodeWithNoContent }> => {
        const fileContents = await this.getRepositoryContent(
            owner,
            repository,
            token,
            branch,
            ignoreFiles,
            progress
        );

        // Create root nodes for both trees
        const rootWithContent: FileTreeNodeWithContent = {
            name: repository,
            type: 'directory',
            path: '',
            children: []
        };

        const rootWithoutContent: FileTreeNodeWithNoContent = {
            name: repository,
            type: 'directory',
            path: '',
            children: []
        };

        // Process each file path to build both trees
        for (const [filePath, content] of fileContents.entries()) {
            const parts = filePath.split('/');
            let currentLevelWithContent = rootWithContent;
            let currentLevelWithoutContent = rootWithoutContent;

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                const isLastPart = i === parts.length - 1;
                const currentPath = parts.slice(0, i + 1).join('/');

                // Find or create the node in the content tree
                let nodeWithContent = currentLevelWithContent.children?.find(n => n.name === part);
                if (!nodeWithContent) {
                    nodeWithContent = {
                        name: part,
                        type: isLastPart ? 'file' : 'directory',
                        path: currentPath,
                        children: isLastPart ? undefined : [],
                        content: isLastPart ? content : undefined
                    };
                    if (!currentLevelWithContent.children) {
                        currentLevelWithContent.children = [];
                    }
                    currentLevelWithContent.children.push(nodeWithContent);
                }

                // Find or create the node in the no-content tree
                let nodeWithoutContent = currentLevelWithoutContent.children?.find(n => n.name === part);
                if (!nodeWithoutContent) {
                    nodeWithoutContent = {
                        name: part,
                        type: isLastPart ? 'file' : 'directory',
                        path: currentPath,
                        children: isLastPart ? undefined : []
                    };
                    if (!currentLevelWithoutContent.children) {
                        currentLevelWithoutContent.children = [];
                    }
                    currentLevelWithoutContent.children.push(nodeWithoutContent);
                }

                if (!isLastPart) {
                    currentLevelWithContent = nodeWithContent;
                    currentLevelWithoutContent = nodeWithoutContent;
                }
            }
        }

        return {
            withContent: rootWithContent,
            withoutContent: rootWithoutContent
        };
    }
} 
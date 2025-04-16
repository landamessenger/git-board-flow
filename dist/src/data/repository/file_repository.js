"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileRepository = void 0;
const github = __importStar(require("@actions/github"));
const logger_1 = require("../../utils/logger");
const chunked_file_1 = require("../model/chunked_file");
const crypto_1 = require("crypto");
class FileRepository {
    constructor() {
        this.getFileContent = async (owner, repository, path, token, branch) => {
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
            }
            catch (error) {
                (0, logger_1.logError)(`Error getting file content: ${error}.`);
                return '';
            }
        };
        this.getRepositoryContent = async (owner, repository, token, branch, ignoreFiles, progress) => {
            const octokit = github.getOctokit(token);
            const fileContents = new Map();
            try {
                const getContentRecursively = async (path = '') => {
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
                            }
                            else if (item.type === 'dir') {
                                await getContentRecursively(item.path);
                            }
                        }
                    }
                };
                await getContentRecursively();
                return fileContents;
            }
            catch (error) {
                (0, logger_1.logError)(`Error getting repository content: ${error}.`);
                return new Map();
            }
        };
        this.getChunkedRepositoryContent = async (owner, repository, branch, chunkSize, token, ignoreFiles, progress) => {
            const fileContents = await this.getRepositoryContent(owner, repository, token, branch, ignoreFiles, progress);
            const chunkedFiles = [];
            for (const [path, content] of fileContents.entries()) {
                chunkedFiles.push(...this.getChunksByLines(path, content, chunkSize));
                chunkedFiles.push(...this.getChunksByBlocks(path, content, chunkSize));
            }
            return this.shuffleArray(chunkedFiles);
        };
        this.getChunksByLines = (path, content, chunkSize) => {
            const chunkedFiles = [];
            const lines = content.split('\n');
            const chunks = [];
            let currentChunk = [];
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
                chunkedFiles.push(new chunked_file_1.ChunkedFile(path, index, 'line', chunkContent, this.calculateShasum(chunkContent), chunkLines));
            });
            return chunkedFiles;
        };
        this.getChunksByBlocks = (path, content, chunkSize) => {
            const chunkedFiles = [];
            const blocks = this.extractCodeBlocks(content);
            const chunks = [];
            let currentChunk = [];
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
                chunkedFiles.push(new chunked_file_1.ChunkedFile(path, index, 'block', chunkContent, this.calculateShasum(chunkContent), chunkLines));
            });
            return chunkedFiles;
        };
        this.extractCodeBlocks = (code) => {
            const lines = code.split('\n');
            const blocks = [];
            let currentBlock;
            let braceDepth = 0;
            let indentLevel = 0;
            const startBlock = (type, name, line, lineNumber) => {
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
            const endBlock = (lineNumber) => {
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
                }
                else if (!currentBlock && classMatch) {
                    startBlock('class', classMatch[1], line, lineNumber);
                }
                else if (currentBlock) {
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
        };
        this.shouldIgnoreLine = (line) => {
            const trimmed = line.trim();
            return (trimmed === '' ||
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
                /^\*\/$/.test(trimmed));
        };
    }
    isMediaOrPdfFile(path) {
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
    shouldIgnoreFile(filename, ignorePatterns) {
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
    shuffleArray(array) {
        return [...array].sort(() => Math.random() - 0.5);
    }
    calculateShasum(content) {
        return (0, crypto_1.createHash)('sha256').update(content).digest('hex');
    }
}
exports.FileRepository = FileRepository;

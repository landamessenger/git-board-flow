import { ChunkedFile } from '../../data/model/chunked_file';
import { Execution } from '../../data/model/execution';
import { Result } from '../../data/model/result';
import { FileRepository } from '../../data/repository/file_repository';
import { SupabaseRepository } from '../../data/repository/supabase_repository';
import { AiRepository } from '../../data/repository/ai_repository';
import { logError, logInfo, logSingleLine } from '../../utils/logger';
import { ParamUseCase } from '../base/param_usecase';
import { createHash } from 'crypto';

export class VectorActionUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'VectorActionUseCase';
    private fileRepository: FileRepository = new FileRepository();
    private aiRepository: AiRepository = new AiRepository();
    private readonly CODE_INSTRUCTION_BLOCK = "Represent the code for semantic search";
    private readonly CODE_INSTRUCTION_LINE = "Represent each line of code for retrieval";

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId}.`)

        const results: Result[] = [];

        try {
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

            const branch = param.commit.branch || param.branches.main;
            let duplicationBranch: string | undefined = undefined;
            if (branch === param.branches.main && param.singleAction.isVectorLocalAction) {
                logInfo(`📦 Chunks from [${param.branches.main}] will be duplicated to [${param.branches.development}] for ${param.owner}/${param.repo}.`);
                duplicationBranch = param.branches.development;
            }

            logInfo(`📦 Getting chunks on ${param.owner}/${param.repo}/${branch}`);

            const chunkedFilesMap = await this.fileRepository.getChunkedRepositoryContent(
                param.owner,
                param.repo,
                branch,
                -1,
                param.tokens.token,
                param.ai.getAiIgnoreFiles(),
                (fileName: string) => {
                    logSingleLine(`Checking file ${fileName}`);
                },
                (fileName: string) => {
                    logSingleLine(`Ignoring file ${fileName}`);
                }
            );
            
            logInfo(`📦 ✅ Files to index: ${chunkedFilesMap.size}`, true);

            results.push(...await this.checkChunksInSupabase(param, branch, chunkedFilesMap));
            results.push(...await this.uploadChunksToSupabase(param, branch, chunkedFilesMap));

            if (duplicationBranch) {
                results.push(...await this.duplicateChunksToBranch(param, branch, duplicationBranch));
            }

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
                    errors: [
                        `Error in ${this.taskId}: ${JSON.stringify(error, null, 2)}`,
                    ],
                })
            );
        }

        return results;
    }

    private checkChunksInSupabase = async (param: Execution, branch: string, chunkedFilesMap: Map<string, ChunkedFile[]>) => {
        const results: Result[] = [];
        
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

        const remotePaths = await supabaseRepository.getDistinctPaths(
            param.owner,
            param.repo,
            branch,
        );

        // Get all local paths from chunkedFiles
        const localPaths = new Set(Array.from(chunkedFilesMap.keys()));

        // Find paths that exist in Supabase but not in the current branch
        const pathsToRemove = remotePaths.filter(path => !localPaths.has(path));

        if (pathsToRemove.length > 0 && remotePaths.length > 0) {
            logInfo(`📦 Found ${pathsToRemove.length} paths to remove from AI index as they no longer exist in the branch ${branch}.`);
            
            for (const path of pathsToRemove) {
                try {
                    await supabaseRepository.removeAIFileCacheByPath(
                        param.owner,
                        param.repo,
                        branch,
                        path
                    );
                    logInfo(`📦 ✅ Removed chunks for path: ${path}`);
                } catch (error) {
                    logError(`📦 ❌ Error removing chunks for path ${path}: ${JSON.stringify(error, null, 2)}`);
                }
            }

            results.push(
                new Result({
                    id: this.taskId,
                    success: true,
                    executed: true,
                    steps: [
                        `Removed ${pathsToRemove.length} paths from AI index as they no longer exist in \`${branch}\`.`,
                    ],
                })
            );
        } else {
            results.push(
                new Result({
                    id: this.taskId,
                    success: true,
                    executed: true,
                })
            );
        }

        return results;
    }

    private uploadChunksToSupabase = async (param: Execution, branch: string, chunkedFilesMap: Map<string, ChunkedFile[]>) => {
        const results: Result[] = [];
        
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
        const startTime = Date.now();
        const chunkedPaths = Array.from(chunkedFilesMap.keys());
        
        // Step 1: Get all repository files once to build relationship map
        logInfo(`📦 Building relationship map from repository files...`);
        const allRepositoryFiles = await this.fileRepository.getRepositoryContent(
            param.owner,
            param.repo,
            param.tokens.token,
            branch,
            param.ai.getAiIgnoreFiles(),
            () => {}, // progress callback
            () => {}  // ignored files callback
        );
        
        // Step 2: Build relationship map once for all files
        const relationshipMaps = this.buildRelationshipMap(allRepositoryFiles);
        const consumesMap = relationshipMaps.consumes;
        const consumedByMap = relationshipMaps.consumedBy;
        logInfo(`✅ Relationship map built for ${allRepositoryFiles.size} files`);
        
        for (let i = 0; i < chunkedPaths.length; i++) {
            const path = chunkedPaths[i];
            const chunkedFiles: ChunkedFile[] = chunkedFilesMap.get(path) || [];
            const progress = ((i + 1) / chunkedPaths.length) * 100;
            const currentTime = Date.now();
            const elapsedTime = (currentTime - startTime) / 1000; // in seconds
            const estimatedTotalTime = (elapsedTime / (i + 1)) * chunkedPaths.length;
            const remainingTime = estimatedTotalTime - elapsedTime;

            logSingleLine(`🔘 ${i + 1}/${chunkedPaths.length} (${progress.toFixed(1)}%) - Estimated time remaining: ${Math.ceil(remainingTime)} seconds | Checking [${path}]`);

            const remoteShasum = await supabaseRepository.getShasumByPath(
                param.owner,
                param.repo,
                branch,
                path
            );

            if (remoteShasum) {
                if (remoteShasum === chunkedFiles[0].shasum) {
                    logSingleLine(`🟢 ${i + 1}/${chunkedPaths.length} (${progress.toFixed(1)}%) - Estimated time remaining: ${Math.ceil(remainingTime)} seconds | File indexed [${path}]`);
                    continue;
                } else if (remoteShasum !== chunkedFiles[0].shasum) {
                    logSingleLine(`🟡 ${i + 1}/${chunkedPaths.length} (${progress.toFixed(1)}%) - Estimated time remaining: ${Math.ceil(remainingTime)} seconds | File has changes and must be reindexed [${path}]`);
                    await supabaseRepository.removeAIFileCacheByPath(
                        param.owner,
                        param.repo,
                        branch,
                        path
                    );
                }
            }

            // Generate AI cache for this file (only process once per file, not per chunk)
            // Use the first chunkedFile to get the full content
            if (chunkedFiles.length > 0) {
                const firstChunkedFile = chunkedFiles[0];
                const fileContent = firstChunkedFile.content;
                const filePath = firstChunkedFile.path;
                
                try {
                    logSingleLine(`🟡 ${i + 1}/${chunkedPaths.length} (${progress.toFixed(1)}%) - Estimated time remaining: ${Math.ceil(remainingTime)} seconds | Generating AI cache [${filePath}]`);
                    
                    // Step 3: Extract imports for this file (from pre-built map)
                    const consumes = consumesMap.get(filePath) || [];
                    const consumedBy = consumedByMap.get(filePath) || [];
                    
                    // Step 4: Calculate SHA
                    const currentSHA = this.calculateFileSHA(fileContent);
                    
                    // Step 5: Generate description using AI (with fallback)
                    let description = this.generateBasicDescription(filePath);
                    try {
                        const descriptionPrompt = `Analyze this code file and provide a brief description (1-2 sentences) of what it does:

\`\`\`
${fileContent.substring(0, 2000)}${fileContent.length > 2000 ? '...' : ''}
\`\`\`

Provide only a concise description in English, focusing on the main functionality.`;
                        
                        const aiDescription = await this.aiRepository.ask(param.ai, descriptionPrompt);
                        if (aiDescription && aiDescription.trim().length > 0) {
                            description = aiDescription.trim();
                        }
                    } catch (error) {
                        logError(`Error generating AI description for ${filePath}, using fallback: ${error}`);
                    }
                    
                    // Step 6: Save to Supabase
                    const fileName = filePath.split('/').pop() || filePath;
                    await supabaseRepository.setAIFileCache(
                        param.owner,
                        param.repo,
                        branch,
                        {
                            file_name: fileName,
                            path: filePath,
                            sha: currentSHA,
                            description: description,
                            consumes: consumes,
                            consumed_by: consumedBy
                        }
                    );
                    
                    logSingleLine(`🟢 ${i + 1}/${chunkedPaths.length} (${progress.toFixed(1)}%) - Estimated time remaining: ${Math.ceil(remainingTime)} seconds | AI cache saved [${filePath}]`);
                    
                } catch (error) {
                    logError(`Error generating AI cache for ${path}: ${JSON.stringify(error, null, 2)}`);
                }
            }
        }

        const totalDurationSeconds = (Date.now() - startTime) / 1000;
        logInfo(`📦 🚀 All chunked files stored ${param.owner}/${param.repo}/${branch}. Total duration: ${Math.ceil(totalDurationSeconds)} seconds`, true);
        
        results.push(
            new Result({
                id: this.taskId,
                success: true,
                executed: true,
                steps: [
                    `All chunked files up to date in AI index for \`${branch}\`. Total duration: ${Math.ceil(totalDurationSeconds)} seconds`,
                ],
            })
        );
        return results;
    }

    private duplicateChunksToBranch = async (param: Execution, sourceBranch: string, targetBranch: string) => {
        const results: Result[] = [];
        
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

        try {
            logInfo(`📦 -> 📦 Clearing possible existing AI cache from ${targetBranch} for ${param.owner}/${param.repo}.`);
            await supabaseRepository.removeAIFileCacheByBranch(
                param.owner,
                param.repo,
                targetBranch
            );
            
            logInfo(`📦 -> 📦 Duplicating AI cache from ${sourceBranch} to ${targetBranch} for ${param.owner}/${param.repo}.`);
            await supabaseRepository.duplicateAIFileCacheByBranch(
                param.owner,
                param.repo,
                sourceBranch,
                targetBranch
            );

            results.push(
                new Result({
                    id: this.taskId,
                    success: true,
                    executed: true,
                    steps: [
                        `Duplicated chunks from ${sourceBranch} to ${targetBranch} for ${param.owner}/${param.repo}.`,
                    ],
                })
            );
        } catch (error) {
            logError(`📦 -> 📦 ❌ Error duplicating chunks from ${sourceBranch} to ${targetBranch}: ${JSON.stringify(error, null, 2)}`);
            results.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    errors: [
                        `Error duplicating chunks from ${sourceBranch} to ${targetBranch}: ${JSON.stringify(error, null, 2)}`,
                    ],
                })
            );
        }

        return results;
    }

    /**
     * Extract imports from a file regardless of programming language
     */
    private extractImportsFromFile(filePath: string, content: string): string[] {
        const imports: string[] = [];
        const ext = filePath.split('.').pop()?.toLowerCase() || '';
        const dir = filePath.split('/').slice(0, -1).join('/') || '';
        
        // TypeScript/JavaScript
        if (['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'].includes(ext)) {
            const es6Imports = content.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g) || [];
            es6Imports.forEach(match => {
                const path = match.match(/['"]([^'"]+)['"]/)?.[1];
                if (path) imports.push(path);
            });
            
            const requireImports = content.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g) || [];
            requireImports.forEach(match => {
                const path = match.match(/['"]([^'"]+)['"]/)?.[1];
                if (path) imports.push(path);
            });
        }
        
        // Python
        if (['py', 'pyw', 'pyi'].includes(ext)) {
            const pyImports = content.match(/(?:^|\n)\s*(?:import\s+\w+|from\s+[\w.]+)\s+import/gm) || [];
            pyImports.forEach(match => {
                const fromMatch = match.match(/from\s+([\w.]+)/);
                if (fromMatch) {
                    imports.push(fromMatch[1]);
                } else {
                    const importMatch = match.match(/import\s+(\w+)/);
                    if (importMatch) imports.push(importMatch[1]);
                }
            });
        }
        
        // Java
        if (ext === 'java') {
            const javaImports = content.match(/import\s+(?:static\s+)?[\w.]+\s*;/g) || [];
            javaImports.forEach(match => {
                const path = match.replace(/import\s+(?:static\s+)?/, '').replace(/\s*;/, '');
                imports.push(path);
            });
        }
        
        // Kotlin
        if (['kt', 'kts'].includes(ext)) {
            const ktImports = content.match(/import\s+[\w.]+\s*/g) || [];
            ktImports.forEach(match => {
                const path = match.replace(/import\s+/, '').trim();
                imports.push(path);
            });
        }
        
        // Go
        if (ext === 'go') {
            const goImports = content.match(/import\s*(?:\([^)]+\)|['"]([^'"]+)['"])/gs) || [];
            goImports.forEach(match => {
                const quoted = match.match(/['"]([^'"]+)['"]/);
                if (quoted) {
                    imports.push(quoted[1]);
                } else {
                    const multiLine = match.match(/import\s*\(([^)]+)\)/s);
                    if (multiLine) {
                        const paths = multiLine[1].match(/['"]([^'"]+)['"]/g) || [];
                        paths.forEach(p => {
                            const path = p.match(/['"]([^'"]+)['"]/)?.[1];
                            if (path) imports.push(path);
                        });
                    }
                }
            });
        }
        
        // Rust
        if (ext === 'rs') {
            const rustImports = content.match(/use\s+[\w:]+(?:::\*)?\s*;/g) || [];
            rustImports.forEach(match => {
                const path = match.replace(/use\s+/, '').replace(/\s*;/, '').split('::')[0];
                imports.push(path);
            });
        }
        
        // Ruby
        if (ext === 'rb') {
            const rubyImports = content.match(/(?:require|require_relative)\s+['"]([^'"]+)['"]/g) || [];
            rubyImports.forEach(match => {
                const path = match.match(/['"]([^'"]+)['"]/)?.[1];
                if (path) imports.push(path);
            });
        }
        
        // PHP
        if (ext === 'php') {
            const phpImports = content.match(/(?:use|require|include)(?:_once)?\s+['"]([^'"]+)['"]/g) || [];
            phpImports.forEach(match => {
                const path = match.match(/['"]([^'"]+)['"]/)?.[1];
                if (path) imports.push(path);
            });
        }
        
        // Swift
        if (ext === 'swift') {
            const swiftImports = content.match(/import\s+\w+/g) || [];
            swiftImports.forEach(match => {
                const path = match.replace(/import\s+/, '');
                imports.push(path);
            });
        }
        
        // Dart
        if (ext === 'dart') {
            const dartImports = content.match(/import\s+['"]([^'"]+)['"]/g) || [];
            dartImports.forEach(match => {
                const path = match.match(/['"]([^'"]+)['"]/)?.[1];
                if (path) imports.push(path);
            });
        }
        
        // Resolve relative imports to absolute paths
        return imports.map(imp => {
            if (!imp.startsWith('.') && !imp.startsWith('/')) {
                if (dir) {
                    const possiblePath = `${dir}/${imp}`.replace(/\/+/g, '/');
                    return possiblePath;
                }
                return imp;
            }
            
            if (imp.startsWith('.')) {
                const resolved = this.resolveRelativePath(dir, imp);
                return resolved;
            }
            
            return imp;
        }).filter(imp => imp && !imp.includes('node_modules') && !imp.startsWith('http'));
    }
    
    /**
     * Resolve relative import path to absolute path
     */
    private resolveRelativePath(baseDir: string, relativePath: string): string {
        if (!relativePath.startsWith('.')) {
            return relativePath;
        }
        
        let path = baseDir || '';
        const parts = relativePath.split('/');
        
        for (const part of parts) {
            if (part === '..') {
                path = path.split('/').slice(0, -1).join('/');
            } else if (part === '.' || part === '') {
                // Current directory, do nothing
            } else {
                path = path ? `${path}/${part}` : part;
            }
        }
        
        const withoutExt = path.replace(/\.(ts|tsx|js|jsx|py|java|kt|go|rs|rb|php|swift|dart)$/, '');
        return withoutExt;
    }

    /**
     * Build relationship map from all files by extracting imports
     */
    private buildRelationshipMap(
        repositoryFiles: Map<string, string>
    ): { consumes: Map<string, string[]>, consumedBy: Map<string, string[]> } {
        const consumesMap = new Map<string, string[]>();
        const consumedByMap = new Map<string, string[]>();
        
        // Initialize consumedBy map for all files
        for (const filePath of repositoryFiles.keys()) {
            consumedByMap.set(filePath, []);
        }
        
        for (const [filePath, content] of repositoryFiles.entries()) {
            const imports = this.extractImportsFromFile(filePath, content);
            const resolvedImports: string[] = [];
            
            for (const imp of imports) {
                const possiblePaths = [
                    imp,
                    `${imp}.ts`,
                    `${imp}.tsx`,
                    `${imp}.js`,
                    `${imp}.jsx`,
                    `${imp}/index.ts`,
                    `${imp}/index.tsx`,
                    `${imp}/index.js`,
                    `${imp}/index.jsx`,
                ];
                
                for (const possiblePath of possiblePaths) {
                    if (repositoryFiles.has(possiblePath)) {
                        if (!resolvedImports.includes(possiblePath)) {
                            resolvedImports.push(possiblePath);
                        }
                        const currentConsumers = consumedByMap.get(possiblePath) || [];
                        if (!currentConsumers.includes(filePath)) {
                            currentConsumers.push(filePath);
                            consumedByMap.set(possiblePath, currentConsumers);
                        }
                        break;
                    }
                    
                    for (const [repoPath] of repositoryFiles.entries()) {
                        if (repoPath.includes(possiblePath) || possiblePath.includes(repoPath)) {
                            if (!resolvedImports.includes(repoPath)) {
                                resolvedImports.push(repoPath);
                            }
                            const currentConsumers = consumedByMap.get(repoPath) || [];
                            if (!currentConsumers.includes(filePath)) {
                                currentConsumers.push(filePath);
                                consumedByMap.set(repoPath, currentConsumers);
                            }
                        }
                    }
                }
            }
            
            consumesMap.set(filePath, resolvedImports);
        }
        
        return { consumes: consumesMap, consumedBy: consumedByMap };
    }

    /**
     * Calculate SHA256 hash of file content
     */
    private calculateFileSHA(content: string): string {
        return createHash('sha256').update(content).digest('hex');
    }

    /**
     * Generate basic description from file path (fallback)
     */
    private generateBasicDescription(filePath: string): string {
        const fileName = filePath.split('/').pop() || filePath;
        const dir = filePath.split('/').slice(0, -1).join('/');
        
        if (fileName.includes('use_case') || fileName.includes('usecase')) {
            return `Use case: ${fileName.replace(/[._-]/g, ' ')}`;
        } else if (fileName.includes('repository')) {
            return `Repository: ${fileName.replace(/[._-]/g, ' ')}`;
        } else if (fileName.includes('model')) {
            return `Model: ${fileName.replace(/[._-]/g, ' ')}`;
        } else if (fileName.includes('action')) {
            return `Action: ${fileName.replace(/[._-]/g, ' ')}`;
        } else {
            return `File: ${fileName}. Located in ${dir || 'root'}.`;
        }
    }
}

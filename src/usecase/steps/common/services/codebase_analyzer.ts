import { Execution } from '../../../../data/model/execution';
import { AiRepository } from '../../../../data/repository/ai_repository';
import { logDebugInfo, logError, logInfo } from '../../../../utils/logger';
import { PROMPTS } from '../../../../utils/constants';
import { FileImportAnalyzer } from './file_import_analyzer';
import { FileCacheManager } from './file_cache_manager';
import { CachedFileInfo } from './types';

export interface FileAnalysisResult {
    path: string;
    description: string;
    consumes: string[];
    consumed_by: string[];
}

/**
 * Service for analyzing codebase structure and generating file descriptions
 */
export class CodebaseAnalyzer {
    constructor(
        private aiRepository: AiRepository,
        private fileImportAnalyzer: FileImportAnalyzer,
        private fileCacheManager: FileCacheManager
    ) {}

    /**
     * Generate codebase analysis with file descriptions and relationships
     * This runs before the main reasoning loop to provide context
     * Uses relationship map built from imports + AI descriptions in batches
     */
    async generateCodebaseAnalysis(
        param: Execution,
        repositoryFiles: Map<string, string>,
        question: string
    ): Promise<FileAnalysisResult[]> {
        try {
            // Filter relevant files (code files, not config/docs)
            const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.kt', '.go', '.rs', '.rb', '.php', '.swift', '.dart'];
            const relevantFiles = Array.from(repositoryFiles.entries())
                .filter(([path]) => {
                    const ext = path.split('.').pop()?.toLowerCase() || '';
                    return codeExtensions.includes(`.${ext}`) || 
                           path.includes('/src/') || 
                           path.includes('/lib/') ||
                           path.includes('/usecase/') ||
                           path.includes('/repository/');
                });

            if (relevantFiles.length === 0) {
                logInfo(`⚠️ No relevant code files found for analysis`);
                return [];
            }

            logInfo(`🔍 Analyzing ${relevantFiles.length} relevant files for structure and relationships...`);
            
            // STEP 0: Load cache from Supabase
            const cache = await this.fileCacheManager.loadAICache(param);
            
            // STEP 1: Build relationship map from imports (in memory, no AI needed)
            const relationshipMaps = this.fileImportAnalyzer.buildRelationshipMap(repositoryFiles);
            const consumesMap = relationshipMaps.consumes;
            const consumedByMap = relationshipMaps.consumedBy;

            // STEP 2: Identify files that need AI analysis (not in cache or SHA changed)
            const filesNeedingAnalysis: Array<[string, string]> = [];
            const cachedAnalyses: FileAnalysisResult[] = [];
            
            let cacheMissReasons = {
                notInCache: 0,
                shaMismatch: 0
            };
            
            // Track files that should be in cache but aren't
            const missingFromCache: string[] = [];
            
            for (const [filePath, content] of relevantFiles) {
                const currentSHA = this.fileCacheManager.calculateFileSHA(content);
                const cached = this.fileCacheManager.getCachedFile(cache, filePath);
                
                if (!cached) {
                    cacheMissReasons.notInCache++;
                    missingFromCache.push(filePath);
                    logDebugInfo(`❌ Cache miss for ${filePath} (not in cache)`);
                    filesNeedingAnalysis.push([filePath, content]);
                } else if (cached.sha !== currentSHA) {
                    cacheMissReasons.shaMismatch++;
                    logDebugInfo(`🔄 SHA mismatch for ${filePath}: cached=${cached.sha.substring(0, 8)}..., current=${currentSHA.substring(0, 8)}...`);
                    filesNeedingAnalysis.push([filePath, content]);
                } else {
                    // Use cached data
                    const consumes = consumesMap.get(filePath) || [];
                    const consumedBy = consumedByMap.get(filePath) || [];
                    cachedAnalyses.push({
                        path: filePath,
                        description: cached.description,
                        consumes: consumes,
                        consumed_by: consumedBy
                    });
                }
            }
            
            logInfo(`📊 Cache hit: ${cachedAnalyses.length} files, Need analysis: ${filesNeedingAnalysis.length} files (not in cache: ${cacheMissReasons.notInCache}, SHA mismatch: ${cacheMissReasons.shaMismatch})`);
            
            // Debug: Show detailed cache comparison
            if (cacheMissReasons.notInCache > 0) {
                if (cache.size > 0) {
                    const sampleCachePaths = Array.from(cache.keys()).slice(0, 10);
                    const sampleMissingPaths = missingFromCache.slice(0, 10);
                    logDebugInfo(`🔍 Cache contains ${cache.size} files. Sample cached paths: ${sampleCachePaths.join(', ')}`);
                    logDebugInfo(`🔍 Sample missing paths (${missingFromCache.length} total): ${sampleMissingPaths.join(', ')}`);
                    
                    // Check if any missing paths are similar to cached paths (normalization issue)
                    for (const missingPath of sampleMissingPaths.slice(0, 3)) {
                        const normalizedMissing = missingPath.replace(/^\.\//, '').replace(/\\/g, '/');
                        const foundSimilar = sampleCachePaths.find(cached => 
                            cached.includes(normalizedMissing) || normalizedMissing.includes(cached)
                        );
                        if (foundSimilar) {
                            logDebugInfo(`⚠️ Potential path mismatch: missing="${missingPath}" vs cached="${foundSimilar}"`);
                        }
                    }
                } else {
                    logDebugInfo(`⚠️ Cache is empty! All ${relevantFiles.length} files need analysis.`);
                }
            }

            // STEP 3: Process files needing analysis in batches with AI (only for descriptions)
            // Relationships come from the map we built
            const BATCH_SIZE = 20; // Process 20 files at a time
            const allAnalyses: FileAnalysisResult[] = [...cachedAnalyses];
            
            // Create simplified schema for AI (only needs description, relationships come from map)
            const FILE_DESCRIPTION_SCHEMA = {
                "type": "array",
                "description": "Array of file descriptions",
                "items": {
                    "type": "object",
                    "properties": {
                        "path": {
                            "type": "string",
                            "description": "File path relative to repository root"
                        },
                        "description": {
                            "type": "string",
                            "description": "Complete description of what the file does"
                        }
                    },
                    "required": ["path", "description"],
                    "additionalProperties": false
                }
            };
            
            for (let i = 0; i < filesNeedingAnalysis.length; i += BATCH_SIZE) {
                const batch = filesNeedingAnalysis.slice(i, i + BATCH_SIZE);
                const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
                const totalBatches = Math.ceil(relevantFiles.length / BATCH_SIZE);
                
                logInfo(`📝 Processing batch ${batchNumber}/${totalBatches} (${batch.length} files)...`);
                
                // Prepare batch content
                const batchFilesList = batch.map(([path]) => path).join('\n');
                const batchContent = batch.map(([path, content]) => 
                    `\n## ${path}\n\`\`\`\n${content}\n\`\`\``
                ).join('\n');
                
                const batchPrompt = `# Codebase Structure Analysis - Batch ${batchNumber}/${totalBatches}

You are analyzing a codebase to understand what each file does.

## User's Question:
${question}

## Files to Analyze in this batch (${batch.length} files):
${batchFilesList}

## File Contents:
${batchContent}

## Task:
For EACH of the ${batch.length} files listed above, 

${PROMPTS.CODE_BASE_ANALYSIS}

Return a JSON array with this structure:
[
  {
    "path": "src/path/to/file.ts",
    "description": "description_here"
  },
  ...
]

**REQUIREMENTS**:
- You MUST return a description for ALL ${batch.length} files in this batch`;

                try {
                    const batchResponse = await this.aiRepository.askJson(
                        param.ai,
                        batchPrompt,
                        FILE_DESCRIPTION_SCHEMA,
                        "file_descriptions"
                    );
                    
                    if (batchResponse && Array.isArray(batchResponse)) {
                        // Merge AI descriptions with relationship map and update cache
                        for (const item of batchResponse) {
                            if (item && typeof item.path === 'string' && typeof item.description === 'string') {
                                const [filePath, content] = batch.find(([p]) => p === item.path) || [item.path, ''];
                                const currentSHA = filePath && content ? this.fileCacheManager.calculateFileSHA(content) : '';
                                const consumes = consumesMap.get(item.path) || [];
                                const consumedBy = consumedByMap.get(item.path) || [];
                                
                                allAnalyses.push({
                                    path: item.path,
                                    description: item.description,
                                    consumes: consumes,
                                    consumed_by: consumedBy
                                });
                                
                                // Update cache
                                if (filePath && currentSHA) {
                                    const cachedInfo: CachedFileInfo = {
                                        path: item.path,
                                        sha: currentSHA,
                                        description: item.description,
                                        consumes: consumes,
                                        consumed_by: consumedBy
                                    };
                                    cache.set(item.path, cachedInfo);
                                    // Save to Supabase
                                    await this.fileCacheManager.saveAICacheEntry(param, item.path, cachedInfo, consumes, consumedBy);
                                }
                            }
                        }
                        logInfo(`✅ Processed batch ${batchNumber}/${totalBatches}: ${batchResponse.length} files`);
                    } else {
                        logError(`⚠️ Batch ${batchNumber} failed, using fallback descriptions`);
                        // Fallback for this batch
                        for (const [path, content] of batch) {
                            const currentSHA = this.fileCacheManager.calculateFileSHA(content);
                            const consumes = consumesMap.get(path) || [];
                            const consumedBy = consumedByMap.get(path) || [];
                            const fallbackDesc = this.generateBasicDescription(path);
                            
                            allAnalyses.push({
                                path,
                                description: fallbackDesc,
                                consumes: consumes,
                                consumed_by: consumedBy
                            });
                            
                            // Update cache with fallback
                            const cachedInfo: CachedFileInfo = {
                                path,
                                sha: currentSHA,
                                description: fallbackDesc,
                                consumes: consumes,
                                consumed_by: consumedBy
                            };
                            cache.set(path, cachedInfo);
                            // Save to Supabase
                            await this.fileCacheManager.saveAICacheEntry(param, path, cachedInfo, consumes, consumedBy);
                        }
                    }
                } catch (error) {
                    logError(`Error processing batch ${batchNumber}: ${error}`);
                    // Fallback for this batch
                    for (const [path, content] of batch) {
                        const currentSHA = this.fileCacheManager.calculateFileSHA(content);
                        const consumes = consumesMap.get(path) || [];
                        const consumedBy = consumedByMap.get(path) || [];
                        const fallbackDesc = this.generateBasicDescription(path);
                        
                        allAnalyses.push({
                            path,
                            description: fallbackDesc,
                            consumes: consumes,
                            consumed_by: consumedBy
                        });
                        
                        // Update cache with fallback
                        const cachedInfo: CachedFileInfo = {
                            path,
                            sha: currentSHA,
                            description: fallbackDesc,
                            consumes: consumes,
                            consumed_by: consumedBy
                        };
                        cache.set(path, cachedInfo);
                        // Save to Supabase
                        await this.fileCacheManager.saveAICacheEntry(param, path, cachedInfo, consumes, consumedBy);
                    }
                }
            }
            
            // STEP 4: Cache is saved incrementally during processing
            // No need to save all at once since we're using Supabase
            
            if (allAnalyses.length > 0) {
                logInfo(`✅ Generated analysis for ${allAnalyses.length} files (${cachedAnalyses.length} from cache, ${filesNeedingAnalysis.length} from AI)`);
                return allAnalyses;
            }

            // Fallback: Generate simple descriptions based on file paths and basic content
            logInfo(`⚠️ AI analysis failed, generating fallback descriptions...`);
            const fallbackDescriptions = this.generateFallbackFileDescriptions(relevantFiles);
            // Merge with relationship maps and update cache
            const fallbackResults = await Promise.all(fallbackDescriptions.map(async (item) => {
                const consumes = consumesMap.get(item.path) || [];
                const consumedBy = consumedByMap.get(item.path) || [];
                const content = repositoryFiles.get(item.path) || '';
                const currentSHA = content ? this.fileCacheManager.calculateFileSHA(content) : '';
                
                // Update cache
                if (content && currentSHA) {
                    const cachedInfo: CachedFileInfo = {
                        path: item.path,
                        sha: currentSHA,
                        description: item.description,
                        consumes: consumes,
                        consumed_by: consumedBy
                    };
                    cache.set(item.path, cachedInfo);
                    // Save to Supabase
                    await this.fileCacheManager.saveAICacheEntry(param, item.path, cachedInfo, consumes, consumedBy);
                }
                
                return {
                    ...item,
                    consumes: consumes,
                    consumed_by: consumedBy
                };
            }));
            
            return fallbackResults;
            
        } catch (error) {
            logError(`Error generating codebase analysis: ${error}`);
            // Fallback to simple path-based analysis
            const relevantFiles = Array.from(repositoryFiles.entries())
                .filter(([path]) => path.includes('/src/') || path.includes('/lib/'));
            const fallbackDescriptions = this.generateFallbackFileDescriptions(relevantFiles);
            // Try to build relationship map even in fallback
            try {
                const relationshipMaps = this.fileImportAnalyzer.buildRelationshipMap(repositoryFiles);
                const consumes = relationshipMaps.consumes;
                const consumedBy = relationshipMaps.consumedBy;
                return fallbackDescriptions.map(item => ({
                    ...item,
                    consumes: consumes.get(item.path) || [],
                    consumed_by: consumedBy.get(item.path) || []
                }));
            } catch {
                return fallbackDescriptions;
            }
        }
    }

    /**
     * Generate basic description from file path (fallback)
     */
    generateBasicDescription(path: string): string {
        const pathParts = path.split('/');
        const fileName = pathParts[pathParts.length - 1];
        const dir = pathParts.slice(0, -1).join('/');
        
        if (path.includes('/usecase/')) {
            return `Use case for ${fileName.replace(/_/g, ' ').replace(/\.(ts|tsx|js|jsx|py|java|kt|go|rs|rb|php|swift|dart)$/, '')}. Handles business logic and orchestrates operations.`;
        } else if (path.includes('/repository/')) {
            return `Repository for ${fileName.replace(/_/g, ' ').replace(/\.(ts|tsx|js|jsx|py|java|kt|go|rs|rb|php|swift|dart)$/, '')}. Handles data access and external service interactions.`;
        } else if (path.includes('/model/')) {
            return `Data model: ${fileName.replace(/_/g, ' ').replace(/\.(ts|tsx|js|jsx|py|java|kt|go|rs|rb|php|swift|dart)$/, '')}. Defines data structures and interfaces.`;
        } else if (path.includes('/utils/')) {
            return `Utility functions: ${fileName.replace(/_/g, ' ').replace(/\.(ts|tsx|js|jsx|py|java|kt|go|rs|rb|php|swift|dart)$/, '')}. Provides helper functions and utilities.`;
        } else if (path.includes('/actions/')) {
            return `Action handler: ${fileName.replace(/_/g, ' ').replace(/\.(ts|tsx|js|jsx|py|java|kt|go|rs|rb|php|swift|dart)$/, '')}. Handles action execution and workflows.`;
        } else {
            return `File: ${fileName}. Located in ${dir || 'root'}.`;
        }
    }

    /**
     * Generate fallback file descriptions when AI analysis fails
     */
    generateFallbackFileDescriptions(
        files: Array<[string, string]>
    ): FileAnalysisResult[] {
        const descriptions: FileAnalysisResult[] = [];
        
        for (const [path] of files) {
            const description = this.generateBasicDescription(path);
            descriptions.push({
                path,
                description,
                consumes: [], // Will be filled by relationship map
                consumed_by: [] // Will be filled by relationship map
            });
        }

        return descriptions;
    }

    /**
     * Format codebase analysis for inclusion in AI context
     */
    formatCodebaseAnalysisForContext(
        analysis: FileAnalysisResult[]
    ): string {
        if (analysis.length === 0) {
            return '';
        }

        const formatted: string[] = [];
        formatted.push(`## 📋 Codebase Analysis & File Relationships\n\n`);
        formatted.push(`This analysis provides context about the codebase structure to help you make informed decisions about which files to examine.\n\n`);
        formatted.push(`**Relationship Types:**\n`);
        formatted.push(`- **Consumes**: Files that this file imports/depends on\n`);
        formatted.push(`- **Consumed By**: Files that import/depend on this file\n\n`);

        // Group by directory for better organization
        const byDirectory = new Map<string, FileAnalysisResult[]>();
        analysis.forEach(item => {
            const dir = item.path.split('/').slice(0, -1).join('/') || 'root';
            if (!byDirectory.has(dir)) {
                byDirectory.set(dir, []);
            }
            byDirectory.get(dir)!.push(item);
        });

        // Sort directories for consistent output
        const sortedDirs = Array.from(byDirectory.keys()).sort();

        for (const dir of sortedDirs) {
            const files = byDirectory.get(dir)!;
            formatted.push(`### ${dir || 'Root'}\n\n`);
            
            for (const file of files) {
                formatted.push(`- **\`${file.path}\`**: ${file.description}`);
                
                if (file.consumes && file.consumes.length > 0) {
                    formatted.push(`\n  - *Consumes*: ${file.consumes.slice(0, 5).map(r => `\`${r}\``).join(', ')}${file.consumes.length > 5 ? '...' : ''}`);
                }
                
                if (file.consumed_by && file.consumed_by.length > 0) {
                    formatted.push(`\n  - *Consumed By*: ${file.consumed_by.slice(0, 5).map(r => `\`${r}\``).join(', ')}${file.consumed_by.length > 5 ? '...' : ''}`);
                }
                
                formatted.push(`\n`);
            }
            formatted.push(`\n`);
        }

        formatted.push(`\n**Use this analysis to understand the codebase structure and identify relevant files for the task.**\n\n`);

        return formatted.join('');
    }
}


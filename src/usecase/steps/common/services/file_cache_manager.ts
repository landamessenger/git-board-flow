import { Execution } from '../../../../data/model/execution';
import { SupabaseRepository, AICachedFileInfo } from '../../../../data/repository/supabase_repository';
import { logError, logInfo, logDebugInfo } from '../../../../utils/logger';
import { CachedFileInfo } from './types';
import { createHash } from 'crypto';

/**
 * Service for managing AI file cache in Supabase
 */
export class FileCacheManager {
    private supabaseRepository: SupabaseRepository | null = null;

    /**
     * Normalize file path for consistent comparison
     * Removes leading ./ and normalizes path separators
     */
    private normalizePath(path: string): string {
        return path
            .replace(/^\.\//, '') // Remove leading ./
            .replace(/\\/g, '/')  // Normalize separators
            .trim();
    }

    /**
     * Calculate SHA256 hash of file content
     */
    calculateFileSHA(content: string): string {
        return createHash('sha256').update(content).digest('hex');
    }

    /**
     * Initialize Supabase repository if config is available
     */
    initSupabaseRepository(param: Execution): SupabaseRepository | null {
        if (!this.supabaseRepository && param.supabaseConfig) {
            this.supabaseRepository = new SupabaseRepository(param.supabaseConfig);
        }
        return this.supabaseRepository;
    }

    /**
     * Load cache from Supabase (or return empty map if Supabase not available)
     * Uses normalized paths for consistent lookup
     */
    async loadAICache(param: Execution): Promise<Map<string, CachedFileInfo>> {
        this.initSupabaseRepository(param);
        const cache = new Map<string, CachedFileInfo>();

        if (!this.supabaseRepository) {
            logInfo(`📂 Supabase not configured, starting with empty cache`);
            return cache;
        }

        try {
            const branch = param.commit.branch || param.branches.main;
            const cachedFiles = await this.supabaseRepository.getAIFileCachesByBranch(
                param.owner,
                param.repo,
                branch
            );

            for (const file of cachedFiles) {
                const normalizedPath = this.normalizePath(file.path);
                cache.set(normalizedPath, {
                    path: normalizedPath,
                    sha: file.sha,
                    description: file.description,
                    consumes: (file.consumes || []).map(p => this.normalizePath(p)),
                    consumed_by: (file.consumed_by || []).map(p => this.normalizePath(p))
                });
            }

            logInfo(`📂 Loaded ${cache.size} files from Supabase cache`);
            if (cachedFiles.length > 0) {
                logDebugInfo(`📂 Sample cached paths: ${Array.from(cache.keys()).slice(0, 5).join(', ')}`);
            }
        } catch (error) {
            logError(`Error loading AI cache from Supabase: ${error}`);
        }

        return cache;
    }

    /**
     * Get cached file info by path (with path normalization)
     */
    getCachedFile(cache: Map<string, CachedFileInfo>, filePath: string): CachedFileInfo | undefined {
        const normalizedPath = this.normalizePath(filePath);
        return cache.get(normalizedPath);
    }

    /**
     * Save cache entry to Supabase
     * Normalizes paths before saving
     */
    async saveAICacheEntry(
        param: Execution,
        filePath: string,
        fileInfo: CachedFileInfo,
        consumes: string[],
        consumedBy: string[]
    ): Promise<void> {
        this.initSupabaseRepository(param);

        if (!this.supabaseRepository) {
            return; // Silently skip if Supabase not available
        }

        try {
            const branch = param.commit.branch || param.branches.main;
            const fileName = filePath.split('/').pop() || filePath;
            const normalizedPath = this.normalizePath(filePath);
            const normalizedConsumes = consumes.map(p => this.normalizePath(p));
            const normalizedConsumedBy = consumedBy.map(p => this.normalizePath(p));

            await this.supabaseRepository.setAIFileCache(
                param.owner,
                param.repo,
                branch,
                {
                    file_name: fileName,
                    path: normalizedPath,
                    sha: fileInfo.sha,
                    description: fileInfo.description,
                    consumes: normalizedConsumes,
                    consumed_by: normalizedConsumedBy
                }
            );
            
            logDebugInfo(`💾 Saved cache entry for ${normalizedPath}`);
        } catch (error) {
            logError(`Error saving AI cache entry to Supabase for ${filePath}: ${error}`);
        }
    }
}


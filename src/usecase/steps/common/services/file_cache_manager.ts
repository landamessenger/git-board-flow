import { Execution } from '../../../../data/model/execution';
import { SupabaseRepository, AICachedFileInfo } from '../../../../data/repository/supabase_repository';
import { logError, logInfo } from '../../../../utils/logger';
import { CachedFileInfo } from './types';
import { createHash } from 'crypto';

/**
 * Service for managing AI file cache in Supabase
 */
export class FileCacheManager {
    private supabaseRepository: SupabaseRepository | null = null;

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
                cache.set(file.path, {
                    path: file.path,
                    sha: file.sha,
                    description: file.description,
                    consumes: file.consumes || [],
                    consumed_by: file.consumed_by || []
                });
            }

            logInfo(`📂 Loaded ${cache.size} files from Supabase cache`);
        } catch (error) {
            logError(`Error loading AI cache from Supabase: ${error}`);
        }

        return cache;
    }

    /**
     * Save cache entry to Supabase
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

            await this.supabaseRepository.setAIFileCache(
                param.owner,
                param.repo,
                branch,
                {
                    file_name: fileName,
                    path: filePath,
                    sha: fileInfo.sha,
                    description: fileInfo.description,
                    consumes: consumes,
                    consumed_by: consumedBy
                }
            );
        } catch (error) {
            logError(`Error saving AI cache entry to Supabase for ${filePath}: ${error}`);
        }
    }
}


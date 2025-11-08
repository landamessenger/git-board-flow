import { createClient } from '@supabase/supabase-js';
import { COMMAND } from '../../utils/constants';
import { logDebugInfo, logError, logInfo, logSingleLine } from '../../utils/logger';
import { SupabaseConfig } from '../model/supabase_config';

export interface AICachedFileInfo {
    owner: string;
    repository: string;
    branch: string;
    file_name: string;
    path: string;
    sha: string;
    description: string;
    consumes: string[];
    consumed_by: string[];
    created_at?: string;
    last_updated?: string;
}

export class SupabaseRepository {
    private readonly AI_FILE_CACHE_TABLE = 'ai_file_cache';
    private readonly MAX_BATCH_SIZE = 500;
    private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds
    private supabase: any;

    constructor(config: SupabaseConfig) {
        const customFetch = async (input: string | URL | Request, init?: RequestInit) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.DEFAULT_TIMEOUT);

            try {
                const response = await fetch(input, {
                    ...init,
                    signal: controller.signal
                });
                return response;
            } finally {
                clearTimeout(timeoutId);
            }
        };

        this.supabase = createClient(config.getUrl(), config.getKey(), {
            global: {
                headers: {
                    'X-Client-Info': COMMAND
                },
                fetch: customFetch
            },
            db: {
                schema: 'public'
            },
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true
            }
        });
    }

    /**
     * Set or update AI file cache entry
     * If SHA hasn't changed, this will update the entry
     */
    setAIFileCache = async (
        owner: string,
        repository: string,
        branch: string,
        fileInfo: {
            file_name: string;
            path: string;
            sha: string;
            description: string;
            consumes: string[];
            consumed_by: string[];
        }
    ): Promise<void> => {
        try {
            const { error } = await this.supabase
                .from(this.AI_FILE_CACHE_TABLE)
                .upsert({
                    owner,
                    repository,
                    branch,
                    file_name: fileInfo.file_name,
                    path: fileInfo.path,
                    sha: fileInfo.sha,
                    description: fileInfo.description,
                    consumes: fileInfo.consumes,
                    consumed_by: fileInfo.consumed_by,
                    last_updated: new Date().toISOString()
                }, {
                    onConflict: 'owner,repository,branch,path'
                });

            if (error) {
                logError(`Error setting AI file cache for ${fileInfo.path}: ${JSON.stringify(error, null, 2)}`);
                throw error;
            }
        } catch (error) {
            logError(`Error setting AI file cache ${fileInfo.path}: ${JSON.stringify(error, null, 2)}`);
            throw error;
        }
    }

    /**
     * Get AI file cache entry by path
     */
    getAIFileCache = async (
        owner: string,
        repository: string,
        branch: string,
        filePath: string,
    ): Promise<AICachedFileInfo | null> => {
        try {
            const { data, error } = await this.supabase
                .from(this.AI_FILE_CACHE_TABLE)
                .select('*')
                .eq('owner', owner)
                .eq('repository', repository)
                .eq('branch', branch)
                .eq('path', filePath)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // No rows returned
                    return null;
                }
                logError(`Error getting AI file cache: ${JSON.stringify(error, null, 2)}`);
                return null;
            }

            return data as AICachedFileInfo;
        } catch (error) {
            logError(`Error getting AI file cache: ${JSON.stringify(error, null, 2)}`);
            return null;
        }
    }

    /**
     * Get all AI file cache entries for a branch
     */
    getAIFileCachesByBranch = async (
        owner: string,
        repository: string,
        branch: string,
    ): Promise<AICachedFileInfo[]> => {
        try {
            const { data, error } = await this.supabase
                .from(this.AI_FILE_CACHE_TABLE)
                .select('*')
                .eq('owner', owner)
                .eq('repository', repository)
                .eq('branch', branch)
                .order('path');

            if (error) {
                logError(`Error getting AI file caches by branch: ${JSON.stringify(error, null, 2)}`);
                return [];
            }

            if (!data) {
                return [];
            }

            return data as AICachedFileInfo[];
        } catch (error) {
            logError(`Error getting AI file caches by branch: ${JSON.stringify(error, null, 2)}`);
            return [];
        }
    }


    /**
     * Remove AI file cache entry by path
     */
    removeAIFileCacheByPath = async (
        owner: string,
        repository: string,
        branch: string,
        filePath: string,
    ): Promise<void> => {
        try {
            const { error } = await this.supabase
                .from(this.AI_FILE_CACHE_TABLE)
                .delete()
                .eq('owner', owner)
                .eq('repository', repository)
                .eq('branch', branch)
                .eq('path', filePath);

            if (error) {
                throw error;
            }
        } catch (error) {
            logError(`Error removing AI file cache by path: ${JSON.stringify(error, null, 2)}`);
            throw error;
        }
    }

    /**
     * Duplicate AI file cache entries from one branch to another
     */
    duplicateAIFileCacheByBranch = async (
        owner: string,
        repository: string,
        sourceBranch: string,
        targetBranch: string,
    ): Promise<void> => {
        try {
            const { error } = await this.supabase
                .rpc('duplicate_ai_file_cache_by_branch', {
                    owner_param: owner,
                    repository_param: repository,
                    source_branch_param: sourceBranch,
                    target_branch_param: targetBranch
                });

            if (error) {
                logError(`Error duplicating AI file cache by branch: ${JSON.stringify(error, null, 2)}`);
                throw error;
            }
        } catch (error) {
            logError(`Error duplicating AI file cache by branch: ${JSON.stringify(error, null, 2)}`);
            throw error;
        }
    }

    /**
     * Remove all AI file cache entries for a branch
     */
    removeAIFileCacheByBranch = async (
        owner: string,
        repository: string,
        branch: string,
    ): Promise<void> => {
        try {
            const { error } = await this.supabase
                .rpc('delete_ai_file_cache_by_branch', {
                    owner_param: owner,
                    repository_param: repository,
                    branch_param: branch
                });

            if (error) {
                logError(`Error removing AI file cache by branch: ${JSON.stringify(error, null, 2)}`);
                throw error;
            }
        } catch (error) {
            logError(`Error removing AI file cache by branch: ${JSON.stringify(error, null, 2)}`);
            throw error;
        }
    }

    /**
     * Get SHA by path (for checking if file is cached)
     */
    getShasumByPath = async (
        owner: string,
        repository: string,
        branch: string,
        path: string,
    ): Promise<string | undefined> => {
        try {
            const cached = await this.getAIFileCache(owner, repository, branch, path);
            return cached?.sha;
        } catch (error) {
            logError(`Error getting SHA by path: ${JSON.stringify(error, null, 2)}`);
            return undefined;
        }
    }

    /**
     * Get distinct paths for a branch
     */
    getDistinctPaths = async (
        owner: string,
        repository: string,
        branch: string,
    ): Promise<string[]> => {
        try {
            const cachedFiles = await this.getAIFileCachesByBranch(owner, repository, branch);
            return cachedFiles.map(file => file.path);
        } catch (error) {
            logError(`Error getting distinct paths: ${JSON.stringify(error, null, 2)}`);
            return [];
        }
    }

} 
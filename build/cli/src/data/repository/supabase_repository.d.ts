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
export declare class SupabaseRepository {
    private readonly AI_FILE_CACHE_TABLE;
    private readonly MAX_BATCH_SIZE;
    private readonly DEFAULT_TIMEOUT;
    private supabase;
    constructor(config: SupabaseConfig);
    /**
     * Set or update AI file cache entry
     * If SHA hasn't changed, this will update the entry
     */
    setAIFileCache: (owner: string, repository: string, branch: string, fileInfo: {
        file_name: string;
        path: string;
        sha: string;
        description: string;
        consumes: string[];
        consumed_by: string[];
    }) => Promise<void>;
    /**
     * Get AI file cache entry by path
     */
    getAIFileCache: (owner: string, repository: string, branch: string, filePath: string) => Promise<AICachedFileInfo | null>;
    /**
     * Get all AI file cache entries for a branch
     */
    getAIFileCachesByBranch: (owner: string, repository: string, branch: string) => Promise<AICachedFileInfo[]>;
    /**
     * Remove AI file cache entry by path
     */
    removeAIFileCacheByPath: (owner: string, repository: string, branch: string, filePath: string) => Promise<void>;
    /**
     * Duplicate AI file cache entries from one branch to another
     */
    duplicateAIFileCacheByBranch: (owner: string, repository: string, sourceBranch: string, targetBranch: string) => Promise<void>;
    /**
     * Remove all AI file cache entries for a branch
     */
    removeAIFileCacheByBranch: (owner: string, repository: string, branch: string) => Promise<void>;
    /**
     * Get SHA by path (for checking if file is cached)
     */
    getShasumByPath: (owner: string, repository: string, branch: string, path: string) => Promise<string | undefined>;
    /**
     * Get distinct paths for a branch
     */
    getDistinctPaths: (owner: string, repository: string, branch: string) => Promise<string[]>;
    /**
     * Get distinct branches for an owner/repository
     */
    getDistinctBranches: (owner: string, repository: string) => Promise<string[]>;
    /**
     * Get AI file cache entry by SHA (searches across all branches for the same owner/repository)
     * Returns the first match found, which can be used to reuse descriptions
     */
    getAIFileCacheBySha: (owner: string, repository: string, sha: string) => Promise<AICachedFileInfo | null>;
    /**
     * Verify that a table exists in Supabase
     */
    verifyTableExists: (tableName: string) => Promise<{
        exists: boolean;
        error?: string;
    }>;
    /**
     * Verify that an RPC function exists in Supabase
     */
    verifyRpcFunctionExists: (functionName: string, testParams: any) => Promise<{
        exists: boolean;
        error?: string;
    }>;
}

import { Execution } from '../../../../data/model/execution';
import { SupabaseRepository } from '../../../../data/repository/supabase_repository';
import { CachedFileInfo } from './types';
/**
 * Service for managing AI file cache in Supabase
 */
export declare class FileCacheManager {
    private supabaseRepository;
    /**
     * Calculate SHA256 hash of file content
     */
    calculateFileSHA(content: string): string;
    /**
     * Initialize Supabase repository if config is available
     */
    initSupabaseRepository(param: Execution): SupabaseRepository | null;
    /**
     * Load cache from Supabase (or return empty map if Supabase not available)
     */
    loadAICache(param: Execution): Promise<Map<string, CachedFileInfo>>;
    /**
     * Save cache entry to Supabase
     */
    saveAICacheEntry(param: Execution, filePath: string, fileInfo: CachedFileInfo, consumes: string[], consumedBy: string[]): Promise<void>;
}

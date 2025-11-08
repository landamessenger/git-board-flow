import { Execution } from '../../../../data/model/execution';
import { SupabaseRepository } from '../../../../data/repository/supabase_repository';
import { CachedFileInfo } from './types';
/**
 * Service for managing AI file cache in Supabase
 */
export declare class FileCacheManager {
    private supabaseRepository;
    /**
     * Normalize file path for consistent comparison
     * Removes leading ./ and normalizes path separators
     */
    private normalizePath;
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
     * Uses normalized paths for consistent lookup
     */
    loadAICache(param: Execution): Promise<Map<string, CachedFileInfo>>;
    /**
     * Get cached file info by path (with path normalization)
     */
    getCachedFile(cache: Map<string, CachedFileInfo>, filePath: string): CachedFileInfo | undefined;
    /**
     * Save cache entry to Supabase
     * Normalizes paths before saving
     */
    saveAICacheEntry(param: Execution, filePath: string, fileInfo: CachedFileInfo, consumes: string[], consumedBy: string[]): Promise<void>;
}

export declare class CacheRepository {
    /**
     * Saves data to the GitHub Actions cache
     * @param key The unique key for the cache entry
     * @param paths List of file paths to cache
     * @returns Promise<boolean> True if cache was saved successfully
     */
    saveCache(key: string, paths: string[]): Promise<boolean>;
    /**
     * Retrieves data from the GitHub Actions cache
     * @param key The unique key for the cache entry
     * @param paths List of file paths to restore
     * @returns Promise<boolean> True if cache was restored successfully
     */
    restoreCache(key: string, paths: string[]): Promise<boolean>;
}

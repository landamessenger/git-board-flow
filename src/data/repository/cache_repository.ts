import * as core from '@actions/core';
import * as cache from '@actions/cache';
import { logError } from '../../utils/logger';

export class CacheRepository {
    /**
     * Saves data to the GitHub Actions cache
     * @param key The unique key for the cache entry
     * @param paths List of file paths to cache
     * @returns Promise<boolean> True if cache was saved successfully
     */
    async saveCache(key: string, paths: string[]): Promise<boolean> {
        try {
            const cacheId = await cache.saveCache(paths, key);
            if (cacheId === -1) {
                core.warning(`Cache save failed for key: ${key}`);
                return false;
            }
            return true;
        } catch (error) {
            logError(`Error saving cache: ${error}`);
            return false;
        }
    }

    /**
     * Retrieves data from the GitHub Actions cache
     * @param key The unique key for the cache entry
     * @param paths List of file paths to restore
     * @returns Promise<boolean> True if cache was restored successfully
     */
    async restoreCache(key: string, paths: string[]): Promise<boolean> {
        try {
            const cacheKey = await cache.restoreCache(paths, key);
            if (!cacheKey) {
                core.info(`Cache miss for key: ${key}`);
                return false;
            }
            return true;
        } catch (error) {
            logError(`Error restoring cache: ${error}`);
            return false;
        }
    }
}
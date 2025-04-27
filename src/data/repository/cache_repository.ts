import * as cache from '@actions/cache';
import { logDebugInfo, logError } from '../../utils/logger';
import * as path from 'path';
import * as os from 'os';

export class CacheRepository {
    private isGitHubActions(): boolean {
        return process.env.GITHUB_ACTIONS === 'true';
    }

    private async ensureCacheDirectory(): Promise<boolean> {
        try {
            if (process.env.RUNNER_TEMP) {
                logDebugInfo(`RUNNER_TEMP: ${process.env.RUNNER_TEMP}`);
                return true;
            }
        } catch (error) {
            logError(`Error setting up cache directory: ${error}`);
        }
        return false;
    }

    /**
     * Saves data to the GitHub Actions cache
     * @param key The unique key for the cache entry
     * @param paths List of file paths to cache
     * @returns Promise<boolean> True if cache was saved successfully
     */
    async saveCache(key: string, paths: string[]): Promise<boolean> {
        if (!this.isGitHubActions()) {
            logDebugInfo('Not running in GitHub Actions environment, skipping cache save');
            return true;
        }

        if (!await this.ensureCacheDirectory()) {
            logError('Failed to set up cache directory');
            return false;
        }

        try {
            const cacheId = await cache.saveCache(paths, key);
            if (cacheId === -1) {
                logDebugInfo(`Cache save failed for key: ${key}`);
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
        if (!this.isGitHubActions()) {
            logDebugInfo('Not running in GitHub Actions environment, skipping cache restore');
            return true;
        }

        if (!await this.ensureCacheDirectory()) {
            logError('Failed to set up cache directory');
            return false;
        }

        try {
            const cacheKey = await cache.restoreCache(paths, key);
            if (!cacheKey) {
                logDebugInfo(`Cache miss for key: ${key}`);
                return false;
            }
            return true;
        } catch (error) {
            logError(`Error restoring cache: ${error}`);
            return false;
        }
    }
}
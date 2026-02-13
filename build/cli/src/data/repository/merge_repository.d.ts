import { Result } from '../model/result';
/**
 * Repository for merging branches (via PR or direct merge).
 * Isolated to allow unit tests with mocked Octokit.
 */
export declare class MergeRepository {
    mergeBranch: (owner: string, repository: string, head: string, base: string, timeout: number, token: string) => Promise<Result[]>;
}

import { Execution } from '../../data/model/execution';
import { Result } from '../../data/model/result';
import { SupabaseRepository } from '../../data/repository/supabase_repository';
import { logError, logInfo } from '../../utils/logger';
import { ParamUseCase } from '../base/param_usecase';

export class VectorActionRemovalUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'VectorActionRemovalUseCase';

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId}.`)

        const results: Result[] = [];

        try {
            if (!param.supabaseConfig) {
                results.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: true,
                        steps: [
                            `Supabase config not found.`,
                        ],
                    })
                )
                return results;
            }

            const branch = param.commit.branch || param.branches.main;

            results.push(...await this.removeChunksByBranch(param, branch));

            results.push(
                new Result({
                    id: this.taskId,
                    success: true,
                    executed: true,
                    steps: [
                        `Vector action executed successfully.`,
                    ],
                })
            );
        } catch (error) {
            logError(`Error in ${this.taskId}: ${JSON.stringify(error, null, 2)}`);
            results.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    errors: [
                        `Error in ${this.taskId}: ${JSON.stringify(error, null, 2)}`,
                    ],
                })
            );
        }

        return results;
    }

    private removeChunksByBranch = async (param: Execution, branch: string) => {
        const results: Result[] = [];
        
        if (!param.supabaseConfig) {
            results.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [
                        `Supabase config not found.`,
                    ],
                })
            )
            return results;
        }

        const supabaseRepository: SupabaseRepository = new SupabaseRepository(param.supabaseConfig);

        await supabaseRepository.removeAIFileCacheByBranch(
            param.owner,
            param.repo,
            branch
        );
        
        results.push(
            new Result({
                id: this.taskId,
                success: true,
                executed: true,
                steps: [
                    `Removed chunks for ${param.owner}/${param.repo}/${branch}.`,
                ],
            })
        );

        return results;
    }
}

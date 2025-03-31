import ivm from 'isolated-vm';
import { Execution } from "../../model/execution";
import { Result } from "../../model/result";
import { logDebugInfo, logError, logInfo } from "../../utils/logger";
import { ParamUseCase } from "../base/param_usecase";

export class ExecuteScriptUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'ExecuteScriptUseCase';

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId}.`)

        const result: Result[] = []

        try {
            const scriptParams = param.commitPrefixBuilderParams

            const isolate = new ivm.Isolate({memoryLimit: 8});

            const context = await isolate.createContext();
            const jail = context.global;

            await jail.set('global', jail.derefInto());
            const paramsKeys = Object.keys(scriptParams);
            for (const key of paramsKeys) {
                const p = scriptParams[key];
                await jail.set(key, p, {copy: true});
            }

            logDebugInfo('Executing script in isolated VM...');
            const scriptResult = await context.eval(param.commitPrefixBuilder, {
                timeout: 1000,
            });
            logDebugInfo(`Script result: ${scriptResult}`);

            result.push(
                new Result({
                    id: this.taskId,
                    success: true,
                    executed: true,
                    steps: [],
                    payload: {
                        scriptResult: scriptResult
                    }
                })
            )
        } catch (error) {
            logError(error);
            result.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [],
                    error: error,
                })
            )
        }
        return result;
    }
}
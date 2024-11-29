import {ParamUseCase} from "../base/param_usecase";
import {Execution} from "../../model/execution";
import * as core from "@actions/core";
import {Result} from "../../model/result";
import ivm from 'isolated-vm';

export class ExecuteScriptUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'ExecuteScriptUseCase';

    async invoke(param: Execution): Promise<Result[]> {
        core.info(`Executing ${this.taskId}.`)

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

            core.info('Executing script in isolated VM...');
            const scriptResult = await context.eval(`(${param.commitPrefixBuilder})()`, {
                timeout: 1000,
            });
            core.info(`Script result: ${scriptResult}`);

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
            console.error(error);
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
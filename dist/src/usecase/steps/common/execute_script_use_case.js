"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecuteScriptUseCase = void 0;
const isolated_vm_1 = __importDefault(require("isolated-vm"));
const result_1 = require("../../../data/model/result");
const logger_1 = require("../../../utils/logger");
class ExecuteScriptUseCase {
    constructor() {
        this.taskId = 'ExecuteScriptUseCase';
    }
    async invoke(param) {
        (0, logger_1.logInfo)(`Executing ${this.taskId}.`);
        const result = [];
        try {
            const scriptParams = param.commitPrefixBuilderParams;
            const isolate = new isolated_vm_1.default.Isolate({ memoryLimit: 8 });
            const context = await isolate.createContext();
            const jail = context.global;
            await jail.set('global', jail.derefInto());
            const paramsKeys = Object.keys(scriptParams);
            for (const key of paramsKeys) {
                const p = scriptParams[key];
                await jail.set(key, p, { copy: true });
            }
            (0, logger_1.logDebugInfo)('Executing script in isolated VM...');
            const scriptResult = await context.eval(param.commitPrefixBuilder, {
                timeout: 1000,
            });
            (0, logger_1.logDebugInfo)(`Script result: ${scriptResult}`);
            result.push(new result_1.Result({
                id: this.taskId,
                success: true,
                executed: true,
                steps: [],
                payload: {
                    scriptResult: scriptResult
                }
            }));
        }
        catch (error) {
            (0, logger_1.logError)(error);
            result.push(new result_1.Result({
                id: this.taskId,
                success: false,
                executed: true,
                steps: [],
                error: error,
            }));
        }
        return result;
    }
}
exports.ExecuteScriptUseCase = ExecuteScriptUseCase;

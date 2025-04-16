"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SingleActionUseCase = void 0;
const result_1 = require("../data/model/result");
const logger_1 = require("../utils/logger");
const deployed_action_use_case_1 = require("./actions/deployed_action_use_case");
const vector_action_use_case_1 = require("./vector_action_use_case");
class SingleActionUseCase {
    constructor() {
        this.taskId = 'SingleActionUseCase';
    }
    async invoke(param) {
        (0, logger_1.logInfo)(`Executing ${this.taskId}.`);
        const results = [];
        try {
            if (!param.singleAction.validSingleAction) {
                (0, logger_1.logDebugInfo)(`Not a valid single action: ${param.singleAction.currentSingleAction}`);
                return results;
            }
            if (param.singleAction.isVectorAction) {
                results.push(...await new vector_action_use_case_1.VectorActionUseCase().invoke(param));
            }
            if (param.singleAction.isDeployedAction) {
                results.push(...await new deployed_action_use_case_1.DeployedActionUseCase().invoke(param));
            }
        }
        catch (error) {
            (0, logger_1.logError)(error);
            results.push(new result_1.Result({
                id: this.taskId,
                success: false,
                executed: true,
                steps: [
                    `Error executing single action: ${param.singleAction.currentSingleAction}.`,
                ],
                error: error,
            }));
        }
        return results;
    }
}
exports.SingleActionUseCase = SingleActionUseCase;

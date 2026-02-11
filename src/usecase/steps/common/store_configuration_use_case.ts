import { Execution } from "../../../data/model/execution";
import { ConfigurationHandler } from "../../../manager/description/configuration_handler";
import { logError, logInfo } from "../../../utils/logger";
import { getTaskEmoji } from "../../../utils/task_emoji";
import { ParamUseCase } from "../../base/param_usecase";


/**
 * Store las configuration in the description
 */
export class StoreConfigurationUseCase implements ParamUseCase<Execution, void> {
    taskId: string = 'StoreConfigurationUseCase';
    private handler = new ConfigurationHandler();

    async invoke(param: Execution): Promise<void> {
        logInfo(`${getTaskEmoji(this.taskId)} Executing ${this.taskId}.`)
        try {
            await this.handler.update(
                param
            )
        } catch (error) {
            logError(error);
        }
    }
}

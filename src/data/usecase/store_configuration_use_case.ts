import {ParamUseCase} from "./base/param_usecase";
import {Execution} from "../model/execution";
import * as core from '@actions/core';
import {ConfigurationHandler} from "../manager/description/configuration_handler";

/**
 * Store las configuration in the description
 */
export class StoreConfigurationUseCase implements ParamUseCase<Execution, void> {
    taskId: string = 'StoreConfigurationUseCase';
    private handler = new ConfigurationHandler();

    async invoke(param: Execution): Promise<void> {
        core.info(`Executing ${this.taskId}.`)
        try {
            await this.handler.update(
                param
            )
        } catch (error) {
            console.error(error);
        }
    }
}

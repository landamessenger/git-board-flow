import {Config} from "../../model/config";
import * as core from "@actions/core";
import {IssueContentInterface} from "./base/issue_content_interface";
import {Execution} from "../../model/execution";

export class ConfigurationHandler extends IssueContentInterface {
    get id(): string {
        return 'configuration'
    }

    get visibleContent(): boolean {
        return false;
    }

    updateConfig = async (execution: Execution) => {
        try {
            return await this.update(execution, JSON.stringify(execution.currentConfiguration, null, 4))
        } catch (error) {
            core.error(`Error updating issue description: ${error}`);
            return undefined;
        }
    }

    readConfig = async (execution: Execution): Promise<Config | undefined> => {
        try {
            const config = await this.content(execution)
            if (config === undefined) {
                return undefined;
            }
            const branchConfig = JSON.parse(config);
            return new Config(branchConfig);
        } catch (error) {
            core.error(`Error reading issue configuration: ${error}`);
            throw error;
        }
    }
}

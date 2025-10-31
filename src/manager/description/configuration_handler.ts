import { Config } from "../../data/model/config";
import { Execution } from "../../data/model/execution";
import { logDebugInfo, logError } from "../../utils/logger";
import { IssueContentInterface } from "./base/issue_content_interface";

export class ConfigurationHandler extends IssueContentInterface {
    get id(): string {
        return 'configuration'
    }

    get visibleContent(): boolean {
        return false;
    }

    update = async (execution: Execution) => {
        try {
            return await this.internalUpdate(execution, JSON.stringify(execution.currentConfiguration, null, 4))
        } catch (error) {
            logError(`Error updating issue description: ${error}`);
            return undefined;
        }
    }

    get = async (execution: Execution): Promise<Config | undefined> => {
        try {
            const config = await this.internalGetter(execution)
            if (config === undefined) {
                return undefined;
            }
            const branchConfig = JSON.parse(config);
            return new Config(branchConfig);
        } catch (error) {
            logError(`Error reading issue configuration: ${error}`);
            throw error;
        }
    }
}

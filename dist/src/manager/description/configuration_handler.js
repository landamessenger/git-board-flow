"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigurationHandler = void 0;
const config_1 = require("../../data/model/config");
const logger_1 = require("../../utils/logger");
const issue_content_interface_1 = require("./base/issue_content_interface");
class ConfigurationHandler extends issue_content_interface_1.IssueContentInterface {
    constructor() {
        super(...arguments);
        this.update = async (execution) => {
            try {
                return await this.internalUpdate(execution, JSON.stringify(execution.currentConfiguration, null, 4));
            }
            catch (error) {
                (0, logger_1.logError)(`Error updating issue description: ${error}`);
                return undefined;
            }
        };
        this.get = async (execution) => {
            try {
                const config = await this.internalGetter(execution);
                if (config === undefined) {
                    return undefined;
                }
                const branchConfig = JSON.parse(config);
                return new config_1.Config(branchConfig);
            }
            catch (error) {
                (0, logger_1.logError)(`Error reading issue configuration: ${error}`);
                throw error;
            }
        };
    }
    get id() {
        return 'configuration';
    }
    get visibleContent() {
        return false;
    }
}
exports.ConfigurationHandler = ConfigurationHandler;

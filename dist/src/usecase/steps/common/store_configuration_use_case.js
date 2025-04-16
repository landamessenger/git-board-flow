"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StoreConfigurationUseCase = void 0;
const configuration_handler_1 = require("../../../manager/description/configuration_handler");
const logger_1 = require("../../../utils/logger");
/**
 * Store las configuration in the description
 */
class StoreConfigurationUseCase {
    constructor() {
        this.taskId = 'StoreConfigurationUseCase';
        this.handler = new configuration_handler_1.ConfigurationHandler();
    }
    async invoke(param) {
        (0, logger_1.logInfo)(`Executing ${this.taskId}.`);
        try {
            await this.handler.update(param);
        }
        catch (error) {
            (0, logger_1.logError)(error);
        }
    }
}
exports.StoreConfigurationUseCase = StoreConfigurationUseCase;

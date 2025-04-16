"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarkdownContentHotfixHandler = void 0;
const logger_1 = require("../../utils/logger");
const issue_content_interface_1 = require("./base/issue_content_interface");
class MarkdownContentHotfixHandler extends issue_content_interface_1.IssueContentInterface {
    constructor() {
        super(...arguments);
        this.update = async (execution, content) => {
            try {
                return await this.internalUpdate(execution, content);
            }
            catch (error) {
                (0, logger_1.logError)(`Error updating issue content: ${error}`);
                return undefined;
            }
        };
        this.get = async (execution) => {
            try {
                const content = await this.internalGetter(execution);
                if (content === undefined) {
                    return undefined;
                }
                return content;
            }
            catch (error) {
                (0, logger_1.logError)(`Error reading issue content: ${error}`);
                throw error;
            }
        };
    }
    get id() {
        return 'markdown_content_hotfix_handler';
    }
    get visibleContent() {
        return true;
    }
}
exports.MarkdownContentHotfixHandler = MarkdownContentHotfixHandler;

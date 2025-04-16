"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentInterface = void 0;
const logger_1 = require("../../../utils/logger");
class ContentInterface {
    constructor() {
        this.getContent = (description) => {
            try {
                if (description === undefined) {
                    return undefined;
                }
                if (description.indexOf(this.startPattern) === -1 || description.indexOf(this.endPattern) === -1) {
                    return undefined;
                }
                return description.split(this.startPattern)[1].split(this.endPattern)[0];
            }
            catch (error) {
                (0, logger_1.logError)(`Error reading issue configuration: ${error}`);
                throw error;
            }
        };
        this._addContent = (description, content) => {
            if (description.indexOf(this.startPattern) === -1 && description.indexOf(this.endPattern) === -1) {
                const newContent = `${this.startPattern}\n${content}\n${this.endPattern}`;
                return `${description}\n\n${newContent}`;
            }
            else {
                return undefined;
            }
        };
        this._updateContent = (description, content) => {
            if (description.indexOf(this.startPattern) === -1 || description.indexOf(this.endPattern) === -1) {
                (0, logger_1.logError)(`The content has a problem with open-close tags: ${this.startPattern} / ${this.endPattern}`);
                return undefined;
            }
            const start = description.split(this.startPattern)[0];
            const mid = `${this.startPattern}\n${content}\n${this.endPattern}`;
            const end = description.split(this.endPattern)[1];
            return `${start}${mid}${end}`;
        };
        this.updateContent = (description, content) => {
            try {
                if (description === undefined || content === undefined) {
                    return undefined;
                }
                const addedContent = this._addContent(description, content);
                if (addedContent !== undefined) {
                    return addedContent;
                }
                return this._updateContent(description, content);
            }
            catch (error) {
                (0, logger_1.logError)(`Error updating issue description: ${error}`);
                return undefined;
            }
        };
    }
    get _id() {
        return `git-board-flow-${this.id}`;
    }
    get startPattern() {
        if (this.visibleContent) {
            return `<!-- ${this._id}-start -->`;
        }
        return `<!-- ${this._id}-start`;
    }
    get endPattern() {
        if (this.visibleContent) {
            return `<!-- ${this._id}-end -->`;
        }
        return `${this._id}-end -->`;
    }
}
exports.ContentInterface = ContentInterface;

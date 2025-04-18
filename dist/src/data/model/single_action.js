"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SingleAction = void 0;
const constants_1 = require("../../utils/constants");
const logger_1 = require("../../utils/logger");
class SingleAction {
    get isDeployedAction() {
        return this.currentSingleAction === constants_1.ACTIONS.DEPLOYED;
    }
    get isVectorAction() {
        return this.currentSingleAction === constants_1.ACTIONS.VECTOR;
    }
    get isAskAction() {
        return this.currentSingleAction === constants_1.ACTIONS.ASK;
    }
    get enabledSingleAction() {
        return this.currentSingleAction.length > 0;
    }
    get validSingleAction() {
        return this.enabledSingleAction &&
            this.currentSingleActionIssue > 0 &&
            this.actions.indexOf(this.currentSingleAction) > -1;
    }
    constructor(currentSingleAction, currentSingleActionIssue) {
        this.currentSingleActionIssue = -1;
        this.actions = [constants_1.ACTIONS.DEPLOYED, constants_1.ACTIONS.VECTOR, constants_1.ACTIONS.ASK];
        this.isIssue = false;
        this.isPullRequest = false;
        this.isPush = false;
        try {
            this.currentSingleActionIssue = parseInt(currentSingleActionIssue);
        }
        catch (error) {
            (0, logger_1.logError)(`Issue ${currentSingleActionIssue} is not a number.`);
            (0, logger_1.logError)(error);
        }
        this.currentSingleAction = currentSingleAction;
    }
}
exports.SingleAction = SingleAction;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractVersionFromBranch = exports.extractIssueNumberFromPush = exports.extractIssueNumberFromBranch = void 0;
const logger_1 = require("./logger");
const extractIssueNumberFromBranch = (branchName) => {
    const match = branchName?.match(/[a-zA-Z]+\/([0-9]+)-.*/);
    if (match) {
        return parseInt(match[1]);
    }
    else {
        (0, logger_1.logDebugInfo)('No issue number found in the branch name.');
        return -1;
    }
};
exports.extractIssueNumberFromBranch = extractIssueNumberFromBranch;
const extractIssueNumberFromPush = (branchName) => {
    const issueNumberMatch = branchName.match(/^[^/]+\/(\d+)-/);
    if (!issueNumberMatch) {
        (0, logger_1.logDebugInfo)('No issue number found in the branch name.');
        return -1;
    }
    const issueNumber = parseInt(issueNumberMatch[1], 10);
    (0, logger_1.logDebugInfo)(`Linked Issue: #${issueNumber}`);
    return issueNumber;
};
exports.extractIssueNumberFromPush = extractIssueNumberFromPush;
const extractVersionFromBranch = (branchName) => {
    const match = branchName?.match(/^[^\/]+\/(\d+\.\d+\.\d+)$/);
    if (match) {
        return match[1];
    }
    else {
        (0, logger_1.logDebugInfo)('No version found in the branch name.');
        return undefined;
    }
};
exports.extractVersionFromBranch = extractVersionFromBranch;

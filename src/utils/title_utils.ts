import { logDebugInfo } from "./logger";

export const extractIssueNumberFromBranch = (branchName: string): number => {
    const match = branchName?.match(/[a-zA-Z]+\/([0-9]+)-.*/);

    if (match) {
        return parseInt(match[1])
    } else {
        logDebugInfo('No issue number found in the branch name.');
        return -1;
    }
}

export const extractIssueNumberFromPush = (branchName: string): number => {
    const issueNumberMatch = branchName.match(/^[^/]+\/(\d+)-/);
    if (!issueNumberMatch) {
        logDebugInfo('No issue number found in the branch name.');
        return -1;
    }

    const issueNumber = parseInt(issueNumberMatch[1], 10);
    logDebugInfo(`Linked Issue: #${issueNumber}`);
    return issueNumber;
}

export const extractVersionFromBranch = (branchName: string): string | undefined => {
    const match = branchName?.match(/^[^/]+\/(\d+\.\d+\.\d+)$/);

    if (match) {
        return match[1];
    } else {
        logDebugInfo('No version found in the branch name.');
        return undefined;
    }
};

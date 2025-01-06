import * as core from "@actions/core";

export const extractIssueNumberFromBranch = (branchName: string): number => {
    const match = branchName?.match(/[a-zA-Z]+\/([0-9]+)-.*/);

    if (match) {
        return parseInt(match[1])
    } else {
        core.info('No issue number found in the branch name.');
        return -1;
    }
}

export const extractIssueNumberFromPush = (branchName: string): number => {
    const issueNumberMatch = branchName.match(/^[^/]+\/(\d+)-/);
    if (!issueNumberMatch) {
        core.info('No issue number found in the branch name.');
        return -1;
    }

    const issueNumber = parseInt(issueNumberMatch[1], 10);
    core.info(`Linked Issue: #${issueNumber}`);
    return issueNumber;
}

export const extractVersionFromBranch = (branchName: string): string | undefined => {
    const match = branchName?.match(/^[^\/]+\/(\d+\.\d+\.\d+)$/);

    if (match) {
        return match[1];
    } else {
        core.info('No version found in the branch name.');
        return undefined;
    }
};

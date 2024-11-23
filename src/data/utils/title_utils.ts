export const extractIssueNumberFromBranch = (branchName: string): number => {
    const match = branchName?.match(/[a-zA-Z]+\/([0-9]+)-.*/);

    if (match) {
        return parseInt(match[1])
    } else {
        throw new Error(`No issue number found in branch name: ${branchName}`);
    }
}
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

/**
 * Formats an issue title to include progress tracking after the emoji prefix.
 * Example: "✨🧑‍💻 - Introduce the new Copilot agent" → "✨🧑‍💻 - [65%] - Introduce the new Copilot agent"
 * Removes any existing [X%] marker before inserting the new one.
 */
export const formatTitleWithProgress = (currentTitle: string, progress: number): string => {
    const progressStr = `[${progress}%]`;
    const withoutExistingProgress = currentTitle.replace(/\s*-\s*\[\d+%\]\s*/g, '').trim();
    const match = withoutExistingProgress.match(/^(.+?)\s*-\s+(.+)$/);
    if (!match) {
        return `${progressStr} - ${withoutExistingProgress}`;
    }
    const emojiPart = match[1].trim();
    const rest = match[2].trim();
    return rest ? `${emojiPart} - ${progressStr} - ${rest}` : `${emojiPart} - ${progressStr}`;
};

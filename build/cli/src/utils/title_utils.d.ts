export declare const extractIssueNumberFromBranch: (branchName: string) => number;
export declare const extractIssueNumberFromPush: (branchName: string) => number;
export declare const extractVersionFromBranch: (branchName: string) => string | undefined;
/**
 * Formats an issue title to include progress tracking after the emoji prefix.
 * Example: "✨🧑‍💻 - Introduce the new Copilot agent" → "✨🧑‍💻 - [65%] - Introduce the new Copilot agent"
 * Removes any existing [X%] marker before inserting the new one.
 */
export declare const formatTitleWithProgress: (currentTitle: string, progress: number) => string;

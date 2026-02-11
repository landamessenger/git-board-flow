import type { Execution } from "../../../../data/model/execution";
import type { BugbotContext } from "./types";
/**
 * Loads all context needed for bugbot: existing findings from issue + PR comments,
 * open PR numbers, and the prompt block for previously reported issues.
 * Also loads PR context (head sha, files, diff lines) for the first open PR.
 */
export declare function loadBugbotContext(param: Execution): Promise<BugbotContext>;

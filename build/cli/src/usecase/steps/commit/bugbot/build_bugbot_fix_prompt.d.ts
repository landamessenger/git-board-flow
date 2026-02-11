import type { Execution } from "../../../../data/model/execution";
import type { BugbotContext } from "./types";
/**
 * Builds the prompt for the OpenCode build agent to fix the selected bugbot findings.
 * Includes repo context, the findings to fix (with full detail), the user's comment,
 * strict scope rules, and the verify commands to run.
 */
export declare function buildBugbotFixPrompt(param: Execution, context: BugbotContext, targetFindingIds: string[], userComment: string, verifyCommands: string[]): string;

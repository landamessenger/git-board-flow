import type { Execution } from "../../../../data/model/execution";
import type { BugbotContext } from "./types";
import type { BugbotFinding } from "./types";
export interface PublishFindingsParam {
    execution: Execution;
    context: BugbotContext;
    findings: BugbotFinding[];
}
/**
 * Publishes current findings to issue and PR: creates or updates issue comments,
 * creates or updates PR review comments (or creates new ones).
 */
export declare function publishFindings(param: PublishFindingsParam): Promise<void>;

/**
 * After autofix (or when OpenCode returns resolved_finding_ids in detection), we mark those
 * findings as resolved: update the issue comment with a "Resolved" note and set resolved:true
 * in the marker; update the PR review comment marker and resolve the review thread.
 */
import type { Execution } from "../../../../data/model/execution";
import type { BugbotContext } from "./types";
export interface MarkFindingsResolvedParam {
    execution: Execution;
    context: BugbotContext;
    resolvedFindingIds: Set<string>;
    normalizedResolvedIds: Set<string>;
}
/**
 * Marks as resolved the findings that OpenCode reported as fixed.
 * Updates issue comments (with visible "Resolved" note) and PR review comments (marker only + resolve thread).
 */
export declare function markFindingsResolved(param: MarkFindingsResolvedParam): Promise<void>;

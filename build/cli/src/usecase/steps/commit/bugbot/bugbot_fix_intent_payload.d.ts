import type { Result } from "../../../../data/model/result";
import type { MarkFindingsResolvedParam } from "./mark_findings_resolved_use_case";
export type BugbotFixIntentPayload = {
    isFixRequest: boolean;
    targetFindingIds: string[];
    context?: MarkFindingsResolvedParam["context"];
    branchOverride?: string;
};
export declare function getBugbotFixIntentPayload(results: Result[]): BugbotFixIntentPayload | undefined;
export declare function canRunBugbotAutofix(payload: BugbotFixIntentPayload | undefined): payload is BugbotFixIntentPayload & {
    context: NonNullable<BugbotFixIntentPayload["context"]>;
};

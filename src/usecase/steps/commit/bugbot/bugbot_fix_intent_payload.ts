import type { Result } from "../../../../data/model/result";
import type { MarkFindingsResolvedParam } from "./mark_findings_resolved_use_case";

export type BugbotFixIntentPayload = {
    isFixRequest: boolean;
    targetFindingIds: string[];
    context?: MarkFindingsResolvedParam["context"];
    branchOverride?: string;
};

export function getBugbotFixIntentPayload(
    results: Result[]
): BugbotFixIntentPayload | undefined {
    const last = results[results.length - 1];
    const payload = last?.payload;
    if (!payload || typeof payload !== "object") return undefined;
    return payload as BugbotFixIntentPayload;
}

export function canRunBugbotAutofix(
    payload: BugbotFixIntentPayload | undefined
): payload is BugbotFixIntentPayload & {
    context: NonNullable<BugbotFixIntentPayload["context"]>;
} {
    return (
        !!payload?.isFixRequest &&
        Array.isArray(payload.targetFindingIds) &&
        payload.targetFindingIds.length > 0 &&
        !!payload.context
    );
}

/**
 * Bugbot marker: we embed a hidden HTML comment in each finding comment (issue and PR)
 * with finding_id and resolved flag. This lets us (1) find existing findings when loading
 * context, (2) update the same comment when OpenCode re-reports or marks resolved, (3) match
 * threads when the user replies "fix it" in a PR.
 */
import type { BugbotFinding } from "./types";
/** Sanitize finding ID so it cannot break HTML comment syntax (e.g. -->, <!, <, >, newlines, quotes). */
export declare function sanitizeFindingIdForMarker(findingId: string): string;
export declare function buildMarker(findingId: string, resolved: boolean): string;
export declare function parseMarker(body: string | null): Array<{
    findingId: string;
    resolved: boolean;
}>;
/**
 * Regex to match the marker for a specific finding (same flexible format as parseMarker).
 * Finding IDs from external data (comments, API) are length-limited and validated to mitigate ReDoS.
 */
export declare function markerRegexForFinding(findingId: string): RegExp;
/**
 * Find the marker for this finding in body (using same pattern as parseMarker) and replace it.
 * Returns the updated body and whether a replacement was made. Logs an error with details if no replacement occurred.
 */
export declare function replaceMarkerInBody(body: string, findingId: string, newResolved: boolean, replacement?: string): {
    updated: string;
    replaced: boolean;
};
/** Extract title from comment body (first ## line) for context when sending to OpenCode. */
export declare function extractTitleFromBody(body: string | null): string;
/** Builds the visible comment body (title, severity, location, description, suggestion) plus the hidden marker for this finding. */
export declare function buildCommentBody(finding: BugbotFinding, resolved: boolean): string;

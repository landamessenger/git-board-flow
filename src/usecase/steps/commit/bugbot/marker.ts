/**
 * Bugbot marker: we embed a hidden HTML comment in each finding comment (issue and PR)
 * with finding_id and resolved flag. This lets us (1) find existing findings when loading
 * context, (2) update the same comment when OpenCode re-reports or marks resolved, (3) match
 * threads when the user replies "fix it" in a PR.
 */

import { BUGBOT_MARKER_PREFIX } from "../../../../utils/constants";
import { logError } from "../../../../utils/logger";
import type { BugbotFinding } from "./types";

/** Sanitize finding ID so it cannot break HTML comment syntax (e.g. -->, <!, <, >, newlines, quotes). */
export function sanitizeFindingIdForMarker(findingId: string): string {
    return findingId
        .replace(/-->/g, '')
        .replace(/<!/g, '')
        .replace(/</g, '')
        .replace(/>/g, '')
        .replace(/"/g, '')
        .replace(/\r\n|\r|\n/g, '')
        .trim();
}

export function buildMarker(findingId: string, resolved: boolean): string {
    const safeId = sanitizeFindingIdForMarker(findingId);
    return `<!-- ${BUGBOT_MARKER_PREFIX} finding_id:"${safeId}" resolved:${resolved} -->`;
}

export function parseMarker(body: string | null): Array<{ findingId: string; resolved: boolean }> {
    if (!body) return [];
    const results: Array<{ findingId: string; resolved: boolean }> = [];
    const regex = new RegExp(
        `<!--\\s*${BUGBOT_MARKER_PREFIX}\\s+finding_id:\\s*"([^"]+)"\\s+resolved:(true|false)\\s*-->`,
        'g'
    );
    let m: RegExpExecArray | null;
    while ((m = regex.exec(body)) !== null) {
        results.push({ findingId: m[1], resolved: m[2] === 'true' });
    }
    return results;
}

/** Regex to match the marker for a specific finding (same flexible format as parseMarker). */
export function markerRegexForFinding(findingId: string): RegExp {
    const safeId = sanitizeFindingIdForMarker(findingId);
    const escapedId = safeId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(
        `<!--\\s*${BUGBOT_MARKER_PREFIX}\\s+finding_id:\\s*"${escapedId}"\\s+resolved:(?:true|false)\\s*-->`,
        'g'
    );
}

/**
 * Find the marker for this finding in body (using same pattern as parseMarker) and replace it.
 * Returns the updated body and whether a replacement was made. Logs an error with details if no replacement occurred.
 */
export function replaceMarkerInBody(
    body: string,
    findingId: string,
    newResolved: boolean,
    replacement?: string
): { updated: string; replaced: boolean } {
    const regex = markerRegexForFinding(findingId);
    const newMarker = replacement ?? buildMarker(findingId, newResolved);
    const updated = body.replace(regex, newMarker);
    const replaced = updated !== body;
    if (!replaced) {
        logError(
            `[Bugbot] No se pudo marcar como resuelto: no se encontró el marcador en el comentario. findingId="${findingId}", bodyLength=${body?.length ?? 0}, bodySnippet=${(body ?? '').slice(0, 200)}...`
        );
    }
    return { updated, replaced };
}

/** Extract title from comment body (first ## line) for context when sending to OpenCode. */
export function extractTitleFromBody(body: string | null): string {
    if (!body) return '';
    const match = body.match(/^##\s+(.+)$/m);
    return (match?.[1] ?? '').trim();
}

/** Builds the visible comment body (title, severity, location, description, suggestion) plus the hidden marker for this finding. */
export function buildCommentBody(finding: BugbotFinding, resolved: boolean): string {
    const severity = finding.severity ? `**Severity:** ${finding.severity}\n\n` : '';
    const fileLine =
        finding.file != null
            ? `**Location:** \`${finding.file}${finding.line != null ? `:${finding.line}` : ''}\`\n\n`
            : '';
    const suggestion = finding.suggestion
        ? `**Suggested fix:**\n${finding.suggestion}\n\n`
        : '';
    const resolvedNote = resolved ? '\n\n---\n**Resolved** (no longer reported in latest analysis).\n' : '';
    const marker = buildMarker(finding.id, resolved);
    return `## ${finding.title}

${severity}${fileLine}${finding.description}
${suggestion}${resolvedNote}${marker}`;
}

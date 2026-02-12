/**
 * Sanitizes user-provided comment text before inserting into an AI prompt.
 * Prevents prompt injection by neutralizing sequences that could break out of
 * delimiters (e.g. triple quotes) or be interpreted as instructions.
 */

const MAX_USER_COMMENT_LENGTH = 4000;

/**
 * Sanitize a user comment for safe inclusion in a prompt.
 * - Trims whitespace.
 * - Escapes backslashes so triple-quote cannot be smuggled via \"""
 * - Replaces """ with "" so the comment cannot close a triple-quoted block.
 * - Truncates to a maximum length.
 */
export function sanitizeUserCommentForPrompt(raw: string): string {
    if (typeof raw !== "string") return "";
    let s = raw.trim();
    s = s.replace(/\\/g, "\\\\");
    s = s.replace(/"""/g, '""');
    if (s.length > MAX_USER_COMMENT_LENGTH) {
        s = s.slice(0, MAX_USER_COMMENT_LENGTH) + "\n[... truncated]";
    }
    return s;
}

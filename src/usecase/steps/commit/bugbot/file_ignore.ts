/** Max length for a single ignore pattern to avoid ReDoS from long/complex regex. */
const MAX_PATTERN_LENGTH = 500;

/**
 * Converts a glob-like pattern to a safe regex string (bounded length, collapsed stars to avoid ReDoS).
 */
function patternToRegexString(p: string): string | null {
    if (p.length > MAX_PATTERN_LENGTH) return null;
    const collapsed = p.replace(/\*+/g, '*');
    return collapsed
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\//g, '\\/');
}

/**
 * Returns true if the file path matches any of the ignore patterns (glob-style).
 * Used to exclude findings in test files, build output, etc.
 * Pattern length is capped and consecutive * are collapsed to avoid ReDoS.
 */
export function fileMatchesIgnorePatterns(filePath: string | undefined, ignorePatterns: string[]): boolean {
    if (!filePath || ignorePatterns.length === 0) return false;
    const normalized = filePath.trim();
    if (!normalized) return false;

    return ignorePatterns.some((pattern) => {
        const p = pattern.trim();
        if (!p) return false;
        const regexPattern = patternToRegexString(p);
        if (regexPattern == null) return false;
        const regex = p.endsWith('/*')
            ? new RegExp(`^${regexPattern.replace(/\\\/\.\*$/, '(\\/.*)?')}$`)
            : new RegExp(`^${regexPattern}$`);
        return regex.test(normalized);
    });
}

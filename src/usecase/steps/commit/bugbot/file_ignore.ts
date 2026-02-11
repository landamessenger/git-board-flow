/**
 * Returns true if the file path matches any of the ignore patterns (glob-style).
 * Used to exclude findings in test files, build output, etc.
 */
export function fileMatchesIgnorePatterns(filePath: string | undefined, ignorePatterns: string[]): boolean {
    if (!filePath || ignorePatterns.length === 0) return false;
    const normalized = filePath.trim();
    if (!normalized) return false;

    return ignorePatterns.some((pattern) => {
        const p = pattern.trim();
        if (!p) return false;
        const regexPattern = p
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*')
            .replace(/\//g, '\\/');
        const regex = p.endsWith('/*')
            ? new RegExp(`^${regexPattern.replace(/\\\/\.\*$/, '(\\/.*)?')}$`)
            : new RegExp(`^${regexPattern}$`);
        return regex.test(normalized);
    });
}

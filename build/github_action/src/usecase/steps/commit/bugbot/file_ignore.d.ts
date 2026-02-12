/**
 * Returns true if the file path matches any of the ignore patterns (glob-style).
 * Used to exclude findings in test files, build output, etc.
 * Pattern length is capped and consecutive * are collapsed to avoid ReDoS.
 */
export declare function fileMatchesIgnorePatterns(filePath: string | undefined, ignorePatterns: string[]): boolean;

/**
 * Returns true if the file path matches any of the ignore patterns (glob-style).
 * Used to exclude findings in test files, build output, etc.
 */
export declare function fileMatchesIgnorePatterns(filePath: string | undefined, ignorePatterns: string[]): boolean;

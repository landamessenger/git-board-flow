/**
 * Heuristic to detect test files. Used so we never exclude tests from the
 * context sent to OpenCode (progress, PR description, error detection),
 * since tests are part of implementation progress and quality.
 */
const TEST_PATH_SEGMENTS = ['__tests__', '/tests/', '/test/'];
const TEST_EXT_REGEX = /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/i;

/**
 * Returns true if the path looks like a test file. Such files should always
 * be included in changes sent to OpenCode.
 */
export function isTestFile(filename: string): boolean {
    const normalized = filename.replace(/\\/g, '/');
    if (TEST_EXT_REGEX.test(normalized)) return true;
    return TEST_PATH_SEGMENTS.some((seg) => normalized.includes(seg));
}

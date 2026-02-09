import { isTestFile } from '../file_utils';

describe('isTestFile', () => {
    it('returns true for *.test.ts', () => {
        expect(isTestFile('src/foo.test.ts')).toBe(true);
        expect(isTestFile('foo.test.ts')).toBe(true);
    });
    it('returns true for *.spec.ts', () => {
        expect(isTestFile('src/bar.spec.ts')).toBe(true);
        expect(isTestFile('bar.spec.js')).toBe(true);
    });
    it('returns true for __tests__ paths', () => {
        expect(isTestFile('src/__tests__/foo.ts')).toBe(true);
        expect(isTestFile('__tests__/bar.js')).toBe(true);
    });
    it('returns true for /tests/ path segment', () => {
        expect(isTestFile('src/tests/unit/foo.ts')).toBe(true);
    });
    it('returns true for .test.tsx and .spec.jsx', () => {
        expect(isTestFile('Component.test.tsx')).toBe(true);
        expect(isTestFile('Component.spec.jsx')).toBe(true);
    });
    it('returns false for non-test source files', () => {
        expect(isTestFile('src/foo.ts')).toBe(false);
        expect(isTestFile('src/bar.js')).toBe(false);
        expect(isTestFile('README.md')).toBe(false);
    });
});

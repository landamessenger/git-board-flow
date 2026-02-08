import {
  extractIssueNumberFromBranch,
  extractIssueNumberFromPush,
  extractVersionFromBranch,
} from '../title_utils';

jest.mock('../logger', () => ({
  logDebugInfo: jest.fn(),
}));

describe('title_utils', () => {
  describe('extractIssueNumberFromBranch', () => {
    it('extracts issue number from branch name with pattern prefix/num-description', () => {
      expect(extractIssueNumberFromBranch('feature/123-my-feature')).toBe(123);
      expect(extractIssueNumberFromBranch('bugfix/456-fix-login')).toBe(456);
    });

    it('returns -1 when no match', () => {
      expect(extractIssueNumberFromBranch('main')).toBe(-1);
      expect(extractIssueNumberFromBranch('develop')).toBe(-1);
      expect(extractIssueNumberFromBranch('feature-no-number')).toBe(-1);
    });

    it('handles undefined or empty branch safely', () => {
      expect(extractIssueNumberFromBranch('')).toBe(-1);
      expect(extractIssueNumberFromBranch(undefined as unknown as string)).toBe(-1);
    });
  });

  describe('extractIssueNumberFromPush', () => {
    it('extracts issue number from push branch name', () => {
      expect(extractIssueNumberFromPush('feature/123-something')).toBe(123);
      expect(extractIssueNumberFromPush('bugfix/999-other')).toBe(999);
    });

    it('returns -1 when no match', () => {
      expect(extractIssueNumberFromPush('main')).toBe(-1);
      expect(extractIssueNumberFromPush('release/1.0.0')).toBe(-1);
    });
  });

  describe('extractVersionFromBranch', () => {
    it('extracts version from branch name ending with x.y.z', () => {
      expect(extractVersionFromBranch('release/1.2.3')).toBe('1.2.3');
      expect(extractVersionFromBranch('hotfix/2.0.0')).toBe('2.0.0');
    });

    it('returns undefined when no version in branch', () => {
      expect(extractVersionFromBranch('release/next')).toBeUndefined();
      expect(extractVersionFromBranch('main')).toBeUndefined();
    });

    it('handles undefined or empty branch', () => {
      expect(extractVersionFromBranch('')).toBeUndefined();
      expect(extractVersionFromBranch(undefined as unknown as string)).toBeUndefined();
    });
  });
});

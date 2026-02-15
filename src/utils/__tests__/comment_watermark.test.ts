import { COPILOT_MARKETPLACE_URL, getCommentWatermark } from '../comment_watermark';

describe('comment_watermark', () => {
  it('exports marketplace URL', () => {
    expect(COPILOT_MARKETPLACE_URL).toBe(
      'https://github.com/marketplace/actions/copilot-github-with-super-powers'
    );
  });

  it('returns default watermark when no options', () => {
    const w = getCommentWatermark();
    expect(w).toContain('Made with');
    expect(w).toContain('vypdev/copilot');
    expect(w).toContain(COPILOT_MARKETPLACE_URL);
  });

  it('returns bugbot watermark with commit link when options provided', () => {
    const w = getCommentWatermark({ commitSha: 'abc123', owner: 'o', repo: 'r' });
    expect(w).toContain('Written by');
    expect(w).toContain('vypdev/copilot');
    expect(w).toContain('abc123');
    expect(w).toContain('github.com/o/r/commit/abc123');
    expect(w).toContain('This will update automatically on new commits');
  });
});

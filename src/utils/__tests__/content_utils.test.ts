import {
  extractVersion,
  extractReleaseType,
  extractChangelogUpToAdditionalContext,
  injectJsonAsMarkdownBlock,
} from '../content_utils';

describe('content_utils', () => {
  describe('extractVersion', () => {
    it('extracts version matching pattern', () => {
      const text = '### Release Version 1.2.3';
      expect(extractVersion('Release Version', text)).toBe('1.2.3');
    });

    it('is case-insensitive', () => {
      expect(extractVersion('Release Version', '### release version 2.0.0')).toBe('2.0.0');
      expect(extractVersion('Release Version', '### RELEASE VERSION 3.0.1')).toBe('3.0.1');
    });

    it('returns undefined when pattern not found', () => {
      expect(extractVersion('Release Version', 'No version here')).toBeUndefined();
      expect(extractVersion('Other', '### Release Version 1.2.3')).toBeUndefined();
    });

    it('returns undefined when version format is invalid', () => {
      expect(extractVersion('Release Version', '### Release Version 1.2')).toBeUndefined();
      expect(extractVersion('Release Version', '### Release Version abc')).toBeUndefined();
    });

    it('escapes regex-special chars in pattern (no ReDoS or over-matching)', () => {
      expect(extractVersion('Release (Version)', '### Release (Version) 1.2.3')).toBe('1.2.3');
      expect(extractVersion('.*', '### .* 1.2.3')).toBe('1.2.3');
      expect(extractVersion('.*', '### x 1.2.3')).toBeUndefined();
      expect(extractVersion('x.y', '### x.y 9.8.7')).toBe('9.8.7');
    });
  });

  describe('extractReleaseType', () => {
    it('extracts Patch, Minor, Major', () => {
      expect(extractReleaseType('Release Type', '### Release Type Patch')).toBe('Patch');
      expect(extractReleaseType('Release Type', '### Release Type Minor')).toBe('Minor');
      expect(extractReleaseType('Release Type', '### Release Type Major')).toBe('Major');
    });

    it('matches release type in text (returns as written in text)', () => {
      expect(extractReleaseType('Release Type', '### release type major')).toBe('major');
      expect(extractReleaseType('Release Type', '### Release Type Patch')).toBe('Patch');
    });

    it('returns undefined when pattern not found', () => {
      expect(extractReleaseType('Release Type', 'No type here')).toBeUndefined();
      expect(extractReleaseType('Other', '### Release Type Patch')).toBeUndefined();
    });

    it('escapes regex-special chars in pattern', () => {
      expect(extractReleaseType('Release (Type)', '### Release (Type) Minor')).toBe('Minor');
      expect(extractReleaseType('Patch|Minor', '### Patch|Minor Major')).toBe('Major');
    });
  });

  describe('extractChangelogUpToAdditionalContext', () => {
    it('extracts content from Changelog section up to Additional Context', () => {
      const body = [
        '### Changelog',
        '',
        '## OpenCode as AI backend',
        '',
        '- **All AI features** now use **OpenCode**.',
        '',
        '### Additional Context',
        '',
        'Anything else to note?',
      ].join('\n');
      expect(extractChangelogUpToAdditionalContext(body, 'Changelog')).toBe(
        '## OpenCode as AI backend\n\n- **All AI features** now use **OpenCode**.',
      );
    });

    it('extracts content from Hotfix Solution section up to Additional Context', () => {
      const body = [
        '### Hotfix Solution',
        '',
        'Describe the solution.',
        'Multiple lines.',
        '',
        '### Additional Context',
        '',
        'Extra notes.',
      ].join('\n');
      expect(extractChangelogUpToAdditionalContext(body, 'Hotfix Solution')).toBe(
        'Describe the solution.\nMultiple lines.',
      );
    });

    it('returns full content when Additional Context is absent', () => {
      const body = '### Changelog\n\nOnly section here.';
      expect(extractChangelogUpToAdditionalContext(body, 'Changelog')).toBe('Only section here.');
    });

    it('handles ## style headings', () => {
      const body = '## Changelog\n\nContent here.\n\n## Additional Context\n\nOther.';
      expect(extractChangelogUpToAdditionalContext(body, 'Changelog')).toBe('Content here.');
    });

    it('returns default when body is null or empty', () => {
      expect(extractChangelogUpToAdditionalContext(null, 'Changelog')).toBe('No changelog provided');
      expect(extractChangelogUpToAdditionalContext(undefined, 'Changelog')).toBe('No changelog provided');
      expect(extractChangelogUpToAdditionalContext('', 'Changelog')).toBe('No changelog provided');
    });

    it('returns default when section is not found', () => {
      expect(extractChangelogUpToAdditionalContext('### Other\n\nText.', 'Changelog')).toBe('No changelog provided');
    });
  });

  describe('injectJsonAsMarkdownBlock', () => {
    it('wraps JSON with title and blockquote-style markdown', () => {
      const result = injectJsonAsMarkdownBlock('Config', { foo: 'bar' });
      expect(result).toContain('> **Config**');
      expect(result).toContain('> ```json');
      expect(result).toContain('"foo": "bar"');
      expect(result).toContain('> ```');
    });

    it('pretty-prints JSON with 4 spaces', () => {
      const result = injectJsonAsMarkdownBlock('Data', { a: 1, b: 2 });
      expect(result).toMatch(/>\s*{\s*\n/);
      expect(result).toContain('"a": 1');
      expect(result).toContain('"b": 2');
    });

    it('handles nested objects', () => {
      const result = injectJsonAsMarkdownBlock('Nested', { outer: { inner: true } });
      expect(result).toContain('"outer"');
      expect(result).toContain('"inner": true');
    });
  });
});

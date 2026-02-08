import {
  extractVersion,
  extractReleaseType,
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

import { getRandomElement } from '../list_utils';

describe('list_utils', () => {
  describe('getRandomElement', () => {
    it('returns undefined for empty array', () => {
      expect(getRandomElement([])).toBeUndefined();
    });

    it('returns undefined for null/undefined list', () => {
      expect(getRandomElement(null as unknown as string[])).toBeUndefined();
      expect(getRandomElement(undefined as unknown as string[])).toBeUndefined();
    });

    it('returns the only element for single-element array', () => {
      expect(getRandomElement([42])).toBe(42);
      expect(getRandomElement(['only'])).toBe('only');
    });

    it('returns an element that is in the list', () => {
      const list = [1, 2, 3];
      for (let i = 0; i < 50; i++) {
        const el = getRandomElement(list);
        expect(list).toContain(el);
      }
    });

    it('returns one of the elements for multi-element list', () => {
      const list = ['a', 'b', 'c'];
      const results = new Set<string>();
      for (let i = 0; i < 100; i++) {
        results.add(getRandomElement(list)!);
      }
      expect(results.size).toBeGreaterThanOrEqual(1);
      expect(results.size).toBeLessThanOrEqual(3);
      results.forEach((r) => expect(list).toContain(r));
    });
  });
});

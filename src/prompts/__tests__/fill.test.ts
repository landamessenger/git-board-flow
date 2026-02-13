import { fillTemplate } from '../fill';

describe('fillTemplate', () => {
    it('replaces all placeholders with params', () => {
        const out = fillTemplate('Hello {{name}}, you have {{count}} items.', {
            name: 'Alice',
            count: '3',
        });
        expect(out).toBe('Hello Alice, you have 3 items.');
    });

    it('leaves missing keys as placeholder', () => {
        const out = fillTemplate('{{a}} and {{b}}', { a: '1' });
        expect(out).toBe('1 and {{b}}');
    });

    it('handles empty params', () => {
        const out = fillTemplate('{{x}}', {});
        expect(out).toBe('{{x}}');
    });
});

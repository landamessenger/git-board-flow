import { getThinkPrompt } from '../think';

describe('getThinkPrompt', () => {
    it('fills projectContextInstruction, contextBlock and question', () => {
        const prompt = getThinkPrompt({
            projectContextInstruction: '**Use context.**',
            contextBlock: '\n\nContext (issue #1):\nFix the bug.\n\n',
            question: 'what is 2+2?',
        });
        expect(prompt).toContain('helpful assistant');
        expect(prompt).toContain('**Use context.**');
        expect(prompt).toContain('Context (issue #1):');
        expect(prompt).toContain('Fix the bug.');
        expect(prompt).toContain('Question: what is 2+2?');
        expect(prompt).not.toContain('{{');
    });

    it('allows empty contextBlock', () => {
        const prompt = getThinkPrompt({
            projectContextInstruction: 'X',
            contextBlock: '\n\n',
            question: 'q',
        });
        expect(prompt).toContain('Question: q');
        expect(prompt).not.toContain('{{');
    });
});

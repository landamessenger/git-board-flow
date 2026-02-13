import { getCliDoPrompt } from '../cli_do';

describe('getCliDoPrompt', () => {
    it('fills projectContextInstruction and userPrompt', () => {
        const prompt = getCliDoPrompt({
            projectContextInstruction: '**Read the repo.**',
            userPrompt: 'Refactor module X',
        });
        expect(prompt).toContain('**Read the repo.**');
        expect(prompt).toContain('Refactor module X');
        expect(prompt).not.toContain('{{');
    });
});

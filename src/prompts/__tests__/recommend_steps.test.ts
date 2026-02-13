import { getRecommendStepsPrompt } from '../recommend_steps';

describe('getRecommendStepsPrompt', () => {
    it('fills issue number and description', () => {
        const prompt = getRecommendStepsPrompt({
            projectContextInstruction: '**Use project.**',
            issueNumber: '7',
            issueDescription: 'Implement OAuth flow.',
        });
        expect(prompt).toContain('**Use project.**');
        expect(prompt).toContain('Issue #7');
        expect(prompt).toContain('Implement OAuth flow.');
        expect(prompt).toContain('recommend concrete steps');
        expect(prompt).not.toContain('{{');
    });
});

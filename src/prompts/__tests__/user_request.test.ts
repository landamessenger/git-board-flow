import { getUserRequestPrompt } from '../user_request';

describe('getUserRequestPrompt', () => {
    it('fills repository context and user comment', () => {
        const prompt = getUserRequestPrompt({
            projectContextInstruction: '**Context.**',
            owner: 'my-org',
            repo: 'my-repo',
            headBranch: 'feature/x',
            baseBranch: 'develop',
            issueNumber: '10',
            userComment: 'add a unit test for foo',
        });
        expect(prompt).toContain('**Context.**');
        expect(prompt).toContain('my-org');
        expect(prompt).toContain('my-repo');
        expect(prompt).toContain('feature/x');
        expect(prompt).toContain('develop');
        expect(prompt).toContain('10');
        expect(prompt).toContain('add a unit test for foo');
        expect(prompt).toContain('Apply all changes directly');
        expect(prompt).not.toContain('{{');
    });
});

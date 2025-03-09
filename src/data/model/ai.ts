export class Ai {
    private openaiApiKey: string;
    private aiPullRequestDescription: boolean;
    private aiMembersOnly: boolean;

    constructor(openaiApiKey: string, aiPullRequestDescription: boolean, aiMembersOnly: boolean) {
        this.openaiApiKey = openaiApiKey;
        this.aiPullRequestDescription = aiPullRequestDescription;
        this.aiMembersOnly = aiMembersOnly;
    }

    getOpenaiApiKey(): string {
        return this.openaiApiKey;
    }

    getAiPullRequestDescription(): boolean {
        return this.aiPullRequestDescription;
    }

    getAiMembersOnly(): boolean {
        return this.aiMembersOnly;
    }
}

export class Ai {
    private openaiApiKey: string;
    private aiPullRequestDescription: boolean;

    constructor(openaiApiKey: string, aiPullRequestDescription: boolean) {
        this.openaiApiKey = openaiApiKey;
        this.aiPullRequestDescription = aiPullRequestDescription;
    }

    getOpenaiApiKey(): string {
        return this.openaiApiKey;
    }

    getAiPullRequestDescription(): boolean {
        return this.aiPullRequestDescription;
    }
}

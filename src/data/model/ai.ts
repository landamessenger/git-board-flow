export class Ai {
    private openaiApiKey: string;
    private aiPullRequestDescription: boolean;
    private aiMembersOnly: boolean;
    private aiIgnoreFiles: string[];

    constructor(openaiApiKey: string, aiPullRequestDescription: boolean, aiMembersOnly: boolean, aiIgnoreFiles: string[]) {
        this.openaiApiKey = openaiApiKey;
        this.aiPullRequestDescription = aiPullRequestDescription;
        this.aiMembersOnly = aiMembersOnly;
        this.aiIgnoreFiles = aiIgnoreFiles;
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

    getAiIgnoreFiles(): string[] {
        return this.aiIgnoreFiles;
    }
}

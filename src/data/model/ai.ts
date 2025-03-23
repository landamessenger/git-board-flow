export class Ai {
    private openaiApiKey: string;
    private openaiModel: string;
    private aiPullRequestDescription: boolean;
    private aiMembersOnly: boolean;
    private aiIgnoreFiles: string[];

    constructor(openaiApiKey: string, openaiModel: string, aiPullRequestDescription: boolean, aiMembersOnly: boolean, aiIgnoreFiles: string[]) {
        this.openaiApiKey = openaiApiKey;
        this.openaiModel = openaiModel;
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

    getOpenaiModel(): string {
        return this.openaiModel;
    }
}

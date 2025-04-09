export class Ai {
    private openRouterApiKey: string;
    private openRouterModel: string;
    private openRouterProvider: string;
    private aiPullRequestDescription: boolean;
    private aiMembersOnly: boolean;
    private aiIgnoreFiles: string[];

    constructor(openRouterApiKey: string, openRouterProvider: string, openRouterModel: string, aiPullRequestDescription: boolean, aiMembersOnly: boolean, aiIgnoreFiles: string[]) {
        this.openRouterApiKey = openRouterApiKey;
        this.openRouterModel = openRouterModel;
        this.openRouterProvider = openRouterProvider;
        this.aiPullRequestDescription = aiPullRequestDescription;
        this.aiMembersOnly = aiMembersOnly;
        this.aiIgnoreFiles = aiIgnoreFiles;
    }

    getOpenRouterApiKey(): string {
        return this.openRouterApiKey;
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

    getOpenRouterProvider(): string {
        return this.openRouterProvider;
    }

    getOpenRouterModel(): string {
        return this.openRouterModel;
    }
}

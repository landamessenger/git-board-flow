/**
 * AI configuration for OpenCode-backed analysis.
 * OpenCode supports 75+ LLM providers (Anthropic, OpenAI, Gemini, local models, etc.).
 * API keys are configured on the OpenCode server, not here.
 */
export class Ai {
    private opencodeServerUrl: string;
    private opencodeModel: string;
    private aiPullRequestDescription: boolean;
    private aiMembersOnly: boolean;
    private aiIgnoreFiles: string[];
    private aiIncludeReasoning: boolean;

    constructor(
        opencodeServerUrl: string,
        opencodeModel: string,
        aiPullRequestDescription: boolean,
        aiMembersOnly: boolean,
        aiIgnoreFiles: string[],
        aiIncludeReasoning: boolean
    ) {
        this.opencodeServerUrl = opencodeServerUrl;
        this.opencodeModel = opencodeModel;
        this.aiPullRequestDescription = aiPullRequestDescription;
        this.aiMembersOnly = aiMembersOnly;
        this.aiIgnoreFiles = aiIgnoreFiles;
        this.aiIncludeReasoning = aiIncludeReasoning;
    }

    getOpencodeServerUrl(): string {
        return this.opencodeServerUrl;
    }

    getOpencodeModel(): string {
        return this.opencodeModel;
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

    getAiIncludeReasoning(): boolean {
        return this.aiIncludeReasoning;
    }

    /**
     * Parse "provider/model-id" into { providerID, modelID } for OpenCode session.prompt.
     */
    getOpencodeModelParts(): { providerID: string; modelID: string } {
        const model = this.opencodeModel.trim();
        const slash = model.indexOf('/');
        if (slash <= 0) {
            return { providerID: 'openai', modelID: model || 'gpt-4o-mini' };
        }
        return {
            providerID: model.slice(0, slash).trim(),
            modelID: model.slice(slash + 1).trim(),
        };
    }
}

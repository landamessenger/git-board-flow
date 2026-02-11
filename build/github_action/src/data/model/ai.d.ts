/**
 * AI configuration for OpenCode-backed analysis.
 * OpenCode supports 75+ LLM providers (Anthropic, OpenAI, Gemini, local models, etc.).
 * API keys are configured on the OpenCode server, not here.
 */
export declare class Ai {
    private opencodeServerUrl;
    private opencodeModel;
    private aiPullRequestDescription;
    private aiMembersOnly;
    private aiIgnoreFiles;
    private aiIncludeReasoning;
    private bugbotMinSeverity;
    private bugbotCommentLimit;
    constructor(opencodeServerUrl: string, opencodeModel: string, aiPullRequestDescription: boolean, aiMembersOnly: boolean, aiIgnoreFiles: string[], aiIncludeReasoning: boolean, bugbotMinSeverity: string, bugbotCommentLimit: number);
    getOpencodeServerUrl(): string;
    getOpencodeModel(): string;
    getAiPullRequestDescription(): boolean;
    getAiMembersOnly(): boolean;
    getAiIgnoreFiles(): string[];
    getAiIncludeReasoning(): boolean;
    getBugbotMinSeverity(): string;
    getBugbotCommentLimit(): number;
    /**
     * Parse "provider/model-id" into { providerID, modelID } for OpenCode session.prompt.
     * Uses OPENCODE_DEFAULT_MODEL when no model is set (e.g. opencode/kimi-k2.5-free).
     */
    getOpencodeModelParts(): {
        providerID: string;
        modelID: string;
    };
}

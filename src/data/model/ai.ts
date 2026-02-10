import { OPENCODE_DEFAULT_MODEL } from '../../utils/constants';

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
    private bugbotMinSeverity: string;

    constructor(
        opencodeServerUrl: string,
        opencodeModel: string,
        aiPullRequestDescription: boolean,
        aiMembersOnly: boolean,
        aiIgnoreFiles: string[],
        aiIncludeReasoning: boolean,
        bugbotMinSeverity: string
    ) {
        this.opencodeServerUrl = opencodeServerUrl;
        this.opencodeModel = opencodeModel;
        this.aiPullRequestDescription = aiPullRequestDescription;
        this.aiMembersOnly = aiMembersOnly;
        this.aiIgnoreFiles = aiIgnoreFiles;
        this.aiIncludeReasoning = aiIncludeReasoning;
        this.bugbotMinSeverity = bugbotMinSeverity;
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

    getBugbotMinSeverity(): string {
        return this.bugbotMinSeverity;
    }

    /**
     * Parse "provider/model-id" into { providerID, modelID } for OpenCode session.prompt.
     * Uses OPENCODE_DEFAULT_MODEL when no model is set (e.g. opencode/kimi-k2.5-free).
     */
    getOpencodeModelParts(): { providerID: string; modelID: string } {
        const effective = (this.opencodeModel || OPENCODE_DEFAULT_MODEL).trim();
        const slash = effective.indexOf('/');
        if (slash <= 0) {
            return { providerID: 'opencode', modelID: effective || (OPENCODE_DEFAULT_MODEL.split('/')[1] ?? 'kimi-k2.5-free') };
        }
        const providerID = effective.slice(0, slash).trim();
        const modelID = effective.slice(slash + 1).trim();
        const defaultModelId = OPENCODE_DEFAULT_MODEL.split('/')[1] ?? 'kimi-k2.5-free';
        return {
            providerID: providerID || 'opencode',
            modelID: modelID || defaultModelId,
        };
    }
}

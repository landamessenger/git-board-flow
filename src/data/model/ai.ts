export interface ProviderRoutingConfig {
    order?: string[];
    allow_fallbacks?: boolean;
    require_parameters?: boolean;
    data_collection?: 'allow' | 'deny';
    ignore?: string[];
    quantizations?: string[];
    sort?: 'price' | 'throughput' | 'latency';
}

export class Ai {
    private openRouterApiKey: string;
    private openRouterModel: string;
    private aiPullRequestDescription: boolean;
    private aiMembersOnly: boolean;
    private aiIgnoreFiles: string[];
    private aiIncludeReasoning: boolean;
    private providerRouting: ProviderRoutingConfig;

    constructor(
        openRouterApiKey: string, 
        openRouterModel: string, 
        aiPullRequestDescription: boolean, 
        aiMembersOnly: boolean, 
        aiIgnoreFiles: string[],
        aiIncludeReasoning: boolean,
        providerRouting?: ProviderRoutingConfig
    ) {
        this.openRouterApiKey = openRouterApiKey;
        this.openRouterModel = openRouterModel;
        this.aiPullRequestDescription = aiPullRequestDescription;
        this.aiMembersOnly = aiMembersOnly;
        this.aiIgnoreFiles = aiIgnoreFiles;
        this.aiIncludeReasoning = aiIncludeReasoning;
        this.providerRouting = providerRouting || {};
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

    getAiIncludeReasoning(): boolean {
        return this.aiIncludeReasoning;
    }

    getOpenRouterModel(): string {
        return this.openRouterModel;
    }

    getProviderRouting(): ProviderRoutingConfig {
        return this.providerRouting;
    }
}

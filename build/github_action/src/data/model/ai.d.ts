export interface ProviderRoutingConfig {
    order?: string[];
    allow_fallbacks?: boolean;
    require_parameters?: boolean;
    data_collection?: 'allow' | 'deny';
    ignore?: string[];
    quantizations?: string[];
    sort?: 'price' | 'throughput' | 'latency';
}
export declare class Ai {
    private openRouterApiKey;
    private openRouterModel;
    private aiPullRequestDescription;
    private aiMembersOnly;
    private aiIgnoreFiles;
    private aiIncludeReasoning;
    private providerRouting;
    constructor(openRouterApiKey: string, openRouterModel: string, aiPullRequestDescription: boolean, aiMembersOnly: boolean, aiIgnoreFiles: string[], aiIncludeReasoning: boolean, providerRouting?: ProviderRoutingConfig);
    getOpenRouterApiKey(): string;
    getAiPullRequestDescription(): boolean;
    getAiMembersOnly(): boolean;
    getAiIgnoreFiles(): string[];
    getAiIncludeReasoning(): boolean;
    getOpenRouterModel(): string;
    getProviderRouting(): ProviderRoutingConfig;
}

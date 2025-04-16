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
    private providerRouting;
    constructor(openRouterApiKey: string, openRouterModel: string, aiPullRequestDescription: boolean, aiMembersOnly: boolean, aiIgnoreFiles: string[], providerRouting?: ProviderRoutingConfig);
    getOpenRouterApiKey(): string;
    getAiPullRequestDescription(): boolean;
    getAiMembersOnly(): boolean;
    getAiIgnoreFiles(): string[];
    getOpenRouterModel(): string;
    getProviderRouting(): ProviderRoutingConfig;
}

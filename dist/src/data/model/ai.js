"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Ai = void 0;
class Ai {
    constructor(openRouterApiKey, openRouterModel, aiPullRequestDescription, aiMembersOnly, aiIgnoreFiles, aiIncludeReasoning, providerRouting) {
        this.openRouterApiKey = openRouterApiKey;
        this.openRouterModel = openRouterModel;
        this.aiPullRequestDescription = aiPullRequestDescription;
        this.aiMembersOnly = aiMembersOnly;
        this.aiIgnoreFiles = aiIgnoreFiles;
        this.aiIncludeReasoning = aiIncludeReasoning;
        this.providerRouting = providerRouting || {};
    }
    getOpenRouterApiKey() {
        return this.openRouterApiKey;
    }
    getAiPullRequestDescription() {
        return this.aiPullRequestDescription;
    }
    getAiMembersOnly() {
        return this.aiMembersOnly;
    }
    getAiIgnoreFiles() {
        return this.aiIgnoreFiles;
    }
    getAiIncludeReasoning() {
        return this.aiIncludeReasoning;
    }
    getOpenRouterModel() {
        return this.openRouterModel;
    }
    getProviderRouting() {
        return this.providerRouting;
    }
}
exports.Ai = Ai;

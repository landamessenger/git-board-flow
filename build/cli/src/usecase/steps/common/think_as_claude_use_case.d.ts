import { Execution } from '../../../data/model/execution';
import { Result } from '../../../data/model/result';
import { ParamUseCase } from '../../base/param_usecase';
/**
 * ThinkUseCase implementation for Anthropic Claude models using the Agent SDK
 *
 * This use case leverages the Anthropic Agent SDK for automatic reasoning,
 * context management, and tool ecosystem, while maintaining domain-specific
 * logic like virtual codebase, TODOs, and GitHub integration.
 *
 * NOTE: Currently uses ThinkUseCase as fallback until Agent SDK is fully integrated.
 */
export declare class ThinkAsClaudeUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string;
    private fileRepository;
    private issueRepository;
    private fileSearchService;
    private commentFormatter;
    invoke(param: Execution): Promise<Result[]>;
    /**
     * Build simple file list context (no AI calls, just metadata)
     * This is much cheaper than doing expensive pre-analysis
     */
    private buildSimpleFileListContext;
    /**
     * Group files by directory for simple context
     */
    private groupFilesByDirectory;
    /**
     * Execute reasoning using Anthropic Agent SDK
     *
     * This method integrates with the Agent SDK to handle automatic reasoning,
     * while maintaining our domain-specific logic (virtual codebase, TODOs, etc.)
     */
    private executeWithAgentSDK;
    private getIssueDescription;
    /**
     * Build a summary from steps when Agent SDK doesn't provide final analysis
     * This avoids using OpenRouter (aiRepository) and keeps everything consistent with Agent SDK
     */
    private buildSummaryFromSteps;
    /**
     * Normalize model name to Anthropic format
     *
     * Accepts various formats and converts them to Anthropic's expected format:
     * - "anthropic/claude-3.5-haiku" → "claude-3-5-haiku-latest"
     * - "claude-3.5-haiku" → "claude-3-5-haiku-latest"
     * - "claude-3-5-haiku" → "claude-3-5-haiku-latest"
     * - "claude-3-5-haiku-latest" → "claude-3-5-haiku-latest" (no change)
     * - "claude-3-5-haiku-20241022" → "claude-3-5-haiku-20241022" (specific version, no change)
     *
     * Model names supported:
     * - claude-3-5-haiku-latest / claude-3-5-haiku-20241022
     * - claude-3-5-sonnet-latest / claude-3-5-sonnet-20241022
     * - claude-3-opus-latest / claude-3-opus-20240229
     * - claude-3-sonnet-latest / claude-3-sonnet-20240229
     * - claude-3-haiku-latest / claude-3-haiku-20240307
     */
    private normalizeModelName;
    /**
     * Fallback method that uses standard ThinkUseCase logic
     * This is used when Agent SDK is not yet implemented
     *
     * NOTE: This creates a temporary Execution object with a modified model name
     * to bypass Claude detection and prevent infinite recursion.
     */
    private useStandardLogicAsFallback;
}

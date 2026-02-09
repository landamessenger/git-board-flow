import { Ai } from '../model/ai';
/** Default OpenCode agent for analysis/planning (read-only, no file edits). */
export declare const OPENCODE_AGENT_PLAN = "plan";
/** OpenCode agent with write/edit/bash for development (e.g. copilot when run locally). */
export declare const OPENCODE_AGENT_BUILD = "build";
/** JSON schema for translation responses: translatedText (required), optional reason if translation failed. */
export declare const TRANSLATION_RESPONSE_SCHEMA: {
    readonly type: "object";
    readonly properties: {
        readonly translatedText: {
            readonly type: "string";
            readonly description: "The text translated to the requested locale. Required. Must not be empty.";
        };
        readonly reason: {
            readonly type: "string";
            readonly description: "Optional: reason why translation could not be produced or was partial (e.g. ambiguous input).";
        };
    };
    readonly required: readonly ["translatedText"];
    readonly additionalProperties: false;
};
export interface AskAgentOptions {
    /** Request JSON response and parse it. If schema provided, include it in the prompt. */
    expectJson?: boolean;
    /** JSON schema for the response (used when expectJson is true to guide the model). */
    schema?: Record<string, unknown>;
    schemaName?: string;
    /** When true, include OpenCode agent reasoning (type "reasoning" parts) in the returned object as "reasoning". */
    includeReasoning?: boolean;
}
/** File diff from OpenCode GET /session/:id/diff */
export interface OpenCodeFileDiff {
    path?: string;
    file?: string;
    [key: string]: unknown;
}
/**
 * Get the diff for an OpenCode session (files changed by the agent).
 * Call after opencodeMessageWithAgent when using the "build" agent so the user can see what was edited.
 * Wrapped with retries (OPENCODE_MAX_RETRIES).
 */
export declare function getSessionDiff(baseUrl: string, sessionId: string): Promise<OpenCodeFileDiff[]>;
export declare class AiRepository {
    ask: (ai: Ai, prompt: string) => Promise<string | undefined>;
    /**
     * Ask an OpenCode agent (e.g. Plan) to perform a task. The server runs the full agent loop.
     * Returns the final message (including reasoning in parts when includeReasoning is true).
     * @param ai - AI config (server URL, model)
     * @param agentId - OpenCode agent id (e.g. OPENCODE_AGENT_PLAN)
     * @param prompt - User prompt
     * @param options - expectJson, schema, includeReasoning
     * @returns Response text, or parsed JSON when expectJson is true
     */
    askAgent: (ai: Ai, agentId: string, prompt: string, options?: AskAgentOptions) => Promise<string | Record<string, unknown> | undefined>;
    /**
     * Run the OpenCode "build" agent for the copilot command. Returns the final message and sessionId.
     */
    copilotMessage: (ai: Ai, prompt: string) => Promise<{
        text: string;
        sessionId: string;
    } | undefined>;
}

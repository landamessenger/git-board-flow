import { Ai } from '../model/ai';
/** One session entry from OpenCode GET /session/status. */
export interface OpenCodeSessionStatusEntry {
    type: string;
    attempt?: number;
    message?: string;
    next?: number;
}
/** Status response: session id -> status entry. */
export type OpenCodeSessionStatusMap = Record<string, OpenCodeSessionStatusEntry>;
export interface OpenCodeStatusSummary {
    counts: {
        idle: number;
        busy: number;
        retry: number;
    };
    hasRateLimit: boolean;
    retryMessages: string[];
}
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
/** JSON schema for Think (Q&A) responses: single answer field. */
export declare const THINK_RESPONSE_SCHEMA: {
    readonly type: "object";
    readonly properties: {
        readonly answer: {
            readonly type: "string";
            readonly description: "The concise answer to the user question. Required.";
        };
    };
    readonly required: readonly ["answer"];
    readonly additionalProperties: false;
};
/** JSON schema for language check: done (already in locale) or must_translate. */
export declare const LANGUAGE_CHECK_RESPONSE_SCHEMA: {
    readonly type: "object";
    readonly properties: {
        readonly status: {
            readonly type: "string";
            readonly enum: readonly ["done", "must_translate"];
            readonly description: "done if text is in the requested locale, must_translate otherwise.";
        };
    };
    readonly required: readonly ["status"];
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
    /**
     * Ask an OpenCode agent (e.g. Plan) to perform a task. All calls use strict response (expectJson + schema).
     * Single retry system: HTTP failures and parse failures both retry up to OPENCODE_MAX_RETRIES.
     */
    askAgent: (ai: Ai, agentId: string, prompt: string, options?: AskAgentOptions) => Promise<string | Record<string, unknown> | undefined>;
    /**
     * Run the OpenCode "build" agent for the copilot command. Returns the final message and sessionId.
     * Uses the same retry system (OPENCODE_MAX_RETRIES).
     */
    copilotMessage: (ai: Ai, prompt: string) => Promise<{
        text: string;
        sessionId: string;
    } | undefined>;
}

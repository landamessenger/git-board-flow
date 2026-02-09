import { Ai } from '../model/ai';
/** Default OpenCode agent for analysis/planning (read-only, no file edits). */
export declare const OPENCODE_AGENT_PLAN = "plan";
/** OpenCode agent with write/edit/bash for development (e.g. copilot when run locally). */
export declare const OPENCODE_AGENT_BUILD = "build";
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
 */
export declare function getSessionDiff(baseUrl: string, sessionId: string): Promise<OpenCodeFileDiff[]>;
export declare class AiRepository {
    ask: (ai: Ai, prompt: string) => Promise<string | undefined>;
    /**
     * Ask an OpenCode agent (e.g. Plan) to perform a task. The server runs the full agent loop.
     * Use for: PR description, progress, error detection, recommend steps.
     * @param ai - AI config (server URL, model)
     * @param agentId - OpenCode agent id (e.g. OPENCODE_AGENT_PLAN)
     * @param prompt - User prompt
     * @param options - expectJson: parse response as JSON; schema/schemaName: optional guidance for JSON shape
     * @returns Response text, or parsed JSON when expectJson is true
     */
    askAgent: (ai: Ai, agentId: string, prompt: string, options?: AskAgentOptions) => Promise<string | Record<string, unknown> | undefined>;
    /**
     * Run the OpenCode "build" agent for the copilot command. The build agent can read and write
     * files when the OpenCode server is run locally with the project as workspace (e.g. opencode serve
     * from the repo). Returns the assistant text and sessionId so the CLI can optionally fetch the session diff.
     */
    copilotMessage: (ai: Ai, prompt: string) => Promise<{
        text: string;
        sessionId: string;
    } | undefined>;
}

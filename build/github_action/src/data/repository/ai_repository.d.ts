import { Ai } from '../model/ai';
/** Default OpenCode agent for analysis/planning (read-only, no file edits). */
export declare const OPENCODE_AGENT_PLAN = "plan";
export interface AskAgentOptions {
    /** Request JSON response and parse it. If schema provided, include it in the prompt. */
    expectJson?: boolean;
    /** JSON schema for the response (used when expectJson is true to guide the model). */
    schema?: Record<string, unknown>;
    schemaName?: string;
}
export declare class AiRepository {
    ask: (ai: Ai, prompt: string) => Promise<string | undefined>;
    askJson: (ai: Ai, prompt: string, schema?: any, schemaName?: string, streaming?: boolean, onChunk?: (chunk: string) => void, strict?: boolean) => Promise<any | undefined>;
    askThinkJson: (ai: Ai, messagesOrPrompt: Array<{
        role: "system" | "user" | "assistant";
        content: string;
    }> | string) => Promise<any | undefined>;
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
}

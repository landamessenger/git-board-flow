import { OPENCODE_REQUEST_TIMEOUT_MS } from '../../utils/constants';
import { logDebugInfo, logError } from '../../utils/logger';
import { Ai } from '../model/ai';

function createTimeoutSignal(ms: number): AbortSignal {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new Error(`OpenCode request timeout after ${ms}ms`)), ms);
    return controller.signal;
}

function ensureNoTrailingSlash(url: string): string {
    return url.replace(/\/+$/, '') || url;
}

const OPENCODE_RESPONSE_LOG_MAX_LEN = 2000;

/** Parse response as JSON; on empty or invalid body throw a clear error with context. */
async function parseJsonResponse<T>(res: Response, context: string): Promise<T> {
    const raw = await res.text();
    const truncated =
        raw.length > OPENCODE_RESPONSE_LOG_MAX_LEN
            ? `${raw.slice(0, OPENCODE_RESPONSE_LOG_MAX_LEN)}... [truncated, total ${raw.length} chars]`
            : raw;
    logDebugInfo(`OpenCode response [${context}] status=${res.status} bodyLength=${raw.length}: ${truncated}`);
    if (!raw || !raw.trim()) {
        throw new Error(
            `${context}: empty response body (status ${res.status}). The server may have returned nothing or closed the connection early.`
        );
    }
    try {
        return JSON.parse(raw) as T;
    } catch (parseError) {
        const snippet = raw.length > 200 ? `${raw.slice(0, 200)}...` : raw;
        const err = new Error(
            `${context}: invalid JSON (status ${res.status}). Body snippet: ${snippet}`
        );
        if (parseError instanceof Error && 'cause' in err) (err as Error & { cause: unknown }).cause = parseError;
        throw err;
    }
}

/**
 * Extract plain text from OpenCode message response parts (type === 'text').
 */
function extractTextFromParts(parts: unknown): string {
    if (!Array.isArray(parts)) return '';
    return (parts as Array<{ type?: string; text?: string }>)
        .filter((p) => p?.type === 'text' && typeof p.text === 'string')
        .map((p) => p.text as string)
        .join('');
}

/**
 * Extract reasoning text from OpenCode message response parts (type === 'reasoning').
 * Used to include the agent's full reasoning in comments (e.g. progress detection).
 */
function extractReasoningFromParts(parts: unknown): string {
    if (!Array.isArray(parts)) return '';
    return (parts as Array<{ type?: string; text?: string }>)
        .filter((p) => p?.type === 'reasoning' && typeof p.text === 'string')
        .map((p) => p.text as string)
        .join('\n\n')
        .trim();
}

/** Default OpenCode agent for analysis/planning (read-only, no file edits). */
export const OPENCODE_AGENT_PLAN = 'plan';

/** OpenCode agent with write/edit/bash for development (e.g. copilot when run locally). */
export const OPENCODE_AGENT_BUILD = 'build';

/**
 * OpenCode HTTP API: create session and send message, return assistant parts.
 * Uses fetch to avoid ESM-only SDK with ncc.
 */
async function opencodePrompt(
    baseUrl: string,
    providerID: string,
    modelID: string,
    promptText: string
): Promise<string> {
    const base = ensureNoTrailingSlash(baseUrl);
    const signal = createTimeoutSignal(OPENCODE_REQUEST_TIMEOUT_MS);
    const createRes = await fetch(`${base}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'gbf' }),
        signal,
    });
    if (!createRes.ok) {
        const err = await createRes.text();
        throw new Error(`OpenCode session create failed: ${createRes.status} ${err}`);
    }
    const session = await parseJsonResponse<{ id?: string; data?: { id?: string } }>(
        createRes,
        'OpenCode session.create'
    );
    const sessionId = session?.id ?? session?.data?.id;
    if (!sessionId) {
        throw new Error('OpenCode session.create did not return session id');
    }
    const messageRes = await fetch(`${base}/session/${sessionId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: { providerID, modelID },
            parts: [{ type: 'text', text: promptText }],
        }),
        signal,
    });
    if (!messageRes.ok) {
        const err = await messageRes.text();
        throw new Error(`OpenCode message failed: ${messageRes.status} ${err}`);
    }
    const messageData = await parseJsonResponse<{ parts?: unknown[]; data?: { parts?: unknown[] } }>(
        messageRes,
        'OpenCode message'
    );
    const parts = messageData?.parts ?? messageData?.data?.parts ?? [];
    return extractTextFromParts(parts);
}

export interface AskAgentOptions {
    /** Request JSON response and parse it. If schema provided, include it in the prompt. */
    expectJson?: boolean;
    /** JSON schema for the response (used when expectJson is true to guide the model). */
    schema?: Record<string, unknown>;
    schemaName?: string;
    /** When true, include OpenCode agent reasoning (type "reasoning" parts) in the returned object as "reasoning". */
    includeReasoning?: boolean;
}

interface OpenCodeAgentMessageResult {
    text: string;
    parts: unknown[];
    sessionId: string;
}

/**
 * Send a message to an OpenCode agent (e.g. "plan", "build") and wait for the full response.
 * The server runs the agent loop (tools, etc.) and returns when done.
 * Use this to delegate PR description, progress, error detection, recommendations, or copilot (build) to OpenCode.
 */
async function opencodeMessageWithAgent(
    baseUrl: string,
    options: {
        providerID: string;
        modelID: string;
        agent: string;
        promptText: string;
    }
): Promise<OpenCodeAgentMessageResult> {
    const base = ensureNoTrailingSlash(baseUrl);
    const signal = createTimeoutSignal(OPENCODE_REQUEST_TIMEOUT_MS);
    const createRes = await fetch(`${base}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'gbf' }),
        signal,
    });
    if (!createRes.ok) {
        const err = await createRes.text();
        throw new Error(`OpenCode session create failed: ${createRes.status} ${err}`);
    }
    const session = await parseJsonResponse<{ id?: string; data?: { id?: string } }>(
        createRes,
        'OpenCode session.create'
    );
    const sessionId = session?.id ?? session?.data?.id;
    if (!sessionId) {
        throw new Error('OpenCode session.create did not return session id');
    }
    const body: Record<string, unknown> = {
        agent: options.agent,
        model: { providerID: options.providerID, modelID: options.modelID },
        parts: [{ type: 'text', text: options.promptText }],
    };
    const messageRes = await fetch(`${base}/session/${sessionId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
    });
    if (!messageRes.ok) {
        const err = await messageRes.text();
        throw new Error(`OpenCode message failed (agent=${options.agent}): ${messageRes.status} ${err}`);
    }
    const messageData = await parseJsonResponse<{ parts?: unknown[]; data?: { parts?: unknown[] } }>(
        messageRes,
        `OpenCode agent "${options.agent}" message`
    );
    const parts = messageData?.parts ?? messageData?.data?.parts ?? [];
    const text = extractTextFromParts(parts);
    return { text, parts, sessionId };
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
export async function getSessionDiff(
    baseUrl: string,
    sessionId: string
): Promise<OpenCodeFileDiff[]> {
    const base = ensureNoTrailingSlash(baseUrl);
    const signal = createTimeoutSignal(OPENCODE_REQUEST_TIMEOUT_MS);
    const res = await fetch(`${base}/session/${sessionId}/diff`, { method: 'GET', signal });
    if (!res.ok) return [];
    const raw = await res.text();
    if (!raw?.trim()) return [];
    let data: OpenCodeFileDiff[] | { data?: OpenCodeFileDiff[] };
    try {
        data = JSON.parse(raw) as OpenCodeFileDiff[] | { data?: OpenCodeFileDiff[] };
    } catch {
        return [];
    }
    if (Array.isArray(data)) return data;
    if (Array.isArray((data as { data?: OpenCodeFileDiff[] }).data))
        return (data as { data: OpenCodeFileDiff[] }).data;
    return [];
}

export class AiRepository {
    ask = async (ai: Ai, prompt: string): Promise<string | undefined> => {
        const serverUrl = ai.getOpencodeServerUrl();
        const model = ai.getOpencodeModel();
        if (!serverUrl || !model) {
            logError('Missing required AI configuration: opencode-server-url and opencode-model');
            return undefined;
        }
        try {
            const { providerID, modelID } = ai.getOpencodeModelParts();
            const text = await opencodePrompt(serverUrl, providerID, modelID, prompt);
            return text || undefined;
        } catch (error) {
            logError(`Error querying OpenCode (${model}): ${error}`);
            return undefined;
        }
    };

    /**
     * Ask an OpenCode agent (e.g. Plan) to perform a task. The server runs the full agent loop.
     * Returns the final message (including reasoning in parts when includeReasoning is true).
     * @param ai - AI config (server URL, model)
     * @param agentId - OpenCode agent id (e.g. OPENCODE_AGENT_PLAN)
     * @param prompt - User prompt
     * @param options - expectJson, schema, includeReasoning
     * @returns Response text, or parsed JSON when expectJson is true
     */
    askAgent = async (
        ai: Ai,
        agentId: string,
        prompt: string,
        options: AskAgentOptions = {}
    ): Promise<string | Record<string, unknown> | undefined> => {
        const serverUrl = ai.getOpencodeServerUrl();
        const model = ai.getOpencodeModel();
        if (!serverUrl || !model) {
            logError('Missing required AI configuration: opencode-server-url and opencode-model');
            return undefined;
        }
        try {
            const { providerID, modelID } = ai.getOpencodeModelParts();
            let promptText = prompt;
            if (options.expectJson && options.schema) {
                const schemaName = options.schemaName ?? 'response';
                promptText = `Respond with a single JSON object that strictly conforms to this schema (name: ${schemaName}). No other text or markdown.\n\nSchema: ${JSON.stringify(options.schema)}\n\nUser request:\n${prompt}`;
            }
            const { text, parts } = await opencodeMessageWithAgent(serverUrl, {
                providerID,
                modelID,
                agent: agentId,
                promptText,
            });
            if (!text) return undefined;
            const reasoning = options.includeReasoning ? extractReasoningFromParts(parts) : '';
            if (options.expectJson) {
                const cleaned = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
                const parsed = JSON.parse(cleaned) as Record<string, unknown>;
                if (options.includeReasoning && reasoning) {
                    return { ...parsed, reasoning };
                }
                return parsed;
            }
            return text;
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            const errWithCause = err as Error & { cause?: unknown };
            const cause =
                errWithCause.cause instanceof Error
                    ? errWithCause.cause.message
                    : errWithCause.cause != null
                      ? String(errWithCause.cause)
                      : '';
            const detail = cause ? ` (${cause})` : '';
            logError(`Error querying OpenCode agent ${agentId} (${model}): ${err.message}${detail}`);
            return undefined;
        }
    };

    /**
     * Run the OpenCode "build" agent for the copilot command. Returns the final message and sessionId.
     */
    copilotMessage = async (
        ai: Ai,
        prompt: string
    ): Promise<{ text: string; sessionId: string } | undefined> => {
        const serverUrl = ai.getOpencodeServerUrl();
        const model = ai.getOpencodeModel();
        if (!serverUrl || !model) {
            logError('Missing required AI configuration: opencode-server-url and opencode-model');
            return undefined;
        }
        try {
            const { providerID, modelID } = ai.getOpencodeModelParts();
            const result = await opencodeMessageWithAgent(serverUrl, {
                providerID,
                modelID,
                agent: OPENCODE_AGENT_BUILD,
                promptText: prompt,
            });
            return { text: result.text, sessionId: result.sessionId };
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            const errWithCause = err as Error & { cause?: unknown };
            const cause =
                errWithCause.cause instanceof Error
                    ? errWithCause.cause.message
                    : errWithCause.cause != null
                      ? String(errWithCause.cause)
                      : '';
            const detail = cause ? ` (${cause})` : '';
            logError(`Error querying OpenCode build agent (${model}): ${err.message}${detail}`);
            return undefined;
        }
    };
}

import {
    OPENCODE_MAX_RETRIES,
    OPENCODE_REQUEST_TIMEOUT_MS,
    OPENCODE_RETRY_DELAY_MS,
} from '../../utils/constants';
import { logDebugInfo, logError, logInfo } from '../../utils/logger';
import { Ai } from '../model/ai';

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs an async OpenCode operation with retries. On failure, logs and retries up to OPENCODE_MAX_RETRIES.
 * Single retry system for all OpenCode interactions: no parallel retry logic.
 *
 * Retries when the operation throws, including:
 * - Network errors (fetch fails, connection refused, etc.)
 * - HTTP errors (4xx/5xx from session create or message)
 * - Timeout (OPENCODE_REQUEST_TIMEOUT_MS)
 * - Empty or invalid JSON response body (parseJsonResponse throws)
 * - Missing session id in create response
 * - Parse failure of expected format (e.g. expectJson but text is not valid JSON) when parse is done inside the callback
 */
async function withOpenCodeRetry<T>(fn: () => Promise<T>, context: string): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= OPENCODE_MAX_RETRIES; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            const message = error instanceof Error ? error.message : String(error);
            if (attempt < OPENCODE_MAX_RETRIES) {
                logInfo(`OpenCode [${context}] attempt ${attempt}/${OPENCODE_MAX_RETRIES} failed: ${message}. Retrying in ${OPENCODE_RETRY_DELAY_MS}ms...`);
                await delay(OPENCODE_RETRY_DELAY_MS);
            } else {
                logError(`OpenCode [${context}] failed after ${OPENCODE_MAX_RETRIES} attempts: ${message}`);
            }
        }
    }
    throw lastError;
}

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

/** JSON schema for translation responses: translatedText (required), optional reason if translation failed. */
export const TRANSLATION_RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
        translatedText: {
            type: 'string',
            description: 'The text translated to the requested locale. Required. Must not be empty.',
        },
        reason: {
            type: 'string',
            description:
                'Optional: reason why translation could not be produced or was partial (e.g. ambiguous input).',
        },
    },
    required: ['translatedText'],
    additionalProperties: false,
} as const;

/** JSON schema for Think (Q&A) responses: single answer field. */
export const THINK_RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
        answer: {
            type: 'string',
            description: 'The concise answer to the user question. Required.',
        },
    },
    required: ['answer'],
    additionalProperties: false,
} as const;

/** JSON schema for language check: done (already in locale) or must_translate. */
export const LANGUAGE_CHECK_RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
        status: {
            type: 'string',
            enum: ['done', 'must_translate'],
            description: 'done if text is in the requested locale, must_translate otherwise.',
        },
    },
    required: ['status'],
    additionalProperties: false,
} as const;

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
 * Raw call: no retries. Callers (askAgent, copilotMessage) wrap in withOpenCodeRetry.
 */
async function opencodeMessageWithAgentRaw(
    baseUrl: string,
    options: {
        providerID: string;
        modelID: string;
        agent: string;
        promptText: string;
    }
): Promise<OpenCodeAgentMessageResult> {
    logInfo(
        `OpenCode request [agent ${options.agent}] model=${options.providerID}/${options.modelID} promptLength=${options.promptText.length}`
    );
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
    logInfo(
        `OpenCode response [agent ${options.agent}] responseLength=${text.length} sessionId=${sessionId}`
    );
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
 * Wrapped with retries (OPENCODE_MAX_RETRIES).
 */
export async function getSessionDiff(
    baseUrl: string,
    sessionId: string
): Promise<OpenCodeFileDiff[]> {
    return withOpenCodeRetry(async () => {
        logInfo(`OpenCode request [session diff] sessionId=${sessionId}`);
        const base = ensureNoTrailingSlash(baseUrl);
        const signal = createTimeoutSignal(OPENCODE_REQUEST_TIMEOUT_MS);
        const res = await fetch(`${base}/session/${sessionId}/diff`, { method: 'GET', signal });
        if (!res.ok) {
            logInfo(`OpenCode response [session diff] fileCount=0 (status ${res.status})`);
            return [];
        }
        const raw = await res.text();
        if (!raw?.trim()) {
            logInfo('OpenCode response [session diff] fileCount=0 (empty body)');
            return [];
        }
        let data: OpenCodeFileDiff[] | { data?: OpenCodeFileDiff[] };
        try {
            data = JSON.parse(raw) as OpenCodeFileDiff[] | { data?: OpenCodeFileDiff[] };
        } catch {
            logInfo('OpenCode response [session diff] fileCount=0 (invalid JSON)');
            return [];
        }
        const list = Array.isArray(data)
            ? data
            : Array.isArray((data as { data?: OpenCodeFileDiff[] }).data)
              ? (data as { data: OpenCodeFileDiff[] }).data
              : [];
        logInfo(`OpenCode response [session diff] fileCount=${list.length}`);
        return list;
    }, 'session diff');
}

export class AiRepository {
    /**
     * Ask an OpenCode agent (e.g. Plan) to perform a task. All calls use strict response (expectJson + schema).
     * Single retry system: HTTP failures and parse failures both retry up to OPENCODE_MAX_RETRIES.
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
        const { providerID, modelID } = ai.getOpencodeModelParts();
        const schemaName = options.schemaName ?? 'response';
        const promptText =
            options.expectJson && options.schema
                ? `Respond with a single JSON object that strictly conforms to this schema (name: ${schemaName}). No other text or markdown.\n\nSchema: ${JSON.stringify(options.schema)}\n\nUser request:\n${prompt}`
                : prompt;
        try {
            return await withOpenCodeRetry(async () => {
                const { text, parts } = await opencodeMessageWithAgentRaw(serverUrl, {
                    providerID,
                    modelID,
                    agent: agentId,
                    promptText,
                });
                if (!text) throw new Error('Empty response text');
                const reasoning = options.includeReasoning ? extractReasoningFromParts(parts) : '';
                if (options.expectJson && options.schema) {
                    const cleaned = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
                    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
                    if (options.includeReasoning && reasoning) {
                        return { ...parsed, reasoning };
                    }
                    return parsed;
                }
                return text;
            }, `agent ${agentId}`);
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
     * Uses the same retry system (OPENCODE_MAX_RETRIES).
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
            const result = await withOpenCodeRetry(
                () =>
                    opencodeMessageWithAgentRaw(serverUrl, {
                        providerID,
                        modelID,
                        agent: OPENCODE_AGENT_BUILD,
                        promptText: prompt,
                    }),
                `agent ${OPENCODE_AGENT_BUILD}`
            );
            return { text: result.text, sessionId: result.sessionId };
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(`Error querying OpenCode build agent (${model}): ${err.message}`);
            return undefined;
        }
    };
}

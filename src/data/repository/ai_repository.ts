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
            const cause =
                error instanceof Error && (error as Error & { cause?: unknown }).cause instanceof Error
                    ? (error as Error & { cause: Error }).cause.message
                    : '';
            const detail = cause ? ` (cause: ${cause})` : '';
            const noResponseHint =
                message === 'fetch failed'
                    ? ' No HTTP response; connection lost or timeout. If this was before the client timeout (see log above), the OpenCode server or a proxy may have a shorter timeout.'
                    : '';
            if (attempt < OPENCODE_MAX_RETRIES) {
                logInfo(
                    `OpenCode [${context}] attempt ${attempt}/${OPENCODE_MAX_RETRIES} failed: ${message}${detail}.${noResponseHint} Retrying in ${OPENCODE_RETRY_DELAY_MS}ms...`
                );
                await delay(OPENCODE_RETRY_DELAY_MS);
            } else {
                logError(`OpenCode [${context}] failed after ${OPENCODE_MAX_RETRIES} attempts: ${message}${detail}`);
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

function truncate(s: string, maxLen: number): string {
    return s.length <= maxLen ? s : s.slice(0, maxLen) + '...';
}

const OPENCODE_PROMPT_LOG_PREVIEW_LEN = 500;
const OPENCODE_PROMPT_LOG_FULL_LEN = 3000;

/** Result of validating AI config for OpenCode calls. null when invalid. */
interface OpenCodeConfig {
    serverUrl: string;
    providerID: string;
    modelID: string;
    model: string;
}

function getValidatedOpenCodeConfig(ai: Ai): OpenCodeConfig | null {
    const serverUrl = ai.getOpencodeServerUrl();
    const model = ai.getOpencodeModel();
    if (!serverUrl?.trim() || !model?.trim()) {
        logError('Missing required AI configuration: opencode-server-url and opencode-model');
        return null;
    }
    const { providerID, modelID } = ai.getOpencodeModelParts();
    return { serverUrl, providerID, modelID, model };
}

/**
 * Try to extract the first complete JSON object from text (from first `{` with balanced braces).
 * Handles being inside a double-quoted string so we don't count braces there.
 */
function extractFirstJsonObject(text: string): string | null {
    const start = text.indexOf('{');
    if (start === -1) return null;
    let depth = 1;
    let inString = false;
    let escape = false;
    let quoteChar = '"';
    for (let i = start + 1; i < text.length; i++) {
        const c = text[i];
        if (escape) {
            escape = false;
            continue;
        }
        if (c === '\\' && inString) {
            escape = true;
            continue;
        }
        if (inString) {
            if (c === quoteChar) inString = false;
            continue;
        }
        if (c === '"' || c === "'") {
            inString = true;
            quoteChar = c;
            continue;
        }
        if (c === '{') depth++;
        else if (c === '}') {
            depth--;
            if (depth === 0) return text.slice(start, i + 1);
        }
    }
    return null;
}

/**
 * Parse JSON from agent response text safely.
 * Tries: (1) direct parse, (2) strip markdown code fence, (3) extract first JSON object from text (model often adds prose before JSON).
 * @throws Error with clear message if parsing fails
 */
function parseJsonFromAgentText(text: string): Record<string, unknown> {
    const trimmed = text.trim();
    if (!trimmed) {
        throw new Error('Agent response text is empty');
    }
    // 1) Direct parse
    try {
        return JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
        // 2) Model may wrap JSON in ```json ... ``` or ``` ... ```
        const withoutFence = trimmed
            .replace(/^```(?:json)?\s*\n?/i, '')
            .replace(/\n?```\s*$/i, '')
            .trim();
        try {
            return JSON.parse(withoutFence) as Record<string, unknown>;
        } catch {
            // 3) Model may add prose before the JSON (e.g. "Based on my analysis... { ... }")
            const extracted = extractFirstJsonObject(trimmed);
            if (extracted) {
                try {
                    return JSON.parse(extracted) as Record<string, unknown>;
                } catch (e) {
                    const msg = e instanceof Error ? e.message : String(e);
                    logDebugInfo(
                        `OpenCode agent response (expectJson): failed to parse extracted JSON. Full text length=${trimmed.length} firstChars=${JSON.stringify(trimmed.slice(0, 200))}`
                    );
                    throw new Error(`Agent response is not valid JSON: ${msg}`);
                }
            }
            const previewLen = 500;
            const msg = trimmed.length > previewLen ? `${trimmed.slice(0, previewLen)}...` : trimmed;
            const fullTruncated = trimmed.length > 3000 ? `${trimmed.slice(0, 3000)}... [total ${trimmed.length} chars]` : trimmed;
            logDebugInfo(
                `OpenCode agent response (expectJson): no JSON object found. length=${trimmed.length} preview=${JSON.stringify(msg)}`
            );
            logDebugInfo(`OpenCode agent response (expectJson) full text for debugging:\n${fullTruncated}`);
            throw new Error(
                `Agent response is not valid JSON: no JSON object found. Response starts with: ${msg.slice(0, 150)}`
            );
        }
    }
}

/**
 * Extract text from OpenCode message parts by type (e.g. 'text', 'reasoning'), joined with separator.
 */
function extractPartsByType(parts: unknown, type: string, joinWith: string): string {
    if (!Array.isArray(parts)) return '';
    return (parts as Array<{ type?: string; text?: string }>)
        .filter((p) => p?.type === type && typeof p.text === 'string')
        .map((p) => p.text as string)
        .join(joinWith)
        .trim();
}

const OPENCODE_RESPONSE_LOG_MAX_LEN = 80000;

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

/** Extract plain text from OpenCode message response parts (type === 'text'). */
function extractTextFromParts(parts: unknown): string {
    return extractPartsByType(parts, 'text', '');
}

/** Extract reasoning from OpenCode message parts (type === 'reasoning'). */
function extractReasoningFromParts(parts: unknown): string {
    return extractPartsByType(parts, 'reasoning', '\n\n');
}

/** Max length of per-part text preview in debug log (to avoid huge log lines). */
const OPENCODE_PART_PREVIEW_LEN = 80;

/**
 * Build a short summary of OpenCode message parts for debug logs (types, text lengths, and short preview).
 */
function summarizePartsForLog(parts: unknown[], context: string): string {
    if (!Array.isArray(parts) || parts.length === 0) {
        return `${context}: 0 parts`;
    }
    const items = (parts as Array<{ type?: string; text?: string }>).map((p, i) => {
        const type = p?.type ?? '(missing type)';
        const text = typeof p?.text === 'string' ? p.text : '';
        const len = text.length;
        const preview =
            len > OPENCODE_PART_PREVIEW_LEN
                ? `${text.slice(0, OPENCODE_PART_PREVIEW_LEN).replace(/\n/g, ' ')}...`
                : text.replace(/\n/g, ' ');
        return `[${i}] type=${type} length=${len}${preview ? ` preview=${JSON.stringify(preview)}` : ''}`;
    });
    return `${context}: ${parts.length} part(s) — ${items.join(' | ')}`;
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
    logInfo(`OpenCode sending prompt (preview): ${truncate(options.promptText, OPENCODE_PROMPT_LOG_PREVIEW_LEN)}`);
    logDebugInfo(`OpenCode prompt (full): ${truncate(options.promptText, OPENCODE_PROMPT_LOG_FULL_LEN)}`);
    logDebugInfo(
        `OpenCode message body: agent=${options.agent}, model=${options.providerID}/${options.modelID}, parts[0].text length=${options.promptText.length}`
    );
    const base = ensureNoTrailingSlash(baseUrl);
    const signal = createTimeoutSignal(OPENCODE_REQUEST_TIMEOUT_MS);
    const sessionBody = { title: 'gbf' };
    logDebugInfo(`OpenCode session create body: ${JSON.stringify(sessionBody)}`);
    const createRes = await fetch(`${base}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionBody),
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
    logDebugInfo(`OpenCode POST /session/${sessionId}/message body (keys): agent, model, parts (${(body.parts as unknown[]).length} part(s))`);
    const timeoutMin = Math.round(OPENCODE_REQUEST_TIMEOUT_MS / 60_000);
    logInfo(`OpenCode: waiting for agent "${options.agent}" message response (client timeout: ${timeoutMin} min)...`);
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
    const partsArray = Array.isArray(parts) ? parts : [];
    logDebugInfo(summarizePartsForLog(partsArray, `OpenCode agent "${options.agent}" message parts`));
    const text = extractTextFromParts(partsArray);
    logInfo(
        `OpenCode response [agent ${options.agent}] responseLength=${text.length} sessionId=${sessionId}`
    );
    return { text, parts: partsArray, sessionId };
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
        const config = getValidatedOpenCodeConfig(ai);
        if (!config) return undefined;
        const { serverUrl, providerID, modelID, model } = config;
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
                    const maxLogLen = 5000000;
                    const toLog = text.length > maxLogLen ? `${text.slice(0, maxLogLen)}\n... [truncated, total ${text.length} chars]` : text;
                    logInfo(`OpenCode agent response (full text, expectJson=true) length=${text.length}:\n${toLog}`);
                    const parsed = parseJsonFromAgentText(text);
                    if (options.includeReasoning && reasoning) {
                        return { ...parsed, reasoning };
                    }
                    return parsed;
                }
                return text;
            }, `agent ${agentId}`);
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            const cause = err instanceof Error && (err as Error & { cause?: unknown }).cause;
            const detail = cause != null ? ` (${cause instanceof Error ? cause.message : String(cause)})` : '';
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
        const config = getValidatedOpenCodeConfig(ai);
        if (!config) return undefined;
        const { serverUrl, providerID, modelID, model } = config;
        try {
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

import { logError } from '../../utils/logger';
import { Ai } from '../model/ai';
import { AI_RESPONSE_JSON_SCHEMA } from '../model/ai_response_schema';
import { THINK_RESPONSE_JSON_SCHEMA } from '../model/think_response_schema';

function ensureNoTrailingSlash(url: string): string {
    return url.replace(/\/+$/, '') || url;
}

/**
 * Extract plain text from OpenCode message response parts.
 */
function extractTextFromParts(parts: any): string {
    if (!Array.isArray(parts)) return '';
    return parts
        .filter((p: any) => p?.type === 'text' && typeof p.text === 'string')
        .map((p: any) => p.text)
        .join('');
}

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
    const createRes = await fetch(`${base}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'gbf' }),
    });
    if (!createRes.ok) {
        const err = await createRes.text();
        throw new Error(`OpenCode session create failed: ${createRes.status} ${err}`);
    }
    const session = (await createRes.json()) as { id?: string; data?: { id?: string } };
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
    });
    if (!messageRes.ok) {
        const err = await messageRes.text();
        throw new Error(`OpenCode message failed: ${messageRes.status} ${err}`);
    }
    const messageData = (await messageRes.json()) as { parts?: any[]; data?: { parts?: any[] } };
    const parts = messageData?.parts ?? messageData?.data?.parts ?? [];
    return extractTextFromParts(parts);
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

    askJson = async (
        ai: Ai,
        prompt: string,
        schema?: any,
        schemaName: string = 'ai_response',
        streaming?: boolean,
        onChunk?: (chunk: string) => void,
        strict: boolean = true
    ): Promise<any | undefined> => {
        const serverUrl = ai.getOpencodeServerUrl();
        const model = ai.getOpencodeModel();
        if (!serverUrl || !model) {
            logError('Missing required AI configuration: opencode-server-url and opencode-model');
            return undefined;
        }
        const schemaRef = schema || AI_RESPONSE_JSON_SCHEMA;
        const jsonInstruction = strict
            ? `Respond with a single JSON object that strictly conforms to this schema (name: ${schemaName}). No other text or markdown.`
            : `Respond with a single JSON object. No other text or markdown.`;
        const fullPrompt = `${jsonInstruction}\n\nSchema (for reference): ${JSON.stringify(schemaRef)}\n\nUser request:\n${prompt}`;
        try {
            const { providerID, modelID } = ai.getOpencodeModelParts();
            const text = await opencodePrompt(serverUrl, providerID, modelID, fullPrompt);
            if (!text) return undefined;
            if (streaming && onChunk) onChunk(text);
            return JSON.parse(text);
        } catch (error) {
            logError(`Error querying OpenCode (${model}) for JSON: ${error}`);
            return undefined;
        }
    };

    askThinkJson = async (
        ai: Ai,
        messagesOrPrompt: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> | string
    ): Promise<any | undefined> => {
        const serverUrl = ai.getOpencodeServerUrl();
        const model = ai.getOpencodeModel();
        if (!serverUrl || !model) {
            logError('Missing required AI configuration: opencode-server-url and opencode-model');
            return undefined;
        }
        const messages = Array.isArray(messagesOrPrompt)
            ? messagesOrPrompt
            : [{ role: 'user' as const, content: messagesOrPrompt }];
        const conversationText = messages
            .map((m) => `${m.role}: ${m.content}`)
            .join('\n\n');
        const jsonInstruction = `Respond with a single JSON object that strictly conforms to the "think_response" schema. No other text or markdown.`;
        const fullPrompt = `${jsonInstruction}\n\nSchema (for reference): ${JSON.stringify(THINK_RESPONSE_JSON_SCHEMA)}\n\nConversation:\n${conversationText}`;
        try {
            const { providerID, modelID } = ai.getOpencodeModelParts();
            const text = await opencodePrompt(serverUrl, providerID, modelID, fullPrompt);
            if (!text) return undefined;
            return JSON.parse(text);
        } catch (error) {
            logError(`Error querying OpenCode (${model}) for think JSON: ${error}`);
            return undefined;
        }
    };
}

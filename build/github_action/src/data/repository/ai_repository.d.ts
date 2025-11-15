import { Ai } from '../model/ai';
export declare class AiRepository {
    ask: (ai: Ai, prompt: string) => Promise<string | undefined>;
    askJson: (ai: Ai, prompt: string, schema?: any, schemaName?: string, streaming?: boolean, onChunk?: (chunk: string) => void) => Promise<any | undefined>;
    /**
     * Handle streaming response
     */
    private handleStreamingResponse;
    /**
     * Ask AI with conversation history (array of messages)
     * Supports both single prompt (backward compatible) and message array
     */
    askThinkJson: (ai: Ai, messagesOrPrompt: Array<{
        role: "system" | "user" | "assistant";
        content: string;
    }> | string) => Promise<any | undefined>;
}

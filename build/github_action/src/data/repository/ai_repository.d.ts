import { Ai } from '../model/ai';
export declare class AiRepository {
    ask: (ai: Ai, prompt: string) => Promise<string | undefined>;
    askJson: (ai: Ai, prompt: string, schema?: any, schemaName?: string, streaming?: boolean, onChunk?: (chunk: string) => void, strict?: boolean) => Promise<any | undefined>;
    askThinkJson: (ai: Ai, messagesOrPrompt: Array<{
        role: "system" | "user" | "assistant";
        content: string;
    }> | string) => Promise<any | undefined>;
}

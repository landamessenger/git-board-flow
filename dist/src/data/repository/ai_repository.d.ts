import { Ai } from '../model/ai';
export declare class AiRepository {
    ask: (ai: Ai, prompt: string) => Promise<string | undefined>;
    askJson: (ai: Ai, prompt: string) => Promise<any | undefined>;
}

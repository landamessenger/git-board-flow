import { Ai } from '../model/ai';
export declare class AiRepository {
    ask: (ai: Ai, prompt: string) => Promise<string | undefined>;
}

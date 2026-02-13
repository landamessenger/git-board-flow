export type ThinkParams = {
    projectContextInstruction: string;
    contextBlock: string;
    question: string;
};
export declare function getThinkPrompt(params: ThinkParams): string;

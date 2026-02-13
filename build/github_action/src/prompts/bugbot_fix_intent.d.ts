export type BugbotFixIntentParams = {
    projectContextInstruction: string;
    findingsBlock: string;
    parentBlock: string;
    userComment: string;
};
export declare function getBugbotFixIntentPrompt(params: BugbotFixIntentParams): string;

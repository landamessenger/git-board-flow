export type RecommendStepsParams = {
    projectContextInstruction: string;
    issueNumber: string;
    issueDescription: string;
};
export declare function getRecommendStepsPrompt(params: RecommendStepsParams): string;

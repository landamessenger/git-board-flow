/**
 * Intent Classifier Agent
 * Classifies user prompts to determine if changes should be applied to disk or kept in memory
 */
import { IntentClassifierOptions, IntentClassificationResult } from './types';
export declare class IntentClassifier {
    private agent;
    private options;
    constructor(options: IntentClassifierOptions);
    /**
     * Classify user prompt to determine if changes should be applied
     * @param prompt - User prompt to classify
     * @returns IntentClassificationResult indicating if changes should be applied
     */
    classifyIntent(prompt: string): Promise<IntentClassificationResult>;
    /**
     * Fallback classification using simple heuristics if agent fails
     * This is used when the parser cannot extract valid JSON from the response
     */
    private fallbackClassification;
}

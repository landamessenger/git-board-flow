/**
 * JSON Schema for Intent Classifier response
 * Ensures the response is always in the expected format
 */
export declare const INTENT_CLASSIFICATION_SCHEMA: {
    type: string;
    properties: {
        shouldApplyChanges: {
            type: string;
            description: string;
        };
        reasoning: {
            type: string;
            description: string;
        };
        confidence: {
            type: string;
            enum: string[];
            description: string;
        };
    };
    required: string[];
    additionalProperties: boolean;
};

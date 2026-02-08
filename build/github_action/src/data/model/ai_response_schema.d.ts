/**
 * JSON Schema for AiResponse interface
 * This schema is used to enforce structured JSON responses from the AI
 */
export declare const AI_RESPONSE_JSON_SCHEMA: {
    type: string;
    properties: {
        text_response: {
            type: string;
            description: string;
        };
        action: {
            type: string;
            enum: string[];
            description: string;
        };
        related_files: {
            type: string;
            items: {
                type: string;
            };
            description: string;
        };
        complete: {
            type: string;
            description: string;
        };
    };
    required: string[];
    additionalProperties: boolean;
};

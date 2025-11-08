/**
 * JSON Schema for codebase analysis responses
 * Used in Step 0 of the thinking process to analyze codebase structure
 */
export declare const CODEBASE_ANALYSIS_JSON_SCHEMA: {
    type: string;
    description: string;
    items: {
        type: string;
        properties: {
            path: {
                type: string;
                description: string;
            };
            description: {
                type: string;
                description: string;
            };
            relationships: {
                type: string;
                description: string;
                items: {
                    type: string;
                };
            };
        };
        required: string[];
        additionalProperties: boolean;
    };
};

/**
 * JSON Schema for Agent responses
 * Used with OpenCode JSON mode
 */
export declare const AGENT_RESPONSE_SCHEMA: {
    type: string;
    properties: {
        response: {
            type: string;
            description: string;
        };
        tool_calls: {
            type: string;
            description: string;
            items: {
                type: string;
                properties: {
                    id: {
                        type: string;
                        description: string;
                    };
                    name: {
                        type: string;
                        description: string;
                    };
                    input: {
                        type: string;
                        description: string;
                        additionalProperties: boolean;
                    };
                };
                required: string[];
                additionalProperties: boolean;
            };
        };
    };
    required: string[];
    additionalProperties: boolean;
};

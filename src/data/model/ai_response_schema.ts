/**
 * JSON Schema for AiResponse interface
 * This schema is used to enforce structured JSON responses from the AI
 */
export const AI_RESPONSE_JSON_SCHEMA = {
    type: "object",
    properties: {
        text_response: {
            type: "string",
            description: "The detailed analysis or answer to the user's question"
        },
        action: {
            type: "string",
            enum: ["none", "analyze_files"],
            description: "The action to take: 'none' if no additional files are needed, 'analyze_files' if more files are required"
        },
        related_files: {
            type: "array",
            items: {
                type: "string"
            },
            description: "List of file paths that need to be analyzed if action is 'analyze_files'"
        },
        complete: {
            type: "boolean",
            description: "Whether the response is complete and no further analysis is needed"
        }
    },
    required: ["text_response", "action", "related_files", "complete"],
    additionalProperties: false
};


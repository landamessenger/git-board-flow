/**
 * JSON Schema for codebase analysis responses
 * Used in Step 0 of the thinking process to analyze codebase structure
 */
export const CODEBASE_ANALYSIS_JSON_SCHEMA = {
    "type": "array",
    "description": "Array of file analyses with descriptions and relationships",
    "items": {
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "File path relative to repository root"
            },
            "description": {
                "type": "string",
                "description": "Brief description (1-2 sentences) of what the file does in English"
            },
            "relationships": {
                "type": "array",
                "description": "Array of file paths that this file depends on or imports",
                "items": {
                    "type": "string"
                }
            }
        },
        "required": ["path", "description"],
        "additionalProperties": false
    }
};

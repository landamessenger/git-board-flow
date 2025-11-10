/**
 * JSON Schema for ThinkResponse interface
 * This schema is used for structured AI reasoning and analysis responses
 */
export const THINK_RESPONSE_JSON_SCHEMA = {
    type: "object",
    properties: {
        reasoning: {
            type: "string",
            description: "Current reasoning step or analysis of the problem"
        },
        action: {
            type: "string",
            enum: ["search_files", "read_file", "analyze_code", "propose_changes", "complete", "update_todos"],
            description: "Next action to take in the reasoning process"
        },
        files_to_search: {
            type: "array",
            items: {
                type: "string"
            },
            description: "List of file paths or patterns to search for (when action is 'search_files')"
        },
        files_to_read: {
            type: "array",
            items: {
                type: "string"
            },
            description: "List of specific file paths to read in full (when action is 'read_file')"
        },
        analyzed_files: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    path: { type: "string" },
                    key_findings: { type: "string" },
                    relevance: { type: "string", enum: ["high", "medium", "low"] }
                },
                required: ["path", "key_findings", "relevance"],
                additionalProperties: false
            },
            description: "Files that have been analyzed with their findings (when action is 'analyze_code')"
        },
        proposed_changes: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    file_path: { type: "string" },
                    change_type: { type: "string", enum: ["create", "modify", "delete", "refactor"] },
                    description: { type: "string" },
                    suggested_code: { type: "string" },
                    reasoning: { type: "string" }
                },
                required: ["file_path", "change_type", "description", "suggested_code", "reasoning"],
                additionalProperties: false
            },
            description: "Proposed changes to the codebase (when action is 'propose_changes')"
        },
        complete: {
            type: "boolean",
            description: "Whether the reasoning process is complete"
        },
        final_analysis: {
            type: "string",
            description: "Final comprehensive analysis and recommendations (when complete is true)"
        },
        todo_updates: {
            type: "object",
            description: "Updates to the TODO list (when action is 'update_todos' or alongside other actions)",
            properties: {
                create: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            content: { type: "string" },
                            status: { type: "string", enum: ["pending", "in_progress"] }
                        },
                        required: ["content", "status"],
                        additionalProperties: false
                    },
                    description: "New TODO items to create"
                },
                update: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            id: { type: "string" },
                            status: { type: "string", enum: ["pending", "in_progress", "completed", "cancelled"] },
                            notes: { type: "string" }
                        },
                        required: ["id", "status", "notes"],
                        additionalProperties: false
                    },
                    description: "Updates to existing TODO items"
                }
            },
            required: ["create", "update"],
            additionalProperties: false
        }
    },
    required: ["reasoning", "action", "complete", "files_to_search", "files_to_read", "analyzed_files", "proposed_changes", "final_analysis", "todo_updates"],
    additionalProperties: false
};


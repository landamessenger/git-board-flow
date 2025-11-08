/**
 * JSON Schema for ThinkResponse interface
 * This schema is used for structured AI reasoning and analysis responses
 */
export declare const THINK_RESPONSE_JSON_SCHEMA: {
    type: string;
    properties: {
        reasoning: {
            type: string;
            description: string;
        };
        action: {
            type: string;
            enum: string[];
            description: string;
        };
        files_to_search: {
            type: string;
            items: {
                type: string;
            };
            description: string;
        };
        files_to_read: {
            type: string;
            items: {
                type: string;
            };
            description: string;
        };
        analyzed_files: {
            type: string;
            items: {
                type: string;
                properties: {
                    path: {
                        type: string;
                    };
                    key_findings: {
                        type: string;
                    };
                    relevance: {
                        type: string;
                        enum: string[];
                    };
                };
                required: string[];
            };
            description: string;
        };
        proposed_changes: {
            type: string;
            items: {
                type: string;
                properties: {
                    file_path: {
                        type: string;
                    };
                    change_type: {
                        type: string;
                        enum: string[];
                    };
                    description: {
                        type: string;
                    };
                    suggested_code: {
                        type: string;
                    };
                    reasoning: {
                        type: string;
                    };
                };
                required: string[];
            };
            description: string;
        };
        complete: {
            type: string;
            description: string;
        };
        final_analysis: {
            type: string;
            description: string;
        };
        todo_updates: {
            type: string;
            description: string;
            properties: {
                create: {
                    type: string;
                    items: {
                        type: string;
                        properties: {
                            content: {
                                type: string;
                            };
                            status: {
                                type: string;
                                enum: string[];
                            };
                        };
                        required: string[];
                    };
                    description: string;
                };
                update: {
                    type: string;
                    items: {
                        type: string;
                        properties: {
                            id: {
                                type: string;
                            };
                            status: {
                                type: string;
                                enum: string[];
                            };
                            notes: {
                                type: string;
                            };
                        };
                        required: string[];
                    };
                    description: string;
                };
            };
        };
    };
    required: string[];
    additionalProperties: boolean;
};

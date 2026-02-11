/** OpenCode response schema: agent computes diff, returns new findings and which previous ones are resolved. */
export const BUGBOT_RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
        findings: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Stable unique id for this finding (e.g. file:line:summary)' },
                    title: { type: 'string', description: 'Short title of the problem' },
                    description: { type: 'string', description: 'Clear explanation of the issue' },
                    file: { type: 'string', description: 'Repository-relative path when applicable' },
                    line: { type: 'number', description: 'Line number when applicable' },
                    severity: { type: 'string', description: 'Severity: high, medium, low, or info. Findings below the configured minimum are not published.' },
                    suggestion: { type: 'string', description: 'Suggested fix when applicable' },
                },
                required: ['id', 'title', 'description'],
                additionalProperties: true,
            },
        },
        resolved_finding_ids: {
            type: 'array',
            items: { type: 'string' },
            description:
                'Ids of previously reported issues (from the list we sent) that are now fixed in the current code. Only include ids we asked you to check.',
        },
    },
    required: ['findings'],
    additionalProperties: false,
} as const;

/**
 * OpenCode (plan agent) response schema for bugbot fix intent.
 * Given the user comment and the list of unresolved findings, the agent decides whether
 * the user is asking to fix one or more of them and which finding ids to target.
 */
export const BUGBOT_FIX_INTENT_RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
        is_fix_request: {
            type: 'boolean',
            description:
                'True if the user comment is clearly requesting to fix one or more of the reported findings (e.g. "fix it", "arregla", "fix this vulnerability", "fix all"). False for questions, unrelated messages, or ambiguous text.',
        },
        target_finding_ids: {
            type: 'array',
            items: { type: 'string' },
            description:
                'When is_fix_request is true: the exact finding ids from the list we provided that the user wants fixed. Use the exact id strings. For "fix all" or "fix everything" include all listed ids. When is_fix_request is false, return an empty array.',
        },
    },
    required: ['is_fix_request', 'target_finding_ids'],
    additionalProperties: false,
} as const;

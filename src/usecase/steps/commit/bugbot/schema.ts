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

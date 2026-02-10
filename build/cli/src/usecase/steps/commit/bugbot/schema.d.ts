/** OpenCode response schema: agent computes diff, returns new findings and which previous ones are resolved. */
export declare const BUGBOT_RESPONSE_SCHEMA: {
    readonly type: "object";
    readonly properties: {
        readonly findings: {
            readonly type: "array";
            readonly items: {
                readonly type: "object";
                readonly properties: {
                    readonly id: {
                        readonly type: "string";
                        readonly description: "Stable unique id for this finding (e.g. file:line:summary)";
                    };
                    readonly title: {
                        readonly type: "string";
                        readonly description: "Short title of the problem";
                    };
                    readonly description: {
                        readonly type: "string";
                        readonly description: "Clear explanation of the issue";
                    };
                    readonly file: {
                        readonly type: "string";
                        readonly description: "Repository-relative path when applicable";
                    };
                    readonly line: {
                        readonly type: "number";
                        readonly description: "Line number when applicable";
                    };
                    readonly severity: {
                        readonly type: "string";
                        readonly description: "e.g. high, medium, low";
                    };
                    readonly suggestion: {
                        readonly type: "string";
                        readonly description: "Suggested fix when applicable";
                    };
                };
                readonly required: readonly ["id", "title", "description"];
                readonly additionalProperties: true;
            };
        };
        readonly resolved_finding_ids: {
            readonly type: "array";
            readonly items: {
                readonly type: "string";
            };
            readonly description: "Ids of previously reported issues (from the list we sent) that are now fixed in the current code. Only include ids we asked you to check.";
        };
    };
    readonly required: readonly ["findings"];
    readonly additionalProperties: false;
};

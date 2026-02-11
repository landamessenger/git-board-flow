export declare const extractVersion: (pattern: string, text: string) => string | undefined;
export declare const extractReleaseType: (pattern: string, text: string) => string | undefined;
/**
 * Extracts changelog content from an issue body: from the given section heading (e.g. "Changelog" or "Hotfix Solution")
 * up to but not including the "Additional Context" section. Used for release/hotfix deployment bodies.
 */
export declare const extractChangelogUpToAdditionalContext: (body: string | null | undefined, sectionTitle: string) => string;
export declare const injectJsonAsMarkdownBlock: (title: string, json: object) => string;

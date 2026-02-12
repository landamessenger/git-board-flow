function escapeRegexLiteral(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const extractVersion = (pattern: string, text: string): string | undefined => {
    const escaped = escapeRegexLiteral(pattern);
    const versionPattern = new RegExp(`###\\s*${escaped}\\s+(\\d+\\.\\d+\\.\\d+)`, 'i');
    const match = text.match(versionPattern);
    return match ? match[1] : undefined;
};

export const extractReleaseType = (pattern: string, text: string): string | undefined => {
    const escaped = escapeRegexLiteral(pattern);
    const releaseTypePattern = new RegExp(`###\\s*${escaped}\\s+(Patch|Minor|Major)`, 'i');
    const match = text.match(releaseTypePattern);
    return match ? match[1] : undefined;
};

/**
 * Extracts changelog content from an issue body: from the given section heading (e.g. "Changelog" or "Hotfix Solution")
 * up to but not including the "Additional Context" section. Used for release/hotfix deployment bodies.
 */
export const extractChangelogUpToAdditionalContext = (
    body: string | null | undefined,
    sectionTitle: string,
): string => {
    if (body == null || body === '') {
        return 'No changelog provided';
    }
    const escaped = escapeRegexLiteral(sectionTitle);
    const pattern = new RegExp(
        `(?:###|##)\\s*${escaped}\\s*\\n\\n([\\s\\S]*?)` +
            `(?=\\n(?:###|##)\\s*Additional Context\\s*|$)`,
        'i',
    );
    const match = body.match(pattern);
    const content = match?.[1]?.trim();
    return content ?? 'No changelog provided';
};

export const injectJsonAsMarkdownBlock = (title: string, json: object): string => {
    const formattedJson = JSON.stringify(json, null, 4) // Pretty-print the JSON with 4 spaces.
        .split('\n')                                   // Split into lines.
        .map(line => `> ${line}`)                     // Prefix each line with '> '.
        .join('\n');                                  // Join lines back into a string.

    return `> **${title}**\n>\n> \`\`\`json\n${formattedJson}\n> \`\`\``;
}

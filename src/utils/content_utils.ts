export const extractVersion = (pattern: string, text: string): string | undefined => {
    const versionPattern = new RegExp(`###\\s*${pattern}\\s+(\\d+\\.\\d+\\.\\d+)`, 'i');
    const match = text.match(versionPattern);
    return match ? match[1] : undefined;
};

export const extractReleaseType = (pattern: string, text: string): string | undefined => {
    const releaseTypePattern = new RegExp(`###\\s*${pattern}\\s+(Patch|Minor|Major)`, 'i');
    const match = text.match(releaseTypePattern);
    return match ? match[1] : undefined;
};

export const injectJsonAsMarkdownBlock = (title: string, json: object): string => {
    const formattedJson = JSON.stringify(json, null, 4) // Pretty-print the JSON with 4 spaces.
        .split('\n')                                   // Split into lines.
        .map(line => `> ${line}`)                     // Prefix each line with '> '.
        .join('\n');                                  // Join lines back into a string.

    return `> **${title}**\n>\n> \`\`\`json\n${formattedJson}\n> \`\`\``;
}

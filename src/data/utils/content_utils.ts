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

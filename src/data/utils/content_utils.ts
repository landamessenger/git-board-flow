export const extractVersion = (pattern: string, text: string): string | undefined => {
    const versionPattern = new RegExp(`###\\s*${pattern}\\s+(\\d+\\.\\d+\\.\\d+)`, 'i');
    const match = text.match(versionPattern);
    return match ? match[1] : undefined;
};
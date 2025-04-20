"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.injectJsonAsMarkdownBlock = exports.extractReleaseType = exports.extractVersion = void 0;
const extractVersion = (pattern, text) => {
    const versionPattern = new RegExp(`###\\s*${pattern}\\s+(\\d+\\.\\d+\\.\\d+)`, 'i');
    const match = text.match(versionPattern);
    return match ? match[1] : undefined;
};
exports.extractVersion = extractVersion;
const extractReleaseType = (pattern, text) => {
    const releaseTypePattern = new RegExp(`###\\s*${pattern}\\s+(Patch|Minor|Major)`, 'i');
    const match = text.match(releaseTypePattern);
    return match ? match[1] : undefined;
};
exports.extractReleaseType = extractReleaseType;
const injectJsonAsMarkdownBlock = (title, json) => {
    const formattedJson = JSON.stringify(json, null, 4) // Pretty-print the JSON with 4 spaces.
        .split('\n') // Split into lines.
        .map(line => `> ${line}`) // Prefix each line with '> '.
        .join('\n'); // Join lines back into a string.
    return `> **${title}**\n>\n> \`\`\`json\n${formattedJson}\n> \`\`\``;
};
exports.injectJsonAsMarkdownBlock = injectJsonAsMarkdownBlock;

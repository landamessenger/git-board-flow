import * as core from "@actions/core";

export const incrementVersion = (version: string, releaseType: string): string => {
    core.info(`Incrementing version ${version}.`)
    const versionParts = version.split('.').map(Number);

    if (versionParts.length !== 3) {
        throw new Error('Invalid version format');
    }

    const [major, minor, patch] = versionParts;

    switch (releaseType) {
        case 'Major':
            // Increment the major version and reset minor and patch
            return `${major + 1}.0.0`;
        case 'Minor':
            // Increment the minor version and reset patch
            return `${major}.${minor + 1}.0`;
        case 'Patch':
            // Increment the patch version
            return `${major}.${minor}.${patch + 1}`;
        default:
            throw new Error('Unknown release type');
    }
};

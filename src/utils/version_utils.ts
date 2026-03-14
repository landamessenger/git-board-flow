import { logDebugInfo } from "./logger";

/** Default base version when the repository has no existing tags (e.g. new repo). */
export const DEFAULT_BASE_VERSION = '1.0.0';

/** Default initial tag name (with "v" prefix) for repos with no tags. Used by setup. */
export const DEFAULT_INITIAL_TAG = `v${DEFAULT_BASE_VERSION}`;

export const incrementVersion = (version: string, releaseType: string): string => {
    logDebugInfo(`Incrementing version ${version}.`)
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

export const getLatestVersion = (versions: string[]): string | undefined => {
    return versions
        .map(version => version.split('.').map(num => parseInt(num, 10)))
        .sort((a, b) => {
            for (let i = 0; i < 3; i++) {
                if (a[i] > b[i]) return 1;
                if (a[i] < b[i]) return -1;
            }
            return 0;
        })
        .map(version => version.join('.'))
        .pop();
};

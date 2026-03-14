/** Default base version when the repository has no existing tags (e.g. new repo). */
export declare const DEFAULT_BASE_VERSION = "1.0.0";
/** Default initial tag name (with "v" prefix) for repos with no tags. Used by setup. */
export declare const DEFAULT_INITIAL_TAG = "v1.0.0";
export declare const incrementVersion: (version: string, releaseType: string) => string;
export declare const getLatestVersion: (versions: string[]) => string | undefined;

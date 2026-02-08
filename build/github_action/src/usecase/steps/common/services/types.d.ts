/**
 * Shared types for codebase analysis services
 */
export interface CachedFileInfo {
    path: string;
    sha: string;
    description: string;
    consumes: string[];
    consumed_by: string[];
}
export interface FileRelationshipMap {
    consumes: Map<string, string[]>;
    consumedBy: Map<string, string[]>;
}

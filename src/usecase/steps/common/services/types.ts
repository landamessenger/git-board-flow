/**
 * Shared types for codebase analysis services
 */

export interface CachedFileInfo {
    path: string;
    sha: string;
    description: string;
    consumes: string[];  // Files this file imports
    consumed_by: string[];  // Files that import this file
}

export interface FileRelationshipMap {
    consumes: Map<string, string[]>;
    consumedBy: Map<string, string[]>;
}


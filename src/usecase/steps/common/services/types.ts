/**
 * Shared types for codebase analysis services
 */

export interface FileRelationshipMap {
    consumes: Map<string, string[]>;
    consumedBy: Map<string, string[]>;
}


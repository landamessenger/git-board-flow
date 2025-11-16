/**
 * File Relationship Analyzer
 * Analyzes file relationships and finds consumers/dependencies
 */
export interface FileRelationshipResult {
    targetFile: string;
    consumers: string[];
    dependencies: string[];
    allRelatedFiles: string[];
}
export declare class FileRelationshipAnalyzer {
    private fileImportAnalyzer;
    constructor();
    /**
     * Analyze relationships for a target file
     */
    analyzeFileRelationships(targetFile: string, repositoryFiles: Map<string, string>, includeDependencies?: boolean): FileRelationshipResult | null;
}

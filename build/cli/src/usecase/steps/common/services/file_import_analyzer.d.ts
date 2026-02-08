/**
 * Service for extracting imports and building file relationship maps
 * Supports multiple programming languages
 */
export declare class FileImportAnalyzer {
    /**
     * Extract imports from a file regardless of programming language
     */
    extractImportsFromFile(filePath: string, content: string): string[];
    /**
     * Resolve relative import path to absolute path
     */
    resolveRelativePath(baseDir: string, relativePath: string): string;
    /**
     * Build relationship map from all files by extracting imports
     * Also builds reverse map (consumed_by)
     */
    buildRelationshipMap(repositoryFiles: Map<string, string>): {
        consumes: Map<string, string[]>;
        consumedBy: Map<string, string[]>;
    };
}

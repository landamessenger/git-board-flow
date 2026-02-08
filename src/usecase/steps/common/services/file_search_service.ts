/**
 * Service for building file indexes and searching files
 */
export class FileSearchService {
    /**
     * Build file index for quick lookup by filename or directory
     */
    buildFileIndex(files: Map<string, string>): Map<string, string[]> {
        const index = new Map<string, string[]>();
        
        for (const [path, _content] of files.entries()) {
            const pathParts = path.split('/');
            const fileName = pathParts[pathParts.length - 1];
            
            // Index by filename
            if (!index.has(fileName)) {
                index.set(fileName, []);
            }
            index.get(fileName)!.push(path);
            
            // Index by directory
            if (pathParts.length > 1) {
                const dir = pathParts.slice(0, -1).join('/');
                if (!index.has(dir)) {
                    index.set(dir, []);
                }
                index.get(dir)!.push(path);
            }
        }
        
        return index;
    }

    /**
     * Search files by search terms (filename, directory, pattern, or content)
     */
    searchFiles(
        searchTerms: string[], 
        fileIndex: Map<string, string[]>,
        repositoryFiles?: Map<string, string>
    ): string[] {
        const foundFiles = new Set<string>();
        
        for (const term of searchTerms) {
            const termLower = term.toLowerCase();
            
            // Exact filename match
            if (fileIndex.has(term)) {
                fileIndex.get(term)!.forEach(f => foundFiles.add(f));
            }
            
            // Pattern match in filename/directory (simple contains)
            for (const [key, paths] of fileIndex.entries()) {
                if (key.toLowerCase().includes(termLower)) {
                    paths.forEach(p => foundFiles.add(p));
                }
                // Also check paths
                paths.forEach(path => {
                    if (path.toLowerCase().includes(termLower)) {
                        foundFiles.add(path);
                    }
                });
            }
            
            // Search in file content if repositoryFiles is provided
            if (repositoryFiles) {
                for (const [filePath, content] of repositoryFiles.entries()) {
                    // Search for term in content (case-insensitive)
                    if (content.toLowerCase().includes(termLower)) {
                        foundFiles.add(filePath);
                    }
                }
            }
        }
        
        return Array.from(foundFiles);
    }
}


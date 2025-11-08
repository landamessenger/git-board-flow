/**
 * Service for extracting imports and building file relationship maps
 * Supports multiple programming languages
 */
export class FileImportAnalyzer {
    /**
     * Extract imports from a file regardless of programming language
     */
    extractImportsFromFile(filePath: string, content: string): string[] {
        const imports: string[] = [];
        const ext = filePath.split('.').pop()?.toLowerCase() || '';
        const dir = filePath.split('/').slice(0, -1).join('/') || '';
        
        // TypeScript/JavaScript
        if (['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'].includes(ext)) {
            // import ... from '...'
            const es6Imports = content.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g) || [];
            es6Imports.forEach(match => {
                const path = match.match(/['"]([^'"]+)['"]/)?.[1];
                if (path) imports.push(path);
            });
            
            // require('...')
            const requireImports = content.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g) || [];
            requireImports.forEach(match => {
                const path = match.match(/['"]([^'"]+)['"]/)?.[1];
                if (path) imports.push(path);
            });
        }
        
        // Python
        if (['py', 'pyw', 'pyi'].includes(ext)) {
            // import ... / from ... import ...
            const pyImports = content.match(/(?:^|\n)\s*(?:import\s+\w+|from\s+[\w.]+)\s+import/gm) || [];
            pyImports.forEach(match => {
                const fromMatch = match.match(/from\s+([\w.]+)/);
                if (fromMatch) {
                    imports.push(fromMatch[1]);
                } else {
                    const importMatch = match.match(/import\s+(\w+)/);
                    if (importMatch) imports.push(importMatch[1]);
                }
            });
        }
        
        // Java
        if (ext === 'java') {
            const javaImports = content.match(/import\s+(?:static\s+)?[\w.]+\s*;/g) || [];
            javaImports.forEach(match => {
                const path = match.replace(/import\s+(?:static\s+)?/, '').replace(/\s*;/, '');
                imports.push(path);
            });
        }
        
        // Kotlin
        if (['kt', 'kts'].includes(ext)) {
            const ktImports = content.match(/import\s+[\w.]+\s*/g) || [];
            ktImports.forEach(match => {
                const path = match.replace(/import\s+/, '').trim();
                imports.push(path);
            });
        }
        
        // Go
        if (ext === 'go') {
            const goImports = content.match(/import\s*(?:\([^)]+\)|['"]([^'"]+)['"])/gs) || [];
            goImports.forEach(match => {
                const quoted = match.match(/['"]([^'"]+)['"]/);
                if (quoted) {
                    imports.push(quoted[1]);
                } else {
                    // Multi-line import block
                    const multiLine = match.match(/import\s*\(([^)]+)\)/s);
                    if (multiLine) {
                        const paths = multiLine[1].match(/['"]([^'"]+)['"]/g) || [];
                        paths.forEach(p => {
                            const path = p.match(/['"]([^'"]+)['"]/)?.[1];
                            if (path) imports.push(path);
                        });
                    }
                }
            });
        }
        
        // Rust
        if (ext === 'rs') {
            const rustImports = content.match(/use\s+[\w:]+(?:::\*)?\s*;/g) || [];
            rustImports.forEach(match => {
                const path = match.replace(/use\s+/, '').replace(/\s*;/, '').split('::')[0];
                imports.push(path);
            });
        }
        
        // Ruby
        if (ext === 'rb') {
            const rubyImports = content.match(/(?:require|require_relative)\s+['"]([^'"]+)['"]/g) || [];
            rubyImports.forEach(match => {
                const path = match.match(/['"]([^'"]+)['"]/)?.[1];
                if (path) imports.push(path);
            });
        }
        
        // PHP
        if (ext === 'php') {
            const phpImports = content.match(/(?:use|require|include)(?:_once)?\s+['"]([^'"]+)['"]/g) || [];
            phpImports.forEach(match => {
                const path = match.match(/['"]([^'"]+)['"]/)?.[1];
                if (path) imports.push(path);
            });
        }
        
        // Swift
        if (ext === 'swift') {
            const swiftImports = content.match(/import\s+\w+/g) || [];
            swiftImports.forEach(match => {
                const path = match.replace(/import\s+/, '');
                imports.push(path);
            });
        }
        
        // Dart
        if (ext === 'dart') {
            const dartImports = content.match(/import\s+['"]([^'"]+)['"]/g) || [];
            dartImports.forEach(match => {
                const path = match.match(/['"]([^'"]+)['"]/)?.[1];
                if (path) imports.push(path);
            });
        }
        
        // Resolve relative imports to absolute paths
        return imports.map(imp => {
            // Skip external packages (node_modules, stdlib, etc.)
            if (!imp.startsWith('.') && !imp.startsWith('/')) {
                // Try to resolve relative to current file
                if (dir) {
                    // Check if it's a relative path that needs resolution
                    const possiblePath = `${dir}/${imp}`.replace(/\/+/g, '/');
                    return possiblePath;
                }
                return imp;
            }
            
            // Resolve relative paths
            if (imp.startsWith('.')) {
                const resolved = this.resolveRelativePath(dir, imp);
                return resolved;
            }
            
            return imp;
        }).filter(imp => imp && !imp.includes('node_modules') && !imp.startsWith('http'));
    }
    
    /**
     * Resolve relative import path to absolute path
     */
    resolveRelativePath(baseDir: string, relativePath: string): string {
        if (!relativePath.startsWith('.')) {
            return relativePath;
        }
        
        let path = baseDir || '';
        const parts = relativePath.split('/');
        
        for (const part of parts) {
            if (part === '..') {
                path = path.split('/').slice(0, -1).join('/');
            } else if (part === '.' || part === '') {
                // Current directory, do nothing
            } else {
                path = path ? `${path}/${part}` : part;
            }
        }
        
        // Remove file extension if present and add common extensions
        const withoutExt = path.replace(/\.(ts|tsx|js|jsx|py|java|kt|go|rs|rb|php|swift|dart)$/, '');
        
        return withoutExt;
    }

    /**
     * Build relationship map from all files by extracting imports
     * Also builds reverse map (consumed_by)
     */
    buildRelationshipMap(
        repositoryFiles: Map<string, string>
    ): { consumes: Map<string, string[]>, consumedBy: Map<string, string[]> } {
        const consumesMap = new Map<string, string[]>();
        const consumedByMap = new Map<string, string[]>();
        
        // Initialize consumedBy map for all files
        for (const filePath of repositoryFiles.keys()) {
            consumedByMap.set(filePath, []);
        }
        
        for (const [filePath, content] of repositoryFiles.entries()) {
            const imports = this.extractImportsFromFile(filePath, content);
            
            // Resolve imports to actual file paths in the repository
            const resolvedImports: string[] = [];
            
            for (const imp of imports) {
                // Try to find matching file in repository
                const possiblePaths = [
                    imp,
                    `${imp}.ts`,
                    `${imp}.tsx`,
                    `${imp}.js`,
                    `${imp}.jsx`,
                    `${imp}/index.ts`,
                    `${imp}/index.tsx`,
                    `${imp}/index.js`,
                    `${imp}/index.jsx`,
                ];
                
                for (const possiblePath of possiblePaths) {
                    // Check exact match
                    if (repositoryFiles.has(possiblePath)) {
                        if (!resolvedImports.includes(possiblePath)) {
                            resolvedImports.push(possiblePath);
                        }
                        // Update reverse map
                        const currentConsumers = consumedByMap.get(possiblePath) || [];
                        if (!currentConsumers.includes(filePath)) {
                            currentConsumers.push(filePath);
                            consumedByMap.set(possiblePath, currentConsumers);
                        }
                        break;
                    }
                    
                    // Check if any file path contains this import
                    for (const [repoPath] of repositoryFiles.entries()) {
                        if (repoPath.includes(possiblePath) || possiblePath.includes(repoPath)) {
                            if (!resolvedImports.includes(repoPath)) {
                                resolvedImports.push(repoPath);
                            }
                            // Update reverse map
                            const currentConsumers = consumedByMap.get(repoPath) || [];
                            if (!currentConsumers.includes(filePath)) {
                                currentConsumers.push(filePath);
                                consumedByMap.set(repoPath, currentConsumers);
                            }
                        }
                    }
                }
            }
            
            consumesMap.set(filePath, resolvedImports);
        }
        
        return { consumes: consumesMap, consumedBy: consumedByMap };
    }
}


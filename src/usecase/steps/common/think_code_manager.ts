import { ProposedChange } from '../../../data/model/think_response';
import { logDebugInfo, logInfo } from '../../../utils/logger';

/**
 * Manages virtual code state - keeps files in memory and applies proposed changes
 * so subsequent reasoning steps can see the accumulated progress
 */
export class ThinkCodeManager {
    private originalFiles: Map<string, string> = new Map();
    private virtualFiles: Map<string, string> = new Map();
    private appliedChanges: Map<string, ProposedChange[]> = new Map(); // file -> changes applied
    private allAppliedChanges: ProposedChange[] = [];

    /**
     * Initialize with original repository files
     */
    initialize(originalFiles: Map<string, string>): void {
        this.originalFiles = new Map(originalFiles);
        this.virtualFiles = new Map(originalFiles);
        this.appliedChanges.clear();
        this.allAppliedChanges = [];
        logInfo(`📦 Code manager initialized with ${originalFiles.size} files`);
    }

    /**
     * Get current state of a file (with applied changes)
     */
    getFileContent(filePath: string): string | undefined {
        return this.virtualFiles.get(filePath);
    }

    /**
     * Get all virtual files
     */
    getAllFiles(): Map<string, string> {
        return new Map(this.virtualFiles);
    }

    /**
     * Check if a file has been modified
     */
    isFileModified(filePath: string): boolean {
        return this.appliedChanges.has(filePath);
    }

    /**
     * Get changes applied to a specific file
     */
    getFileChanges(filePath: string): ProposedChange[] {
        return this.appliedChanges.get(filePath) || [];
    }

    /**
     * Apply a proposed change to the virtual codebase
     */
    applyChange(change: ProposedChange): boolean {
        try {
            const filePath = change.file_path;
            const currentContent = this.virtualFiles.get(filePath) || '';
            
            let newContent = currentContent;

            switch (change.change_type) {
                case 'create':
                    if (!currentContent) {
                        // File doesn't exist, create it with suggested code
                        newContent = change.suggested_code || '';
                        logDebugInfo(`✅ Created virtual file: ${filePath}`);
                    } else {
                        logDebugInfo(`⚠️ File ${filePath} already exists, skipping create`);
                        return false;
                    }
                    break;

                case 'modify':
                    if (currentContent) {
                        // Apply modification - for now, append suggested code
                        // In a more sophisticated implementation, we could parse and merge
                        if (change.suggested_code) {
                            // Simple strategy: append the suggested code with a marker
                            newContent = `${currentContent}\n\n// === AI Proposed Modification ===\n${change.suggested_code}`;
                            logDebugInfo(`✅ Modified virtual file: ${filePath}`);
                        } else {
                            // Just note the modification
                            newContent = `${currentContent}\n\n// === AI Proposed Modification: ${change.description} ===`;
                            logDebugInfo(`✅ Noted modification in virtual file: ${filePath}`);
                        }
                    } else {
                        logDebugInfo(`⚠️ Cannot modify non-existent file: ${filePath}`);
                        return false;
                    }
                    break;

                case 'delete':
                    // Mark as deleted but keep for reference
                    newContent = `// === FILE MARKED FOR DELETION ===\n// Original content:\n${currentContent}`;
                    logDebugInfo(`✅ Marked virtual file for deletion: ${filePath}`);
                    break;

                case 'refactor':
                    if (currentContent && change.suggested_code) {
                        // Refactor: replace with new code
                        newContent = `${currentContent}\n\n// === AI Proposed Refactoring ===\n${change.suggested_code}`;
                        logDebugInfo(`✅ Refactored virtual file: ${filePath}`);
                    } else {
                        logDebugInfo(`⚠️ Cannot refactor file ${filePath}: ${currentContent ? 'no suggested code' : 'file does not exist'}`);
                        return false;
                    }
                    break;

                default:
                    logDebugInfo(`⚠️ Unknown change type: ${change.change_type}`);
                    return false;
            }

            this.virtualFiles.set(filePath, newContent);
            
            // Track applied changes
            if (!this.appliedChanges.has(filePath)) {
                this.appliedChanges.set(filePath, []);
            }
            this.appliedChanges.get(filePath)!.push(change);
            this.allAppliedChanges.push(change);

            return true;
        } catch (error) {
            logDebugInfo(`❌ Error applying change to ${change.file_path}: ${error}`);
            return false;
        }
    }

    /**
     * Check if a change has already been applied (to avoid duplicates)
     */
    hasChangeBeenApplied(change: ProposedChange): boolean {
        // Check by file path and description similarity
        const existingChanges = this.allAppliedChanges.filter(c => 
            c.file_path === change.file_path &&
            c.change_type === change.change_type &&
            this.areSimilar(c.description, change.description)
        );
        return existingChanges.length > 0;
    }

    /**
     * Get summary of all applied changes
     */
    getChangesSummary(): string {
        if (this.allAppliedChanges.length === 0) {
            return 'No changes applied yet.';
        }

        const summary: string[] = [];
        summary.push(`\n## Applied Changes (${this.allAppliedChanges.length} total):\n`);

        for (const [filePath, changes] of this.appliedChanges.entries()) {
            summary.push(`\n### ${filePath} (${changes.length} change${changes.length > 1 ? 's' : ''}):`);
            changes.forEach((change, idx) => {
                summary.push(`  ${idx + 1}. ${change.change_type.toUpperCase()}: ${change.description}`);
            });
        }

        return summary.join('\n');
    }

    /**
     * Get context about what has changed for the AI
     */
    getContextForAI(): string {
        const context: string[] = [];
        
        if (this.allAppliedChanges.length > 0) {
            context.push(`\n## Code State Changes Applied:`);
            context.push(`Total changes applied: ${this.allAppliedChanges.length}`);
            context.push(`Files modified: ${this.appliedChanges.size}`);
            context.push(this.getChangesSummary());
            
            // Show modified file contents summary
            context.push(`\n## Modified Files Preview:`);
            for (const [filePath, changes] of this.appliedChanges.entries()) {
                const currentContent = this.virtualFiles.get(filePath);
                if (currentContent) {
                    const preview = currentContent.substring(0, 500);
                    context.push(`\n### ${filePath}:`);
                    context.push(`\`\`\`\n${preview}${currentContent.length > 500 ? '\n... (truncated)' : ''}\n\`\`\``);
                }
            }
        } else {
            context.push(`\n## Code State: No changes applied yet.`);
        }

        return context.join('\n');
    }

    /**
     * Simple similarity check for change descriptions
     */
    private areSimilar(desc1: string, desc2: string): boolean {
        const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');
        const n1 = normalize(desc1);
        const n2 = normalize(desc2);
        
        // Exact match
        if (n1 === n2) return true;
        
        // Check if one contains the other (for similar proposals)
        if (n1.length > 20 && n2.length > 20) {
            const words1 = n1.split(' ').filter(w => w.length > 3);
            const words2 = n2.split(' ').filter(w => w.length > 3);
            const commonWords = words1.filter(w => words2.includes(w));
            // If 70% of significant words match, consider similar
            return commonWords.length / Math.max(words1.length, words2.length) > 0.7;
        }
        
        return false;
    }

    /**
     * Get statistics
     */
    getStats(): { totalFiles: number; modifiedFiles: number; totalChanges: number } {
        return {
            totalFiles: this.virtualFiles.size,
            modifiedFiles: this.appliedChanges.size,
            totalChanges: this.allAppliedChanges.length
        };
    }
}


import { ProposedChange } from '../../../data/model/think_response';
/**
 * Manages virtual code state - keeps files in memory and applies proposed changes
 * so subsequent reasoning steps can see the accumulated progress
 */
export declare class ThinkCodeManager {
    private originalFiles;
    private virtualFiles;
    private appliedChanges;
    private allAppliedChanges;
    /**
     * Initialize with original repository files
     */
    initialize(originalFiles: Map<string, string>): void;
    /**
     * Get current state of a file (with applied changes)
     */
    getFileContent(filePath: string): string | undefined;
    /**
     * Get all virtual files
     */
    getAllFiles(): Map<string, string>;
    /**
     * Check if a file has been modified
     */
    isFileModified(filePath: string): boolean;
    /**
     * Get changes applied to a specific file
     */
    getFileChanges(filePath: string): ProposedChange[];
    /**
     * Apply a proposed change to the virtual codebase
     */
    applyChange(change: ProposedChange): boolean;
    /**
     * Check if a change has already been applied (to avoid duplicates)
     */
    hasChangeBeenApplied(change: ProposedChange): boolean;
    /**
     * Get summary of all applied changes
     */
    getChangesSummary(): string;
    /**
     * Get context about what has changed for the AI
     */
    getContextForAI(): string;
    /**
     * Simple similarity check for change descriptions
     */
    private areSimilar;
    /**
     * Get statistics
     */
    getStats(): {
        totalFiles: number;
        modifiedFiles: number;
        totalChanges: number;
    };
}

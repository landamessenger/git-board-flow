import { ThinkStep, ProposedChange, FileAnalysis } from '../../../../data/model/think_response';
import { ThinkTodoManager } from '../think_todo_manager';
/**
 * Service for formatting GitHub comments and code changes
 */
export declare class CommentFormatter {
    private readonly GITHUB_COMMENT_MAX_LENGTH;
    /**
     * Format the complete reasoning comment for GitHub
     */
    formatReasoningComment(question: string, description: string, steps: ThinkStep[], analyzedFiles: Map<string, FileAnalysis>, proposedChanges: ProposedChange[], finalAnalysis: string, totalIterations: number, todoManager: ThinkTodoManager): string;
    /**
     * Format a single proposed change
     */
    formatProposedChange(change: ProposedChange, index: number): string;
    /**
     * Detect programming language from file path/extension
     */
    detectLanguageFromPath(filePath: string): string;
    /**
     * Get emoji for action type
     */
    getActionEmoji(action: string): string;
    /**
     * Format action name for display
     */
    formatActionName(action: string): string;
    /**
     * Get emoji for change type
     */
    getChangeTypeEmoji(changeType: string): string;
}

export declare class ReasoningVisualizer {
    private currentIteration;
    private maxIterations;
    private startTime;
    private lastAction;
    private todoStats;
    private filesRead;
    private filesAnalyzed;
    private changesApplied;
    initialize(maxIterations: number): void;
    updateIteration(iteration: number): void;
    updateTodoStats(stats: {
        total: number;
        pending: number;
        in_progress: number;
        completed: number;
    }): void;
    updateFilesRead(count: number): void;
    updateFilesAnalyzed(count: number): void;
    updateChangesApplied(count: number): void;
    /**
     * Show a clean header for the reasoning process
     */
    showHeader(question: string): void;
    /**
     * Show current iteration status with progress bar
     */
    showIterationStatus(action: string, reasoning: string): void;
    /**
     * Show TODO status
     */
    showTodoStatus(): void;
    /**
     * Show file and change statistics
     */
    showStats(): void;
    /**
     * Show action result summary
     */
    showActionResult(action: string, result: {
        success: boolean;
        message: string;
        details?: string[];
    }): void;
    /**
     * Show completion summary
     */
    showCompletion(_finalAnalysis?: string): void;
    /**
     * Create a visual progress bar
     */
    private createProgressBar;
    /**
     * Get emoji for action type
     */
    private getActionEmoji;
    /**
     * Clear current line and show updated status
     */
    updateStatus(action: string, reasoning: string): void;
}

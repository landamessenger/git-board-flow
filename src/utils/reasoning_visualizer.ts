import chalk from 'chalk';
import { logInfo, logSingleLine } from './logger';

export class ReasoningVisualizer {
    private currentIteration: number = 0;
    private maxIterations: number = 0;
    private startTime: number = 0;
    private lastAction: string = '';
    private todoStats: { total: number; pending: number; in_progress: number; completed: number } = {
        total: 0,
        pending: 0,
        in_progress: 0,
        completed: 0
    };
    private filesRead: number = 0;
    private filesAnalyzed: number = 0;
    private changesApplied: number = 0;

    initialize(maxIterations: number) {
        this.maxIterations = maxIterations;
        this.startTime = Date.now();
        this.currentIteration = 0;
        this.filesRead = 0;
        this.filesAnalyzed = 0;
        this.changesApplied = 0;
    }

    updateIteration(iteration: number) {
        this.currentIteration = iteration;
    }

    updateTodoStats(stats: { total: number; pending: number; in_progress: number; completed: number }) {
        this.todoStats = stats;
    }

    updateFilesRead(count: number) {
        this.filesRead = count;
    }

    updateFilesAnalyzed(count: number) {
        this.filesAnalyzed = count;
    }

    updateChangesApplied(count: number) {
        this.changesApplied = count;
    }

    /**
     * Show a clean header for the reasoning process
     */
    showHeader(question: string) {
        logInfo('');
        logInfo(chalk.cyan.bold('╔═══════════════════════════════════════════════════════════════╗'));
        logInfo(chalk.cyan.bold('║') + chalk.white.bold('  🤖 AI Reasoning Process') + chalk.cyan.bold('                                    ║'));
        logInfo(chalk.cyan.bold('╚═══════════════════════════════════════════════════════════════╝'));
        logInfo('');
        logInfo(chalk.gray('Task: ') + chalk.white(question));
        logInfo('');
    }

    /**
     * Show current iteration status with progress bar
     */
    showIterationStatus(action: string, reasoning: string) {
        // Guard against division by zero
        const progress = this.maxIterations > 0 ? (this.currentIteration / this.maxIterations) * 100 : 0;
        const progressBar = this.createProgressBar(progress, 40);
        const elapsed = this.startTime > 0 ? ((Date.now() - this.startTime) / 1000).toFixed(1) : '0.0';
        
        const statusLine = [
            chalk.cyan(`[${this.currentIteration}/${this.maxIterations}]`),
            progressBar,
            chalk.gray(`${progress.toFixed(0)}%`),
            chalk.gray(`• ${elapsed}s`)
        ].join(' ');

        logSingleLine(statusLine);
        logInfo(''); // New line after single line update
        
        // Show action and reasoning
        const actionEmoji = this.getActionEmoji(action);
        logInfo(chalk.cyan(`${actionEmoji} ${action.toUpperCase()}`) + chalk.gray(` • Iteration ${this.currentIteration}`));
        logInfo(chalk.gray(`   ${reasoning.substring(0, 100)}${reasoning.length > 100 ? '...' : ''}`));
    }

    /**
     * Show TODO status
     */
    showTodoStatus() {
        if (this.todoStats.total === 0) return;
        
        const completionRate = this.todoStats.total > 0 
            ? ((this.todoStats.completed / this.todoStats.total) * 100).toFixed(0)
            : '0';
        
        const todoLine = [
            chalk.blue('📋 TODOs:'),
            chalk.white(`${this.todoStats.total}`),
            chalk.gray('•'),
            chalk.yellow(`⏳ ${this.todoStats.pending}`),
            chalk.cyan(`🔄 ${this.todoStats.in_progress}`),
            chalk.green(`✅ ${this.todoStats.completed}`),
            chalk.gray(`(${completionRate}% done)`)
        ].join(' ');
        
        logSingleLine(todoLine);
    }

    /**
     * Show file and change statistics
     */
    showStats() {
        const statsLine = [
            chalk.blue('📊 Stats:'),
            chalk.white(`📖 ${this.filesRead} read`),
            chalk.gray('•'),
            chalk.white(`🔍 ${this.filesAnalyzed} analyzed`),
            chalk.gray('•'),
            chalk.white(`✏️ ${this.changesApplied} changes`)
        ].join(' ');
        
        logSingleLine(statsLine);
    }

    /**
     * Show action result summary
     */
    showActionResult(action: string, result: { success: boolean; message: string; details?: string[] }) {
        logInfo('');
        if (result.success) {
            logInfo(chalk.green(`  ✓ ${result.message}`));
        } else {
            logInfo(chalk.yellow(`  ⚠ ${result.message}`));
        }
        
        if (result.details && result.details.length > 0) {
            result.details.forEach(detail => {
                logInfo(chalk.gray(`    ${detail}`));
            });
        }
    }

    /**
     * Show completion summary
     */
    showCompletion(finalAnalysis?: string) {
        logInfo('');
        logInfo(chalk.green.bold('╔═══════════════════════════════════════════════════════════════╗'));
        logInfo(chalk.green.bold('║') + chalk.white.bold('  ✅ Reasoning Complete') + chalk.green.bold('                                         ║'));
        logInfo(chalk.green.bold('╚═══════════════════════════════════════════════════════════════╝'));
        logInfo('');
        
        const totalTime = ((Date.now() - this.startTime) / 1000).toFixed(1);
        logInfo(chalk.gray(`Completed in ${totalTime}s • ${this.currentIteration} iterations`));
        logInfo('');
    }

    /**
     * Create a visual progress bar
     */
    private createProgressBar(percentage: number, length: number): string {
        const filled = Math.floor((percentage / 100) * length);
        const empty = length - filled;
        const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
        return bar;
    }

    /**
     * Get emoji for action type
     */
    private getActionEmoji(action: string): string {
        const emojiMap: Record<string, string> = {
            'search_files': '🔍',
            'read_file': '📖',
            'analyze_code': '🔬',
            'propose_changes': '✏️',
            'update_todos': '📋',
            'complete': '✅'
        };
        return emojiMap[action] || '🤔';
    }

    /**
     * Clear current line and show updated status
     */
    updateStatus(action: string, reasoning: string) {
        this.showIterationStatus(action, reasoning);
        this.showTodoStatus();
        this.showStats();
    }
}


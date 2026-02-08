import { ThinkStep, ProposedChange, FileAnalysis, TodoStatus } from '../../../../data/model/think_response';
import { ThinkTodoManager } from '../think_todo_manager';

/**
 * Service for formatting GitHub comments and code changes
 */
export class CommentFormatter {
    private readonly GITHUB_COMMENT_MAX_LENGTH = 65500; // Leave some margin below 65536

    /**
     * Format the complete reasoning comment for GitHub
     */
    formatReasoningComment(
        question: string,
        description: string,
        steps: ThinkStep[],
        analyzedFiles: Map<string, FileAnalysis>,
        proposedChanges: ProposedChange[],
        finalAnalysis: string,
        totalIterations: number,
        todoManager: ThinkTodoManager
    ): string {
        let comment = '';

        // Header
        comment += `# 🤔 AI Reasoning Analysis\n\n`;
        
        if (question) {
            comment += `## 📝 Question\n\n${question}\n\n`;
        }

        comment += `---\n\n`;

        // MAIN CONTENT: Summary and conclusions
        comment += `## 📊 Analysis Summary\n\n`;
        comment += `- **Total Iterations**: ${totalIterations}\n`;
        comment += `- **Files Analyzed**: ${analyzedFiles.size}\n`;
        comment += `- **Changes Proposed**: ${proposedChanges.length}\n`;
        
        // TODO List Summary
        const todoStats = todoManager.getStats();
        if (todoStats.total > 0) {
            comment += `- **TODO Tasks**: ${todoStats.total} (${todoStats.completed} completed, ${todoStats.in_progress} in progress, ${todoStats.pending} pending)\n`;
        }
        
        comment += `\n---\n\n`;

        // Final Analysis & Conclusions (main content)
        if (finalAnalysis) {
            comment += `## 🎯 Final Analysis & Conclusions\n\n`;
            comment += `${finalAnalysis}\n\n`;
            comment += `---\n\n`;
        } else {
            // Fallback summary if no final analysis
            comment += `## 🎯 Summary\n\n`;
            comment += `Analysis completed after ${totalIterations} iterations. `;
            comment += `Analyzed ${analyzedFiles.size} file${analyzedFiles.size !== 1 ? 's' : ''} and `;
            comment += `proposed ${proposedChanges.length} change${proposedChanges.length !== 1 ? 's' : ''}.\n\n`;
            comment += `---\n\n`;
        }

        // Proposed Changes (main content)
        if (proposedChanges.length > 0) {
            comment += `## 💡 Proposed Changes\n\n`;
            proposedChanges.forEach((change, idx) => {
                comment += this.formatProposedChange(change, idx + 1);
            });
            comment += `\n---\n\n`;
        } else {
            comment += `## 💡 Proposed Changes\n\n`;
            comment += `No specific code changes were proposed. The analysis focused on understanding the codebase structure and requirements.\n\n`;
            comment += `---\n\n`;
        }

        // Analyzed Files Summary (if relevant)
        if (analyzedFiles.size > 0 && analyzedFiles.size <= 10) {
            comment += `## 📄 Analyzed Files\n\n`;
            Array.from(analyzedFiles.values()).forEach(file => {
                comment += `- **\`${file.path}\`** (${file.relevance} relevance): ${file.key_findings.substring(0, 200)}${file.key_findings.length > 200 ? '...' : ''}\n`;
            });
            comment += `\n---\n\n`;
        }

        // TODO List Summary (if relevant)
        if (todoStats.total > 0) {
            comment += `## 📋 TODO List Summary\n\n`;
            const completedTodos = todoManager.getTodosByStatus(TodoStatus.COMPLETED);
            const activeTodos = todoManager.getActiveTodos();
            
            if (completedTodos.length > 0) {
                comment += `### ✅ Completed Tasks\n\n`;
                completedTodos.forEach(todo => {
                    comment += `- ${todo.content}\n`;
                });
                comment += `\n`;
            }
            
            if (activeTodos.length > 0) {
                comment += `### 🔄 Active/Pending Tasks\n\n`;
                activeTodos.forEach(todo => {
                    comment += `- ${todo.status === 'in_progress' ? '🔄' : '⏳'} ${todo.content}\n`;
                });
                comment += `\n`;
            }
            
            comment += `---\n\n`;
        }

        // COLLAPSED SECTION: Detailed Reasoning Steps
        comment += `<details>\n<summary><strong>🔄 Detailed Reasoning Steps (${steps.length} steps) - Click to expand</strong></summary>\n\n`;
        comment += `\n\n*This section contains the detailed step-by-step reasoning process. It's collapsed by default to keep the main analysis focused.*\n\n`;
        comment += `---\n\n`;

        const proposalShownFlags = new Set<number>();

        for (const step of steps) {
            comment += `### Step ${step.step_number}: ${this.getActionEmoji(step.action)} ${this.formatActionName(step.action)}\n\n`;
            
            // Show reasoning (truncated for collapsed section)
            if (step.reasoning) {
                const reasoningText = step.reasoning.length > 500 
                    ? `${step.reasoning.substring(0, 500)}...` 
                    : step.reasoning;
                comment += `${reasoningText}\n\n`;
            }

            // Show files involved (simplified)
            if (step.files_involved && step.files_involved.length > 0) {
                const uniqueFiles = [...new Set(step.files_involved)];
                comment += `**Files**: ${uniqueFiles.map(f => `\`${f}\``).join(', ')}\n\n`;
            }

            // Show file analysis (simplified)
            if (step.action === 'analyze_code' || step.action === 'read_file') {
                const relevantFiles = Array.from(analyzedFiles.values()).filter(f => 
                    step.files_involved?.includes(f.path)
                );
                
                const stepAnalysis = (step as { file_analysis_in_step?: FileAnalysis[] }).file_analysis_in_step;
                const filesToShow = stepAnalysis || relevantFiles;
                
                if (filesToShow.length > 0) {
                    comment += `**Analysis**: `;
                    filesToShow.forEach((file, idx) => {
                        if (idx > 0) comment += ` | `;
                        comment += `\`${file.path}\` (${file.relevance}): ${file.key_findings.substring(0, 100)}${file.key_findings.length > 100 ? '...' : ''}`;
                    });
                    comment += `\n\n`;
                }
            }

            // Show proposals (simplified reference)
            const stepProposals = (step as { proposals_in_step?: ProposedChange[] }).proposals_in_step;
            if (stepProposals && stepProposals.length > 0) {
                comment += `**Proposed Changes**: ${stepProposals.map(c => `${c.change_type} \`${c.file_path}\``).join(', ')}\n\n`;
                
                // Mark as shown
                stepProposals.forEach((change) => {
                    const globalIndex = proposedChanges.indexOf(change);
                    if (globalIndex >= 0) {
                        proposalShownFlags.add(globalIndex);
                    }
                });
            }

            comment += `---\n\n`;
        }

        comment += `\n</details>\n\n`;
        comment += `---\n\n`;

        // Footer
        comment += `*Analysis completed in ${totalIterations} iterations. Analyzed ${analyzedFiles.size} files and proposed ${proposedChanges.length} changes.*\n`;

        // Truncate if too long
        if (comment.length > this.GITHUB_COMMENT_MAX_LENGTH) {
            // Try to keep main content, truncate collapsed section
            const mainContent = comment.substring(0, comment.indexOf('<details>'));
            const truncated = mainContent + `\n\n<details>\n<summary><strong>🔄 Detailed Reasoning Steps - Truncated due to length</strong></summary>\n\n*Steps section was truncated due to comment length limits.*\n\n</details>\n\n`;
            if (truncated.length > this.GITHUB_COMMENT_MAX_LENGTH) {
                // If still too long, truncate main content
                const finalTruncated = truncated.substring(0, this.GITHUB_COMMENT_MAX_LENGTH - 200);
                return finalTruncated + `\n\n*[Comment truncated due to length limit]*\n`;
            }
            return truncated;
        }

        return comment;
    }

    /**
     * Format a single proposed change
     */
    formatProposedChange(change: ProposedChange, index: number): string {
        let formatted = `### ${index}. ${this.getChangeTypeEmoji(change.change_type)} ${change.change_type.toUpperCase()}: \`${change.file_path}\`\n\n`;
        
        formatted += `**Description**: ${change.description}\n\n`;
        
        if (change.reasoning) {
            formatted += `**Reasoning**: ${change.reasoning}\n\n`;
        }

        if (change.suggested_code) {
            const language = this.detectLanguageFromPath(change.file_path);
            formatted += `**Suggested Code**:\n\n`;
            formatted += `\`\`\`${language}\n${change.suggested_code}\n\`\`\`\n\n`;
        }

        formatted += `---\n\n`;
        
        return formatted;
    }

    /**
     * Detect programming language from file path/extension
     */
    detectLanguageFromPath(filePath: string): string {
        const extension = filePath.split('.').pop()?.toLowerCase() || '';
        
        const languageMap: { [key: string]: string } = {
            // TypeScript/JavaScript
            'ts': 'typescript',
            'tsx': 'tsx',
            'js': 'javascript',
            'jsx': 'jsx',
            'mjs': 'javascript',
            'cjs': 'javascript',
            
            // Python
            'py': 'python',
            'pyw': 'python',
            'pyi': 'python',
            
            // Java/Kotlin
            'java': 'java',
            'kt': 'kotlin',
            'kts': 'kotlin',
            
            // Go
            'go': 'go',
            
            // Rust
            'rs': 'rust',
            
            // C/C++
            'c': 'c',
            'cpp': 'cpp',
            'cc': 'cpp',
            'cxx': 'cpp',
            'h': 'c',
            'hpp': 'cpp',
            'hxx': 'cpp',
            
            // C#
            'cs': 'csharp',
            
            // Ruby
            'rb': 'ruby',
            
            // PHP
            'php': 'php',
            
            // Swift
            'swift': 'swift',
            
            // Dart
            'dart': 'dart',
            
            // Shell
            'sh': 'bash',
            'bash': 'bash',
            'zsh': 'bash',
            'fish': 'fish',
            
            // Configuration
            'json': 'json',
            'yaml': 'yaml',
            'yml': 'yaml',
            'toml': 'toml',
            'xml': 'xml',
            'ini': 'ini',
            'conf': 'conf',
            'config': 'conf',
            
            // Markup
            'html': 'html',
            'htm': 'html',
            'css': 'css',
            'scss': 'scss',
            'sass': 'sass',
            'less': 'less',
            'md': 'markdown',
            'markdown': 'markdown',
            
            // SQL
            'sql': 'sql',
            
            // Docker
            'dockerfile': 'dockerfile',
            'docker': 'dockerfile',
            
            // Other
            'txt': 'text',
            'log': 'text',
        };
        
        // Check for exact match
        if (languageMap[extension]) {
            return languageMap[extension];
        }
        
        // Check for Dockerfile (no extension)
        if (filePath.toLowerCase().includes('dockerfile')) {
            return 'dockerfile';
        }
        
        // Default to empty string if unknown
        return '';
    }

    /**
     * Get emoji for action type
     */
    getActionEmoji(action: string): string {
        const emojiMap: { [key: string]: string } = {
            'search_files': '🔍',
            'read_file': '📖',
            'analyze_code': '🔬',
            'propose_changes': '💡',
            'complete': '✅'
        };
        return emojiMap[action] || '📝';
    }

    /**
     * Format action name for display
     */
    formatActionName(action: string): string {
        const nameMap: { [key: string]: string } = {
            'search_files': 'Search Files',
            'read_file': 'Read Files',
            'analyze_code': 'Analyze Code',
            'propose_changes': 'Propose Changes',
            'complete': 'Complete'
        };
        return nameMap[action] || action;
    }

    /**
     * Get emoji for change type
     */
    getChangeTypeEmoji(changeType: string): string {
        const emojiMap: { [key: string]: string } = {
            'create': '✨',
            'modify': '📝',
            'delete': '🗑️',
            'refactor': '♻️'
        };
        return emojiMap[changeType] || '📝';
    }
}


/**
 * Status levels for TODO items
 */
export declare enum TodoStatus {
    PENDING = "pending",
    IN_PROGRESS = "in_progress",
    COMPLETED = "completed",
    CANCELLED = "cancelled"
}
/**
 * Actions for managing TODOs
 */
export declare enum TodoAction {
    CREATE = "create",
    UPDATE = "update",
    LIST = "list"
}
/**
 * Types of changes that can be proposed to files
 */
export declare enum ChangeType {
    CREATE = "create",
    MODIFY = "modify",
    DELETE = "delete",
    REFACTOR = "refactor"
}
export interface FileAnalysis {
    path: string;
    key_findings: string;
    relevance: 'high' | 'medium' | 'low';
}
export interface ProposedChange {
    file_path: string;
    change_type: ChangeType;
    description: string;
    suggested_code?: string;
    reasoning: string;
}
export interface ThinkResponse {
    reasoning: string;
    action: 'search_files' | 'read_file' | 'analyze_code' | 'propose_changes' | 'complete' | 'update_todos';
    files_to_search?: string[];
    files_to_read?: string[];
    analyzed_files?: FileAnalysis[];
    proposed_changes?: ProposedChange[];
    todo_updates?: {
        create?: Array<{
            content: string;
            status?: TodoStatus;
        }>;
        update?: Array<{
            id: string;
            status?: TodoStatus;
            notes?: string;
        }>;
    };
    complete: boolean;
    final_analysis?: string;
}
export interface ThinkStep {
    step_number: number;
    action: string;
    reasoning: string;
    files_involved?: string[];
    findings?: string;
    timestamp: number;
}
export interface ThinkTodoItem {
    id: string;
    content: string;
    status: TodoStatus;
    created_at: number;
    updated_at: number;
    completed_at?: number;
    related_files?: string[];
    related_changes?: string[];
    notes?: string;
}
export interface ThinkTodoList {
    items: ThinkTodoItem[];
    last_updated: number;
}

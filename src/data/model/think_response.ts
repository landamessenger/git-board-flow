export interface FileAnalysis {
    path: string;
    key_findings: string;
    relevance: 'high' | 'medium' | 'low';
}

export interface ProposedChange {
    file_path: string;
    change_type: 'create' | 'modify' | 'delete' | 'refactor';
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
        create?: Array<{ content: string; status?: 'pending' | 'in_progress' }>;
        update?: Array<{ id: string; status?: 'pending' | 'in_progress' | 'completed' | 'cancelled'; notes?: string }>;
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
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    created_at: number;
    updated_at: number;
    completed_at?: number;
    related_files?: string[];
    related_changes?: string[]; // IDs or descriptions of changes related to this task
    notes?: string; // Additional notes about progress or blockers
}

export interface ThinkTodoList {
    items: ThinkTodoItem[];
    last_updated: number;
}


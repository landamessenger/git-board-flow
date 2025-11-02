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
    action: 'search_files' | 'read_file' | 'analyze_code' | 'propose_changes' | 'complete';
    files_to_search?: string[];
    files_to_read?: string[];
    analyzed_files?: FileAnalysis[];
    proposed_changes?: ProposedChange[];
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

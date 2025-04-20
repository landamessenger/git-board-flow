export interface AiResponse {
    text_response: string;
    action: 'none' | 'analyze_files';
    related_files: string[];
    complete: boolean;
}
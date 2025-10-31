export type WorkflowStatus = "queued" | "in_progress" | "completed" | "requested" | "waiting" | "pending" | string;
export type WorkflowConclusion = "success" | "failure" | "cancelled" | "timed_out" | "neutral" | "skipped" | "stale" | string;
export declare class WorkflowRun {
    id: number;
    name: string;
    head_branch: string | null;
    head_sha: string;
    run_number: number;
    event: string;
    status: WorkflowStatus;
    conclusion: WorkflowConclusion | null;
    created_at: string;
    updated_at: string;
    url: string;
    html_url: string;
    constructor(data: {
        id: number;
        name: string;
        head_branch: string | null;
        head_sha: string;
        run_number: number;
        event: string;
        status: WorkflowStatus;
        conclusion: WorkflowConclusion | null;
        created_at: string;
        updated_at: string;
        url: string;
        html_url: string;
    });
    isActive(): boolean;
}

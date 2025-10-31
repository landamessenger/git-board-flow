// types.ts (o donde quieras definir tus modelos)

export type WorkflowStatus =
  | "queued"
  | "in_progress"
  | "completed"
  | "requested"
  | "waiting"
  | "pending"
  | string;  // para futuros estados

export type WorkflowConclusion =
  | "success"
  | "failure"
  | "cancelled"
  | "timed_out"
  | "neutral"
  | "skipped"
  | "stale"
  | string; // otros posibles valores

export class WorkflowRun {
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
  // puedes agregar más campos si los usas

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
  }) {
    this.id = data.id;
    this.name = data.name;
    this.head_branch = data.head_branch;
    this.head_sha = data.head_sha;
    this.run_number = data.run_number;
    this.event = data.event;
    this.status = data.status;
    this.conclusion = data.conclusion;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
    this.url = data.url;
    this.html_url = data.html_url;
  }

  isActive(): boolean {
    return this.status === "in_progress" || this.status === "queued";
  }
}

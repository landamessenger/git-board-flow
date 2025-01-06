export class Result {
    id: string;
    success: boolean;
    executed: boolean;
    steps: string[];
    payload: any;
    reminders: string[];
    errors: Error[];

    constructor(data: any) {
        this.id = data['id'] ?? '';
        this.success = data['success'] ?? false;
        this.executed = data['executed'] ?? false;
        this.steps = data['steps'] ?? [];
        this.errors = data['errors'] ?? [];
        this.payload = data['payload'];
        this.reminders = data['reminders'] ?? [];
    }
}
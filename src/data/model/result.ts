export class Result {
    id: string;
    success: boolean;
    executed: boolean;
    steps: string[];
    exception: Error | undefined;
    payload: any;
    reminders: string[];

    constructor(data: any) {
        this.id = data['id'] ?? '';
        this.success = data['success'] ?? false;
        this.executed = data['executed'] ?? false;
        this.steps = data['steps'] ?? [];
        this.exception = data['exception'];
        this.payload = data['payload'];
        this.reminders = data['reminders'] ?? [];
    }
}
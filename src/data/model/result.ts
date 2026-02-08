export class Result {
    id: string;
    success: boolean;
    executed: boolean;
    steps: string[];
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload shape varies by use case */
    payload: any;
    reminders: string[];
    errors: Error[];

    /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- result from use cases */
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
export declare class Result {
    id: string;
    success: boolean;
    executed: boolean;
    steps: string[];
    payload: any;
    reminders: string[];
    errors: Error[];
    constructor(data: any);
}

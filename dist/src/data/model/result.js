"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Result = void 0;
class Result {
    constructor(data) {
        this.id = data['id'] ?? '';
        this.success = data['success'] ?? false;
        this.executed = data['executed'] ?? false;
        this.steps = data['steps'] ?? [];
        this.errors = data['errors'] ?? [];
        this.payload = data['payload'];
        this.reminders = data['reminders'] ?? [];
    }
}
exports.Result = Result;

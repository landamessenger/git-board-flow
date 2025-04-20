"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Locale = void 0;
class Locale {
    constructor(issue, pullRequest) {
        this.issue = issue;
        this.pullRequest = pullRequest;
    }
}
exports.Locale = Locale;
Locale.DEFAULT = 'en-US';

export class Locale {
    static readonly DEFAULT = 'en-US';
    
    issue: string;
    pullRequest: string;

    constructor(issue: string, pullRequest: string) {
        this.issue = issue;
        this.pullRequest = pullRequest;
    }
}
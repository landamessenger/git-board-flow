
export class SizeThreshold {
    lines: number;
    files: number;
    commits: number;

    constructor(lines: number, files: number, commits: number) {
        this.lines = lines;
        this.files = files;
        this.commits = commits;
    }
}

export class Workflows {
    release: string;
    hotfix: string;

    constructor(
        release: string,
        hotfix: string,
    ) {
        this.release = release;
        this.hotfix = hotfix;
    }
}
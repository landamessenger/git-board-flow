export class Branches {
    main: string;
    development: string;
    replacedBranch: string | undefined;

    constructor(
        main: string,
        development: string,
    ) {
        this.main = main;
        this.development = development;
    }
}
export declare class Branches {
    main: string;
    development: string;
    featureTree: string;
    bugfixTree: string;
    hotfixTree: string;
    releaseTree: string;
    docsTree: string;
    choreTree: string;
    get defaultBranch(): string;
    constructor(main: string, development: string, featureTree: string, bugfixTree: string, hotfixTree: string, releaseTree: string, docsTree: string, choreTree: string);
}

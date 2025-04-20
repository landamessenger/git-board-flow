export declare class Commit {
    private inputs;
    constructor(inputs?: any | undefined);
    get branchReference(): string;
    get branch(): string;
    get commits(): any[];
}

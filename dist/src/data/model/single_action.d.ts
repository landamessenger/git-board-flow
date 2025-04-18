export declare class SingleAction {
    currentSingleAction: string;
    currentSingleActionIssue: number;
    actions: string[];
    isIssue: boolean;
    isPullRequest: boolean;
    isPush: boolean;
    get isDeployedAction(): boolean;
    get isVectorAction(): boolean;
    get isAskAction(): boolean;
    get enabledSingleAction(): boolean;
    get validSingleAction(): boolean;
    constructor(currentSingleAction: string, currentSingleActionIssue: string);
}

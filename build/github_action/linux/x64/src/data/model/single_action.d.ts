export declare class SingleAction {
    currentSingleAction: string;
    actions: string[];
    /**
     * Actions that throw an error if the last step failed
     */
    actionsThrowError: string[];
    /**
     * Actions that do not require an issue
     */
    actionsWithoutIssue: string[];
    isIssue: boolean;
    isPullRequest: boolean;
    isPush: boolean;
    /**
     * Properties
     */
    issue: number;
    version: string;
    title: string;
    changelog: string;
    get isDeployedAction(): boolean;
    get isVectorAction(): boolean;
    get isVectorLocalAction(): boolean;
    get isVectorRemovalAction(): boolean;
    get isPublishGithubAction(): boolean;
    get isCreateReleaseAction(): boolean;
    get isCreateTagAction(): boolean;
    get enabledSingleAction(): boolean;
    get validSingleAction(): boolean;
    get isSingleActionWithoutIssue(): boolean;
    get throwError(): boolean;
    constructor(currentSingleAction: string, issue: string, version: string, title: string, changelog: string);
}

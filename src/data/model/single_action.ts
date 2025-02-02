const deployedAction = 'deployed_action'

export class SingleAction {
    currentSingleAction: string;
    currentSingleActionIssue: string;
    actions: string[] = [deployedAction];
    enabledSingleAction: boolean;
    validSingleAction: boolean;

    get isDeployedAction(): boolean {
        return this.currentSingleAction === deployedAction;
    }

    constructor(
        currentSingleAction: string,
        currentSingleActionIssue: string,
    ) {
        this.currentSingleAction = currentSingleAction;
        this.currentSingleActionIssue = currentSingleActionIssue;
        this.enabledSingleAction = this.currentSingleAction.length > 0;
        this.validSingleAction = this.currentSingleAction.length > 0 &&
            this.currentSingleActionIssue.length > 0 &&
            this.actions.indexOf(this.currentSingleAction) > -1;
    }
}
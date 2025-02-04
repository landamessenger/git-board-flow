const deployedAction = 'deployed_action'

export class SingleAction {
    currentSingleAction: string;
    currentSingleActionIssue: number = -1;
    actions: string[] = [deployedAction];
    enabledSingleAction: boolean;
    validSingleAction: boolean;
    isIssue: boolean = false;
    isPullRequest: boolean = false;

    get isDeployedAction(): boolean {
        return this.currentSingleAction === deployedAction;
    }

    constructor(
        currentSingleAction: string,
        currentSingleActionIssue: string,
    ) {
        let validIssueNumber = false
        try {
            this.currentSingleActionIssue = parseInt(currentSingleActionIssue)
            validIssueNumber = true;
        } catch (error) {
            console.error(error)
            console.error(`Issue ${currentSingleActionIssue} is not a number.`)
        }
        this.currentSingleAction = currentSingleAction;
        this.enabledSingleAction = this.currentSingleAction.length > 0;
        this.validSingleAction = this.currentSingleAction.length > 0 &&
            this.currentSingleActionIssue > 0 &&
            validIssueNumber &&
            this.actions.indexOf(this.currentSingleAction) > -1;
    }
}
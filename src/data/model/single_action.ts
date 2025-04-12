import { logError } from "../../utils/logger";

const deployedAction = 'deployed_action'
const vectorAction = 'vector_action'

export class SingleAction {
    currentSingleAction: string;
    currentSingleActionIssue: number = -1;
    actions: string[] = [deployedAction, vectorAction];
    enabledSingleAction: boolean;
    validSingleAction: boolean;
    isIssue: boolean = false;
    isPullRequest: boolean = false;
    isPush: boolean = false;

    get isDeployedAction(): boolean {
        return this.currentSingleAction === deployedAction;
    }

    get isVectorAction(): boolean {
        return this.currentSingleAction === vectorAction;
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
            logError(`Issue ${currentSingleActionIssue} is not a number.`)
            logError(error)
        }
        this.currentSingleAction = currentSingleAction;
        this.enabledSingleAction = this.currentSingleAction.length > 0;
        this.validSingleAction = this.currentSingleAction.length > 0 &&
            this.currentSingleActionIssue > 0 &&
            validIssueNumber &&
            this.actions.indexOf(this.currentSingleAction) > -1;
    }
}
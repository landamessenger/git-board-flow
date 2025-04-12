import { logError } from "../../utils/logger";

const deployedAction = 'deployed_action'
const vectorAction = 'vector_action'

export class SingleAction {
    currentSingleAction: string;
    currentSingleActionIssue: number = -1;
    actions: string[] = [deployedAction, vectorAction];
    isIssue: boolean = false;
    isPullRequest: boolean = false;
    isPush: boolean = false;

    get isDeployedAction(): boolean {
        return this.currentSingleAction === deployedAction;
    }

    get isVectorAction(): boolean {
        return this.currentSingleAction === vectorAction;
    }

    get enabledSingleAction(): boolean {
        return this.currentSingleAction.length > 0;
    }

    get validSingleAction(): boolean {
        return this.enabledSingleAction &&
        this.currentSingleActionIssue > 0 &&
        this.actions.indexOf(this.currentSingleAction) > -1;
    }

    constructor(
        currentSingleAction: string,
        currentSingleActionIssue: string,
    ) {
        try {
            this.currentSingleActionIssue = parseInt(currentSingleActionIssue)
        } catch (error) {
            logError(`Issue ${currentSingleActionIssue} is not a number.`)
            logError(error)
        }
        this.currentSingleAction = currentSingleAction;
    }
}
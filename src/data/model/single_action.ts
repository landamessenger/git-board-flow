import { ACTIONS } from "../../utils/constants";
import { logError } from "../../utils/logger";

export class SingleAction {
    currentSingleAction: string;
    currentSingleActionIssue: number = -1;
    actions: string[] = [ACTIONS.DEPLOYED, ACTIONS.VECTOR];
    isIssue: boolean = false;
    isPullRequest: boolean = false;
    isPush: boolean = false;

    get isDeployedAction(): boolean {
        return this.currentSingleAction === ACTIONS.DEPLOYED;
    }

    get isVectorAction(): boolean {
        return this.currentSingleAction === ACTIONS.VECTOR;
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
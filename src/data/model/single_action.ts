import { ACTIONS } from "../../utils/constants";
import { logError } from "../../utils/logger";

export class SingleAction {
    currentSingleAction: string;
    actions: string[] = [
        ACTIONS.DEPLOYED,
        ACTIONS.VECTOR,
        ACTIONS.VECTOR_LOCAL,
        ACTIONS.VECTOR_REMOVAL,
        ACTIONS.PUBLISH_GITHUB_ACTION,
        ACTIONS.CREATE_TAG,
    ];
    /**
     * Actions that throw an error if the last step failed
     */
    actionsThrowError: string[] = [
       ACTIONS.PUBLISH_GITHUB_ACTION,
       ACTIONS.CREATE_RELEASE,
       ACTIONS.DEPLOYED,
       ACTIONS.CREATE_TAG,
    ];
    isIssue: boolean = false;
    isPullRequest: boolean = false;
    isPush: boolean = false;

    /**
     * Properties
     */
    issue: number = -1;
    version: string = '';
    title: string = '';
    changelog: string = '';

    get isDeployedAction(): boolean {
        return this.currentSingleAction === ACTIONS.DEPLOYED;
    }

    get isVectorAction(): boolean {
        return this.currentSingleAction === ACTIONS.VECTOR || this.currentSingleAction === ACTIONS.VECTOR_LOCAL;
    }

    get isVectorLocalAction(): boolean {
        return this.currentSingleAction === ACTIONS.VECTOR_LOCAL;
    }

    get isVectorRemovalAction(): boolean {
        return this.currentSingleAction === ACTIONS.VECTOR_REMOVAL;
    }

    get isPublishGithubAction(): boolean {
        return this.currentSingleAction === ACTIONS.PUBLISH_GITHUB_ACTION;
    }

    get isCreateReleaseAction(): boolean {
        return this.currentSingleAction === ACTIONS.CREATE_RELEASE;
    }

    get isCreateTagAction(): boolean {
        return this.currentSingleAction === ACTIONS.CREATE_TAG;
    }

    get enabledSingleAction(): boolean {
        return this.currentSingleAction.length > 0;
    }

    get validSingleAction(): boolean {
        return this.enabledSingleAction &&
        this.issue > 0 &&
        this.actions.indexOf(this.currentSingleAction) > -1;
    }

    get throwError(): boolean {
        return this.actionsThrowError.indexOf(this.currentSingleAction) > -1;
    }

    constructor(
        currentSingleAction: string,
        issue: string,
        version: string,
        title: string,
        changelog: string,
    ) {
        this.version = version;
        this.title = title;
        this.changelog = changelog;
        try {
            this.issue = parseInt(issue)
        } catch (error) {
            logError(`Issue ${issue} is not a number.`)
            logError(error)
        }
        this.currentSingleAction = currentSingleAction;
    }
}
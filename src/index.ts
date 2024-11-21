import * as core from '@actions/core';
import {PullRequestLinkUseCase} from "./data/usecase/pull_request_link_use_case";
import {IssueLinkUseCase} from "./data/usecase/issue_link_use_case";

async function run(): Promise<void> {
    const action = core.getInput('action', {required: true});

    try {
        if (action === 'issue') {
            await new IssueLinkUseCase().invoke()
        } else if (action === 'pull_request') {
            await new PullRequestLinkUseCase().invoke()
        } else {
            core.info(`Action not handled: ${action}`);
        }
    } catch (error: any) {
        core.setFailed(error.message);
    }
}

run();

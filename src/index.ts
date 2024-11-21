import * as core from '@actions/core';
import {PullRequestLinkUseCase} from "./data/usecase/pull_request_link_use_case";

async function run(): Promise<void> {
    const action = core.getInput('action', {required: true});
    const defaultBranch = core.getInput('defaultBranch', {required: true});
    const developmentBranch = core.getInput('developmentBranch', {required: true});

    try {
        if (action === 'pull_request_linker') {
            await new PullRequestLinkUseCase().invoke()
        } else {
            core.info(`Action not handled: ${action}`);
        }
    } catch (error: any) {
        core.setFailed(error.message);
    }
}

run();

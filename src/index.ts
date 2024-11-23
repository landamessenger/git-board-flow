import * as core from '@actions/core';
import {PullRequestLinkUseCase} from "./data/usecase/pull_request_link_use_case";
import {IssueLinkUseCase} from "./data/usecase/issue_link_use_case";
import {ProjectRepository} from "./data/repository/project_repository";
import {ProjectDetail} from "./data/model/project_detail";
import {Execution} from "./data/model/execution";
import {Tokens} from "./data/model/tokens";
import {Labels} from "./data/model/labels";
import {Branches} from "./data/model/branches";
import {Hotfix} from "./data/model/hotfix";
import {RemoveIssueBranchesUseCase} from "./data/usecase/remove_issue_branches_use_case";

async function run(): Promise<void> {
    const projectRepository = new ProjectRepository();
    const action = core.getInput('action', {required: true});

    /**
     * Tokens
     */
    const token = core.getInput('github-token', {required: true});
    const tokenPat = core.getInput('github-token-personal', {required: true});

    /**
     * Projects Details
     */
    const projectUrlsInput = core.getInput('project-urls', {required: true});
    const projectUrls: string[] = projectUrlsInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);

    const projects: ProjectDetail[] = []
    for (const projectUrl of projectUrls) {
        const detail = await projectRepository.getProjectDetail(projectUrl, tokenPat)
        projects.push(detail)
    }

    /**
     * Runs always
     */
    const runAlways = core.getInput('run-always', {required: true}) === 'true';

    /**
     * Labels
     */
    const actionLauncherLabel = core.getInput('action-launcher-label', {required: true});
    const bugfixLabel = core.getInput('bugfix-label', {required: true});
    const hotfixLabel = core.getInput('hotfix-label', {required: true});

    /**
     * Branches
     */
    const mainBranch = core.getInput('main-branch', {required: true});
    const developmentBranch = core.getInput('development-branch', {required: true});

    const execution = new Execution(
        runAlways,
        action === 'issue',
        action === 'pull-request',
        new Tokens(token, tokenPat),
        new Labels(
            actionLauncherLabel,
            bugfixLabel,
            hotfixLabel,
        ),
        new Branches(
            mainBranch,
            developmentBranch
        ),
        new Hotfix(),
        projects
    )

    await execution.setup();

    if (execution.number === -1) {
        core.setFailed(`Issue ${execution.number}. Skipping.`);
        return;
    }

    if (execution.issueAction && !execution.mustRun) {
        await new RemoveIssueBranchesUseCase().invoke(execution);
        return;
    }

    if (!execution.mustRun) {
        core.setFailed(`Issue ${execution.number}. Skipping.`);
        return;
    }

    try {
        if (execution.issueAction) {
            await new IssueLinkUseCase().invoke(execution)
        } else if (execution.pullRequestAction) {
            await new PullRequestLinkUseCase().invoke(execution)
        } else {
            core.setFailed(`Action not handled: ${action}`);
        }
    } catch (error: any) {
        core.setFailed(error.message);
    }
}

run();

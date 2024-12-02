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
import {Result} from "./data/model/result";
import {PublishResultUseCase} from "./data/usecase/publish_resume_use_case";
import {StoreConfigurationUseCase} from "./data/usecase/store_configuration_use_case";
import {Images} from "./data/model/images";
import {CommitCheckUseCase} from "./data/usecase/commit_check_use_case";
import {Emoji} from "./data/model/emoji";

async function run(): Promise<void> {
    const projectRepository = new ProjectRepository();

    /**
     * Tokens
     */
    const token = core.getInput('github-token', {required: true});
    const tokenPat = core.getInput('github-token-personal', {required: true});

    /**
     * Projects Details
     */
    const projectUrlsInput = core.getInput('project-urls');
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
     * Images
     */
    const imagesUrlsCleanUpInput = core.getInput('images-clean-up');
    const imagesUrlsCleanUp: string[] = imagesUrlsCleanUpInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);


    const imagesUrlsFeatureInput = core.getInput('images-feature');
    const imagesUrlsFeature: string[] = imagesUrlsFeatureInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);


    const imagesUrlsBugfixInput = core.getInput('images-bugfix');
    const imagesUrlsBugfix: string[] = imagesUrlsBugfixInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);


    const imagesUrlsHotfixInput = core.getInput('images-hotfix');
    const imagesUrlsHotfix: string[] = imagesUrlsHotfixInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);

    const imagesUrlsPrLinkInput = core.getInput('images-pr-link');
    const imagesUrlsPrLink: string[] = imagesUrlsPrLinkInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);


    /**
     * Runs always
     */
    const branchManagementAlways = core.getInput('branch-management-always') === 'true';

    /**
     * Emoji-title
     */
    const titleEmoji = core.getInput('emoji-labeled-title') === 'true';
    const branchManagementEmoji = core.getInput('branch-management-emoji');

    /**
     * Labels
     */
    const branchManagementLauncherLabel = core.getInput('branch-management-launcher-label');
    const bugfixLabel = core.getInput('bugfix-label');
    const bugLabel = core.getInput('bug-label');
    const hotfixLabel = core.getInput('hotfix-label');
    const enhancementLabel = core.getInput('enhancement-label');
    const featureLabel = core.getInput('feature-label');
    const releaseLabel = core.getInput('release-label');
    const questionLabel = core.getInput('question-label');
    const helpLabel = core.getInput('help-label');

    /**
     * Branches
     */
    const mainBranch = core.getInput('main-branch');
    const developmentBranch = core.getInput('development-branch');
    const featureTree = core.getInput('feature-tree');
    const bugfixTree = core.getInput('bugfix-tree');
    const hotfixTree = core.getInput('hotfix-tree');
    const releaseTree = core.getInput('release-tree');

    const commitPrefixBuilder = core.getInput('commit-prefix-builder') ?? '';

    const execution = new Execution(
        branchManagementAlways,
        commitPrefixBuilder,
        new Emoji(
            titleEmoji,
            branchManagementEmoji,
        ),
        new Images(
            imagesUrlsCleanUp,
            imagesUrlsFeature,
            imagesUrlsBugfix,
            imagesUrlsHotfix,
            imagesUrlsPrLink,
        ),
        new Tokens(token, tokenPat),
        new Labels(
            branchManagementLauncherLabel,
            bugLabel,
            bugfixLabel,
            hotfixLabel,
            enhancementLabel,
            featureLabel,
            releaseLabel,
            questionLabel,
            helpLabel,
        ),
        new Branches(
            mainBranch,
            developmentBranch,
            featureTree,
            bugfixTree,
            hotfixTree,
            releaseTree,
        ),
        new Hotfix(),
        projects
    )

    await execution.setup();

    if (execution.number === -1) {
        core.info(`Issue number not found. Skipping.`);
        return;
    }

    const results: Result[] = []

    try {
        if (execution.isIssue) {
            results.push(...await new IssueLinkUseCase().invoke(execution));
        } else if (execution.isPullRequest) {
            results.push(...await new PullRequestLinkUseCase().invoke(execution));
        } else if (execution.isPush) {
            results.push(...await new CommitCheckUseCase().invoke(execution));
        } else {
            core.setFailed(`Action not handled.`);
        }

        await finishWithResults(execution, results)
    } catch (error: any) {
        core.setFailed(error.message);
    }
}

async function finishWithResults(execution: Execution, results: Result[]): Promise<void> {
    execution.currentConfiguration.results = results;
    await new PublishResultUseCase().invoke(execution)
    await new StoreConfigurationUseCase().invoke(execution)
}

run();

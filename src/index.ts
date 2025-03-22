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
import {Issue} from "./data/model/issue";
import {PullRequest} from "./data/model/pull_request";
import {Workflows} from "./data/model/workflows";
import {Release} from "./data/model/release";
import {SingleAction} from "./data/model/single_action";
import {SingleActionUseCase} from "./data/usecase/single_action_use_case";
import { Ai } from './data/model/ai';

const DEFAULT_IMAGE_CONFIG = {
    issue: {
        automatic: [
            "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExYzRsNGFicndqMXgzMTVwdnhpeXNyZGsydXVxamV4eGxndWhna291OSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/ktcUyw6mBlMVa/200.webp",
            "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExdjkyeWVubngzM28xODFrbXZ4Nng3Y2hubmM4cXJqNGpic3Bheml0NSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/M11UVCRrc0LUk/giphy.webp",
            "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExenQwNDJmZnZraDBzNXBoNjUwZjEzMzFlanMxcHVodmF4b3l3bDl2biZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/zrdUjl6N99nLq/200.webp",
            "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExbmozN3plMWNiYjZoemh6N2RmeTB1MG9ieHlqYTJsb3BrZmNoY3h0dyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/stv1Dliu5TrMs/giphy.webp"
        ],
        feature: [
            "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExYmc4YWplZWs0Y2c3ZXNtbGpwZnQzdWpncmNjNXpodjg3MHdtbnJ5NiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/OMK7LRBedcnhm/200.webp",
            "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHBrYXpmd2poeGU5cWswbjRqNmJlZ2U2dWc0ejVpY3RpcXVuYTY3dSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/llKJGxQ1ESmac/giphy.webp",
            "https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExMnFleXV0MXZteGN6c2s2b3R3ZGc2cWY1aXB0Y3ZzNmpvZHhyNDVmNSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/10FwycrnAkpshW/giphy.webp",
            "https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExdmM1OWR0cnk5eXI0dXpoNWRzbmVseTVyd2l3MzdrOHZueHJ6bjhjMiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/12yjKJaLB7DuG4/giphy.webp"
        ],
        bugfix: [
            "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExazc3OWszenA5c2FlemE3a25oNnlmZDBra3liMWRqMW82NzM2b2FveCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/xPGkOAdiIO3Is/giphy.webp",
            "https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExYmFoaHdqMG10eHUzb2toZzJra3pibXZ0NHk5NnRnazE3YmFiNGV1ZyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/OspWhQ8YttRf8QxDOh/giphy.webp",
            "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExY3liaGF2NzI3bzM1YjRmdHFsaGdyenp4b3o3M3dqM3F0bGN5MHZtNSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/npUpB306c3EStRK6qP/200.webp",
            "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExZWh6d3Nld3E0MTF1eTk2YXFibnI3MTBhbGtpamJiemRwejl3YmkzMSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/gU25raLP4pUu4/giphy.webp"
        ],
        hotfix: [
            "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExd2R0cjNxbXBjZjRjNmg4NmN3MGlhazVkNHJsaDkxMHZkY2hweGRtZSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/pCU4bC7kC6sxy/200.webp",
            "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExenkyZTc3aDlweWl0MnI0cXJsZGptY3g0bzE2NTY1aWMyaHd4Y201ZiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/dbtDDSvWErdf2/giphy.webp",
            "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExM25ndGd2d3Uya3g3dnlnenJ1bjh0Y2NtNHdwZHY3Mjh2NnBmZDJpbyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/2xF8gHUf085aNyyAQR/200.webp",
            "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExdjU3bHdsc3FtamlyazBlbWppNHc3MTV3MW4xdHd2cWo4b2tzbTkwcSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/1EghTrigJJhq8/200.webp"
        ],
        release: [
            "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExY2NxcHEzam92enRtd29xc21pMHhmbHozMWljamF1cmt4cjhwZTI0ayZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/PApUm1HPVYlDNLoMmr/giphy.webp",
            "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExNXU4dnhwOWVqZzc4NXVsdTY3c2I4Mm9lOHF1c253MDJya25zNXU0ZyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/dxn6fRlTIShoeBr69N/giphy.webp",
            "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExbXN2bjJob3pxazE2NDJhbGE3ZWY5d2dzbDM4czgwZnA4ejlxY3ZqeCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/9D37RaHngWP7ZmmsEt/giphy.webp"
        ],
        docs: [],
        chore: []
    },
    pullRequest: {
        automatic: [
            "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExb2l4d25hNjEyNHRpN3NldzhsOGI2d2liZDdjYzcxdGFqb3E5N2FmOSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/2UHbv8WT6TKBeeP9Mt/giphy.webp",
            "https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3FzdHFnMmRtMzNqZzRtc3M5ZzJpcTEwMzcxc3E2b2M2em9yOXdlMyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/MOGOpGFr52Rm5wZjJx/giphy.webp",
            "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExeGE5cHZsbjlybXBleXEwdDJ2N2N5enR6OGtoZjJqcjVncHZpNWJmciZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/d2Z9QYzA2aidiWn6/giphy.webp"
        ],
        feature: [],
        bugfix: [],
        hotfix: [],
        release: [],
        docs: [],
        chore: []
    }
};

async function run(): Promise<void> {
    const projectRepository = new ProjectRepository();

    /**
     * Single action
     */
    const singleAction = core.getInput('single-action');
    const singleActionIssue = core.getInput('single-action-issue');

    /**
     * Tokens
     */
    const token = core.getInput('github-token', {required: true});
    const tokenPat = core.getInput('github-token-personal', {required: true});

    /**
     * AI
     */
    const openaiApiKey = core.getInput('openai-api-key');
    const aiPullRequestDescription = core.getInput('ai-pull-request-description') === 'true';
    const aiMembersOnly = core.getInput('ai-members-only') === 'true';
    const aiIgnoreFilesInput = core.getInput('ai-ignore-files');
    const aiIgnoreFiles: string[] = aiIgnoreFilesInput
        .split(',')
        .map(path => path.trim())
        .filter(path => path.length > 0);

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
    const imagesOnIssue = core.getInput('images-on-issue') === 'true';
    const imagesOnPullRequest = core.getInput('images-on-pull-request') === 'true';

    const imagesIssueAutomaticInput = core.getInput('images-issue-automatic');
    const imagesIssueAutomatic: string[] = imagesIssueAutomaticInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    
    if (imagesIssueAutomatic.length === 0) {
        imagesIssueAutomatic.push(...DEFAULT_IMAGE_CONFIG.issue.automatic);
    }

    const imagesIssueFeatureInput = core.getInput('images-issue-feature');
    const imagesIssueFeature: string[] = imagesIssueFeatureInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    
    if (imagesIssueFeature.length === 0) {
        imagesIssueFeature.push(...DEFAULT_IMAGE_CONFIG.issue.feature);
    }

    const imagesIssueBugfixInput = core.getInput('images-issue-bugfix');
    const imagesIssueBugfix: string[] = imagesIssueBugfixInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    
    if (imagesIssueBugfix.length === 0) {
        imagesIssueBugfix.push(...DEFAULT_IMAGE_CONFIG.issue.bugfix);
    }

    const imagesIssueDocsInput = core.getInput('images-issue-docs');
    const imagesIssueDocs: string[] = imagesIssueDocsInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    
    if (imagesIssueDocs.length === 0) {
        imagesIssueDocs.push(...DEFAULT_IMAGE_CONFIG.issue.docs);
    }

    const imagesIssueChoreInput = core.getInput('images-issue-chore');
    const imagesIssueChore: string[] = imagesIssueChoreInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    
    if (imagesIssueChore.length === 0) {
        imagesIssueChore.push(...DEFAULT_IMAGE_CONFIG.issue.chore);
    }

    const imagesIssueReleaseInput = core.getInput('images-issue-release');
    const imagesIssueRelease: string[] = imagesIssueReleaseInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    
    if (imagesIssueRelease.length === 0) {
        imagesIssueRelease.push(...DEFAULT_IMAGE_CONFIG.issue.release);
    }

    const imagesIssueHotfixInput = core.getInput('images-issue-hotfix');
    const imagesIssueHotfix: string[] = imagesIssueHotfixInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    
    if (imagesIssueHotfix.length === 0) {
        imagesIssueHotfix.push(...DEFAULT_IMAGE_CONFIG.issue.hotfix);
    }

    const imagesPullRequestAutomaticInput = core.getInput('images-pull-request-automatic');
    const imagesPullRequestAutomatic: string[] = imagesPullRequestAutomaticInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    
    if (imagesPullRequestAutomatic.length === 0) {
        imagesPullRequestAutomatic.push(...DEFAULT_IMAGE_CONFIG.pullRequest.automatic);
    }

    const imagesPullRequestFeatureInput = core.getInput('images-pull-request-feature');
    const imagesPullRequestFeature: string[] = imagesPullRequestFeatureInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    
    if (imagesPullRequestFeature.length === 0) {
        imagesPullRequestFeature.push(...DEFAULT_IMAGE_CONFIG.pullRequest.feature);
    }

    const imagesPullRequestBugfixInput = core.getInput('images-pull-request-bugfix');
    const imagesPullRequestBugfix: string[] = imagesPullRequestBugfixInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    
    if (imagesPullRequestBugfix.length === 0) {
        imagesPullRequestBugfix.push(...DEFAULT_IMAGE_CONFIG.pullRequest.bugfix);
    }

    const imagesPullRequestReleaseInput = core.getInput('images-pull-request-release');
    const imagesPullRequestRelease: string[] = imagesPullRequestReleaseInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    
    if (imagesPullRequestRelease.length === 0) {
        imagesPullRequestRelease.push(...DEFAULT_IMAGE_CONFIG.pullRequest.release);
    }

    const imagesPullRequestHotfixInput = core.getInput('images-pull-request-hotfix');
    const imagesPullRequestHotfix: string[] = imagesPullRequestHotfixInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    
    if (imagesPullRequestHotfix.length === 0) {
        imagesPullRequestHotfix.push(...DEFAULT_IMAGE_CONFIG.pullRequest.hotfix);
    }

    const imagesPullRequestDocsInput = core.getInput('images-pull-request-docs');
    const imagesPullRequestDocs: string[] = imagesPullRequestDocsInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    
    if (imagesPullRequestDocs.length === 0) {
        imagesPullRequestDocs.push(...DEFAULT_IMAGE_CONFIG.pullRequest.docs);
    }

    const imagesPullRequestChoreInput = core.getInput('images-pull-request-chore');
    const imagesPullRequestChore: string[] = imagesPullRequestChoreInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    
    if (imagesPullRequestChore.length === 0) {
        imagesPullRequestChore.push(...DEFAULT_IMAGE_CONFIG.pullRequest.chore);
    }

    /**
     * Workflows
     */
    const releaseWorkflow = core.getInput('release-workflow');
    const hotfixWorkflow = core.getInput('hotfix-workflow');

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
    const deployLabel = core.getInput('deploy-label');
    const deployedLabel = core.getInput('deployed-label');
    const docsLabel = core.getInput('docs-label');
    const documentationLabel = core.getInput('documentation-label');
    const choreLabel = core.getInput('chore-label');
    const maintenanceLabel = core.getInput('maintenance-label');

    /**
     * Branches
     */
    const mainBranch = core.getInput('main-branch');
    const developmentBranch = core.getInput('development-branch');
    const featureTree = core.getInput('feature-tree');
    const bugfixTree = core.getInput('bugfix-tree');
    const hotfixTree = core.getInput('hotfix-tree');
    const releaseTree = core.getInput('release-tree');
    const docsTree = core.getInput('docs-tree');
    const choreTree = core.getInput('chore-tree');

    /**
     * Prefix builder
     */
    const commitPrefixBuilder = core.getInput('commit-prefix-builder') ?? '';

    /**
     * Issue
     */
    const branchManagementAlways = core.getInput('branch-management-always') === 'true';
    const reopenIssueOnPush = core.getInput('reopen-issue-on-push') === 'true';
    const issueDesiredAssigneesCount = parseInt(core.getInput('desired-assignees-count')) ?? 0;

    /**
     * Pull Request
     */
    const pullRequestDesiredAssigneesCount = parseInt(core.getInput('desired-assignees-count')) ?? 0;
    const pullRequestDesiredReviewersCount = parseInt(core.getInput('desired-reviewers-count')) ?? 0;
    const pullRequestMergeTimeout = parseInt(core.getInput('merge-timeout')) ?? 0;

    const execution = new Execution(
        new SingleAction(
            singleAction,
            singleActionIssue,
        ),
        commitPrefixBuilder,
        new Issue(
            branchManagementAlways,
            reopenIssueOnPush,
            issueDesiredAssigneesCount
        ),
        new PullRequest(
            pullRequestDesiredAssigneesCount,
            pullRequestDesiredReviewersCount,
            pullRequestMergeTimeout,
        ),
        new Emoji(
            titleEmoji,
            branchManagementEmoji,
        ),
        new Images(
            imagesOnIssue,
            imagesOnPullRequest,
            imagesIssueAutomatic,
            imagesIssueFeature,
            imagesIssueBugfix,
            imagesIssueDocs,
            imagesIssueChore,
            imagesIssueRelease,
            imagesIssueHotfix,
            imagesPullRequestAutomatic,
            imagesPullRequestFeature,
            imagesPullRequestBugfix,
            imagesPullRequestRelease,
            imagesPullRequestHotfix,
            imagesPullRequestDocs,
            imagesPullRequestChore,
        ),
        new Tokens(token, tokenPat),
        new Ai(
            openaiApiKey,
            aiPullRequestDescription,
            aiMembersOnly,
            aiIgnoreFiles,
        ),
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
            deployLabel,
            deployedLabel,
            docsLabel,
            documentationLabel,
            choreLabel,
            maintenanceLabel,
        ),
        new Branches(
            mainBranch,
            developmentBranch,
            featureTree,
            bugfixTree,
            hotfixTree,
            releaseTree,
            docsTree,
            choreTree,
        ),
        new Release(),
        new Hotfix(),
        new Workflows(
            releaseWorkflow,
            hotfixWorkflow,
        ),
        projects
    )

    await execution.setup();

    if (execution.issueNumber === -1) {
        core.info(`Issue number not found. Skipping.`);
        return;
    }

    const results: Result[] = []

    try {
        if (execution.isSingleAction) {
            results.push(...await new SingleActionUseCase().invoke(execution));
        } else if (execution.isIssue) {
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

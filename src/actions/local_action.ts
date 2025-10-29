import chalk from 'chalk';
import { Ai } from '../data/model/ai';
import { Branches } from '../data/model/branches';
import { DockerConfig } from '../data/model/docker_config';
import { Emoji } from '../data/model/emoji';
import { Execution } from '../data/model/execution';
import { Hotfix } from '../data/model/hotfix';
import { Images } from '../data/model/images';
import { Issue } from '../data/model/issue';
import { IssueTypes } from '../data/model/issue_types';
import { Labels } from '../data/model/labels';
import { Locale } from '../data/model/locale';
import { ProjectDetail } from '../data/model/project_detail';
import { Projects } from '../data/model/projects';
import { PullRequest } from '../data/model/pull_request';
import { Release } from '../data/model/release';
import { SingleAction } from '../data/model/single_action';
import { SizeThreshold } from '../data/model/size_threshold';
import { SizeThresholds } from '../data/model/size_thresholds';
import { SupabaseConfig } from '../data/model/supabase_config';
import { Tokens } from '../data/model/tokens';
import { Welcome } from '../data/model/welcome';
import { Workflows } from '../data/model/workflows';
import { ProjectRepository } from '../data/repository/project_repository';
import { DEFAULT_IMAGE_CONFIG, INPUT_KEYS, TITLE } from '../utils/constants';
import { logInfo } from '../utils/logger';
import { getActionInputsWithDefaults } from '../utils/yml_utils';
import { mainRun } from './common_action';
import boxen from 'boxen';

export async function runLocalAction(additionalParams: any): Promise<void> {
    const projectRepository = new ProjectRepository();

    const actionInputs = getActionInputsWithDefaults();
    
    /**
     * Debug
     */
    const debug = (additionalParams[INPUT_KEYS.DEBUG] ?? actionInputs[INPUT_KEYS.DEBUG]) == 'true'

    /**
     * Welcome
     */
    const welcomeTitle = additionalParams[INPUT_KEYS.WELCOME_TITLE] ?? actionInputs[INPUT_KEYS.WELCOME_TITLE];
    const welcomeMessages = additionalParams[INPUT_KEYS.WELCOME_MESSAGES] ?? actionInputs[INPUT_KEYS.WELCOME_MESSAGES];

    /**
     * Docker
     */
    const dockerContainerName = additionalParams[INPUT_KEYS.DOCKER_CONTAINER_NAME] ?? actionInputs[INPUT_KEYS.DOCKER_CONTAINER_NAME];
    const dockerDomain = additionalParams[INPUT_KEYS.DOCKER_DOMAIN] ?? actionInputs[INPUT_KEYS.DOCKER_DOMAIN];
    const dockerPort = parseInt(additionalParams[INPUT_KEYS.DOCKER_PORT] ?? actionInputs[INPUT_KEYS.DOCKER_PORT]);
    const dockerCacheOs = additionalParams[INPUT_KEYS.DOCKER_CACHE_OS] ?? actionInputs[INPUT_KEYS.DOCKER_CACHE_OS];
    const dockerCacheArch = additionalParams[INPUT_KEYS.DOCKER_CACHE_ARCH] ?? actionInputs[INPUT_KEYS.DOCKER_CACHE_ARCH];

    /**
     * Single action
     */
    const singleAction = additionalParams[INPUT_KEYS.SINGLE_ACTION] ?? actionInputs[INPUT_KEYS.SINGLE_ACTION];
    const singleActionIssue = additionalParams[INPUT_KEYS.SINGLE_ACTION_ISSUE] ?? actionInputs[INPUT_KEYS.SINGLE_ACTION_ISSUE];
    const singleActionVersion = additionalParams[INPUT_KEYS.SINGLE_ACTION_VERSION] ?? actionInputs[INPUT_KEYS.SINGLE_ACTION_VERSION];
    const singleActionTitle = additionalParams[INPUT_KEYS.SINGLE_ACTION_TITLE] ?? actionInputs[INPUT_KEYS.SINGLE_ACTION_TITLE];
    const singleActionChangelog = additionalParams[INPUT_KEYS.SINGLE_ACTION_CHANGELOG] ?? actionInputs[INPUT_KEYS.SINGLE_ACTION_CHANGELOG];

    /**
     * Tokens
     */
    const token = additionalParams[INPUT_KEYS.TOKEN] ?? actionInputs[INPUT_KEYS.TOKEN];
    const classicToken = additionalParams[INPUT_KEYS.CLASSIC_TOKEN] ?? actionInputs[INPUT_KEYS.CLASSIC_TOKEN];

    /**
     * AI
     */
    const openrouterApiKey = additionalParams[INPUT_KEYS.OPENROUTER_API_KEY] ?? actionInputs[INPUT_KEYS.OPENROUTER_API_KEY];
    const openrouterModel = additionalParams[INPUT_KEYS.OPENROUTER_MODEL] ?? actionInputs[INPUT_KEYS.OPENROUTER_MODEL];
    const aiPullRequestDescription = (additionalParams[INPUT_KEYS.AI_PULL_REQUEST_DESCRIPTION] ?? actionInputs[INPUT_KEYS.AI_PULL_REQUEST_DESCRIPTION]) === 'true';
    const aiMembersOnly = (additionalParams[INPUT_KEYS.AI_MEMBERS_ONLY] ?? actionInputs[INPUT_KEYS.AI_MEMBERS_ONLY]) === 'true';
    const aiIncludeReasoning = (additionalParams[INPUT_KEYS.AI_INCLUDE_REASONING] ?? actionInputs[INPUT_KEYS.AI_INCLUDE_REASONING]) === 'true';
    const aiIgnoreFilesInput: string = additionalParams[INPUT_KEYS.AI_IGNORE_FILES] ?? actionInputs[INPUT_KEYS.AI_IGNORE_FILES];
    const aiIgnoreFiles: string[] = aiIgnoreFilesInput
        .split(',')
        .map(path => path.trim())
        .filter(path => path.length > 0);

    // Provider routing configuration
    const openRouterProviderOrderInput: string = additionalParams[INPUT_KEYS.OPENROUTER_PROVIDER_ORDER] ?? actionInputs[INPUT_KEYS.OPENROUTER_PROVIDER_ORDER];
    const openRouterProviderOrder: string[] = openRouterProviderOrderInput
        .split(',')
        .map(provider => provider.trim())
        .filter(provider => provider.length > 0);

    const openRouterProviderAllowFallbacks = (additionalParams[INPUT_KEYS.OPENROUTER_PROVIDER_ALLOW_FALLBACKS] ?? actionInputs[INPUT_KEYS.OPENROUTER_PROVIDER_ALLOW_FALLBACKS]) === 'true';
    const openRouterProviderRequireParameters = (additionalParams[INPUT_KEYS.OPENROUTER_PROVIDER_REQUIRE_PARAMETERS] ?? actionInputs[INPUT_KEYS.OPENROUTER_PROVIDER_REQUIRE_PARAMETERS]) === 'true';
    const openRouterProviderDataCollection = (additionalParams[INPUT_KEYS.OPENROUTER_PROVIDER_DATA_COLLECTION] ?? actionInputs[INPUT_KEYS.OPENROUTER_PROVIDER_DATA_COLLECTION]) as 'allow' | 'deny';
    
    const openRouterProviderIgnoreInput: string = additionalParams[INPUT_KEYS.OPENROUTER_PROVIDER_IGNORE] ?? actionInputs[INPUT_KEYS.OPENROUTER_PROVIDER_IGNORE];
    const openRouterProviderIgnore: string[] = openRouterProviderIgnoreInput
        .split(',')
        .map(provider => provider.trim())
        .filter(provider => provider.length > 0);

    const openRouterProviderQuantizationsInput: string = additionalParams[INPUT_KEYS.OPENROUTER_PROVIDER_QUANTIZATIONS] ?? actionInputs[INPUT_KEYS.OPENROUTER_PROVIDER_QUANTIZATIONS];
    const openRouterProviderQuantizations: string[] = openRouterProviderQuantizationsInput
        .split(',')
        .map(level => level.trim())
        .filter(level => level.length > 0);

    const openRouterProviderSort = (additionalParams[INPUT_KEYS.OPENROUTER_PROVIDER_SORT] ?? actionInputs[INPUT_KEYS.OPENROUTER_PROVIDER_SORT]) as 'price' | 'throughput' | 'latency' | '';

    const providerRouting = {
        ...(openRouterProviderOrder.length > 0 && { order: openRouterProviderOrder }),
        ...(openRouterProviderAllowFallbacks !== undefined && { allow_fallbacks: openRouterProviderAllowFallbacks }),
        ...(openRouterProviderRequireParameters !== undefined && { require_parameters: openRouterProviderRequireParameters }),
        ...(openRouterProviderDataCollection && { data_collection: openRouterProviderDataCollection }),
        ...(openRouterProviderIgnore.length > 0 && { ignore: openRouterProviderIgnore }),
        ...(openRouterProviderQuantizations.length > 0 && { quantizations: openRouterProviderQuantizations }),
        ...(openRouterProviderSort && { sort: openRouterProviderSort })
    };

    /**
     * Projects Details
     */
    const projectIdsInput: string = additionalParams[INPUT_KEYS.PROJECT_IDS] ?? actionInputs[INPUT_KEYS.PROJECT_IDS];
    const projectIds: string[] = projectIdsInput
        .split(',')
        .map(id => id.trim())
        .filter(id => id.length > 0);

    const projects: ProjectDetail[] = []
    for (const projectId of projectIds) {        
        const detail = await projectRepository.getProjectDetail(projectId, token)
        projects.push(detail)
    }

    const projectColumnIssueCreated = additionalParams[INPUT_KEYS.PROJECT_COLUMN_ISSUE_CREATED] ?? actionInputs[INPUT_KEYS.PROJECT_COLUMN_ISSUE_CREATED]
    const projectColumnPullRequestCreated = additionalParams[INPUT_KEYS.PROJECT_COLUMN_PULL_REQUEST_CREATED] ?? actionInputs[INPUT_KEYS.PROJECT_COLUMN_PULL_REQUEST_CREATED]
    const projectColumnIssueInProgress = additionalParams[INPUT_KEYS.PROJECT_COLUMN_ISSUE_IN_PROGRESS] ?? actionInputs[INPUT_KEYS.PROJECT_COLUMN_ISSUE_IN_PROGRESS]
    const projectColumnPullRequestInProgress = additionalParams[INPUT_KEYS.PROJECT_COLUMN_PULL_REQUEST_IN_PROGRESS] ?? actionInputs[INPUT_KEYS.PROJECT_COLUMN_PULL_REQUEST_IN_PROGRESS]

    /**
     * Images
     */
    const imagesOnIssue = (additionalParams[INPUT_KEYS.IMAGES_ON_ISSUE] ?? actionInputs[INPUT_KEYS.IMAGES_ON_ISSUE]) === 'true';
    const imagesOnPullRequest = (additionalParams[INPUT_KEYS.IMAGES_ON_PULL_REQUEST] ?? actionInputs[INPUT_KEYS.IMAGES_ON_PULL_REQUEST]) === 'true';
    const imagesOnCommit = (additionalParams[INPUT_KEYS.IMAGES_ON_COMMIT] ?? actionInputs[INPUT_KEYS.IMAGES_ON_COMMIT]) === 'true';

    const imagesIssueAutomaticInput: string = additionalParams[INPUT_KEYS.IMAGES_ISSUE_AUTOMATIC] ?? actionInputs[INPUT_KEYS.IMAGES_ISSUE_AUTOMATIC];
    const imagesIssueAutomatic: string[] = imagesIssueAutomaticInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    
    if (imagesIssueAutomatic.length === 0) {
        imagesIssueAutomatic.push(...DEFAULT_IMAGE_CONFIG.issue.automatic);
    }

    const imagesIssueFeatureInput: string = additionalParams[INPUT_KEYS.IMAGES_ISSUE_FEATURE] ?? actionInputs[INPUT_KEYS.IMAGES_ISSUE_FEATURE];
    const imagesIssueFeature: string[] = imagesIssueFeatureInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    
    if (imagesIssueFeature.length === 0) {
        imagesIssueFeature.push(...DEFAULT_IMAGE_CONFIG.issue.feature);
    }

    const imagesIssueBugfixInput: string = additionalParams[INPUT_KEYS.IMAGES_ISSUE_BUGFIX] ?? actionInputs[INPUT_KEYS.IMAGES_ISSUE_BUGFIX];
    const imagesIssueBugfix: string[] = imagesIssueBugfixInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    
    if (imagesIssueBugfix.length === 0) {
        imagesIssueBugfix.push(...DEFAULT_IMAGE_CONFIG.issue.bugfix);
    }

    const imagesIssueDocsInput: string = additionalParams[INPUT_KEYS.IMAGES_ISSUE_DOCS] ?? actionInputs[INPUT_KEYS.IMAGES_ISSUE_DOCS];
    const imagesIssueDocs: string[] = imagesIssueDocsInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    
    if (imagesIssueDocs.length === 0) {
        imagesIssueDocs.push(...DEFAULT_IMAGE_CONFIG.issue.docs);
    }

    const imagesIssueChoreInput: string = additionalParams[INPUT_KEYS.IMAGES_ISSUE_CHORE] ?? actionInputs[INPUT_KEYS.IMAGES_ISSUE_CHORE];
    const imagesIssueChore: string[] = imagesIssueChoreInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    
    if (imagesIssueChore.length === 0) {
        imagesIssueChore.push(...DEFAULT_IMAGE_CONFIG.issue.chore);
    }

    const imagesIssueReleaseInput: string = additionalParams[INPUT_KEYS.IMAGES_ISSUE_RELEASE] ?? actionInputs[INPUT_KEYS.IMAGES_ISSUE_RELEASE];
    const imagesIssueRelease: string[] = imagesIssueReleaseInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    
    if (imagesIssueRelease.length === 0) {
        imagesIssueRelease.push(...DEFAULT_IMAGE_CONFIG.issue.release);
    }

    const imagesIssueHotfixInput: string = additionalParams[INPUT_KEYS.IMAGES_ISSUE_HOTFIX] ?? actionInputs[INPUT_KEYS.IMAGES_ISSUE_HOTFIX];
    const imagesIssueHotfix: string[] = imagesIssueHotfixInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    
    if (imagesIssueHotfix.length === 0) {
        imagesIssueHotfix.push(...DEFAULT_IMAGE_CONFIG.issue.hotfix);
    }

    const imagesPullRequestAutomaticInput: string = additionalParams[INPUT_KEYS.IMAGES_PULL_REQUEST_AUTOMATIC] ?? actionInputs[INPUT_KEYS.IMAGES_PULL_REQUEST_AUTOMATIC];
    const imagesPullRequestAutomatic: string[] = imagesPullRequestAutomaticInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    
    if (imagesPullRequestAutomatic.length === 0) {
        imagesPullRequestAutomatic.push(...DEFAULT_IMAGE_CONFIG.pullRequest.automatic);
    }

    const imagesPullRequestFeatureInput: string = additionalParams[INPUT_KEYS.IMAGES_PULL_REQUEST_FEATURE] ?? actionInputs[INPUT_KEYS.IMAGES_PULL_REQUEST_FEATURE];
    const imagesPullRequestFeature: string[] = imagesPullRequestFeatureInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    
    if (imagesPullRequestFeature.length === 0) {
        imagesPullRequestFeature.push(...DEFAULT_IMAGE_CONFIG.pullRequest.feature);
    }

    const imagesPullRequestBugfixInput: string = additionalParams[INPUT_KEYS.IMAGES_PULL_REQUEST_BUGFIX] ?? actionInputs[INPUT_KEYS.IMAGES_PULL_REQUEST_BUGFIX];
    const imagesPullRequestBugfix: string[] = imagesPullRequestBugfixInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    
    if (imagesPullRequestBugfix.length === 0) {
        imagesPullRequestBugfix.push(...DEFAULT_IMAGE_CONFIG.pullRequest.bugfix);
    }

    const imagesPullRequestReleaseInput: string = additionalParams[INPUT_KEYS.IMAGES_PULL_REQUEST_RELEASE] ?? actionInputs[INPUT_KEYS.IMAGES_PULL_REQUEST_RELEASE];
    const imagesPullRequestRelease: string[] = imagesPullRequestReleaseInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    
    if (imagesPullRequestRelease.length === 0) {
        imagesPullRequestRelease.push(...DEFAULT_IMAGE_CONFIG.pullRequest.release);
    }

    const imagesPullRequestHotfixInput: string = additionalParams[INPUT_KEYS.IMAGES_PULL_REQUEST_HOTFIX] ?? actionInputs[INPUT_KEYS.IMAGES_PULL_REQUEST_HOTFIX];
    const imagesPullRequestHotfix: string[] = imagesPullRequestHotfixInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    
    if (imagesPullRequestHotfix.length === 0) {
        imagesPullRequestHotfix.push(...DEFAULT_IMAGE_CONFIG.pullRequest.hotfix);
    }

    const imagesPullRequestDocsInput: string = additionalParams[INPUT_KEYS.IMAGES_PULL_REQUEST_DOCS] ?? actionInputs[INPUT_KEYS.IMAGES_PULL_REQUEST_DOCS];
    const imagesPullRequestDocs: string[] = imagesPullRequestDocsInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    
    if (imagesPullRequestDocs.length === 0) {
        imagesPullRequestDocs.push(...DEFAULT_IMAGE_CONFIG.pullRequest.docs);
    }

    const imagesPullRequestChoreInput: string = additionalParams[INPUT_KEYS.IMAGES_PULL_REQUEST_CHORE] ?? actionInputs[INPUT_KEYS.IMAGES_PULL_REQUEST_CHORE];
    const imagesPullRequestChore: string[] = imagesPullRequestChoreInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    
    if (imagesPullRequestChore.length === 0) {
        imagesPullRequestChore.push(...DEFAULT_IMAGE_CONFIG.pullRequest.chore);
    }

    const imagesCommitAutomaticInput: string = additionalParams[INPUT_KEYS.IMAGES_COMMIT_AUTOMATIC] ?? actionInputs[INPUT_KEYS.IMAGES_COMMIT_AUTOMATIC];
    const imagesCommitAutomatic: string[] = imagesCommitAutomaticInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    
    if (imagesCommitAutomatic.length === 0) {
        imagesCommitAutomatic.push(...DEFAULT_IMAGE_CONFIG.commit.automatic);
    }

    const imagesCommitFeatureInput: string = additionalParams[INPUT_KEYS.IMAGES_COMMIT_FEATURE] ?? actionInputs[INPUT_KEYS.IMAGES_COMMIT_FEATURE];
    const imagesCommitFeature: string[] = imagesCommitFeatureInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    
    if (imagesCommitFeature.length === 0) {
        imagesCommitFeature.push(...DEFAULT_IMAGE_CONFIG.commit.feature);
    }

    const imagesCommitBugfixInput: string = additionalParams[INPUT_KEYS.IMAGES_COMMIT_BUGFIX] ?? actionInputs[INPUT_KEYS.IMAGES_COMMIT_BUGFIX];
    const imagesCommitBugfix: string[] = imagesCommitBugfixInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    
    if (imagesCommitBugfix.length === 0) {
        imagesCommitBugfix.push(...DEFAULT_IMAGE_CONFIG.commit.bugfix);
    }

    const imagesCommitReleaseInput: string = additionalParams[INPUT_KEYS.IMAGES_COMMIT_RELEASE] ?? actionInputs[INPUT_KEYS.IMAGES_COMMIT_RELEASE];
    const imagesCommitRelease: string[] = imagesCommitReleaseInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    
    if (imagesCommitRelease.length === 0) {
        imagesCommitRelease.push(...DEFAULT_IMAGE_CONFIG.commit.release);
    }

    const imagesCommitHotfixInput: string = additionalParams[INPUT_KEYS.IMAGES_COMMIT_HOTFIX] ?? actionInputs[INPUT_KEYS.IMAGES_COMMIT_HOTFIX];
    const imagesCommitHotfix: string[] = imagesCommitHotfixInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    
    if (imagesCommitHotfix.length === 0) {
        imagesCommitHotfix.push(...DEFAULT_IMAGE_CONFIG.commit.hotfix);
    }

    const imagesCommitDocsInput: string = additionalParams[INPUT_KEYS.IMAGES_COMMIT_DOCS] ?? actionInputs[INPUT_KEYS.IMAGES_COMMIT_DOCS];
    const imagesCommitDocs: string[] = imagesCommitDocsInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    
    if (imagesCommitDocs.length === 0) {
        imagesCommitDocs.push(...DEFAULT_IMAGE_CONFIG.commit.docs);
    }

    const imagesCommitChoreInput: string = additionalParams[INPUT_KEYS.IMAGES_COMMIT_CHORE] ?? actionInputs[INPUT_KEYS.IMAGES_COMMIT_CHORE];
    const imagesCommitChore: string[] = imagesCommitChoreInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    
    if (imagesCommitChore.length === 0) {
        imagesCommitChore.push(...DEFAULT_IMAGE_CONFIG.commit.chore);
    }

    /**
     * Workflows
     */
    const releaseWorkflow = additionalParams[INPUT_KEYS.RELEASE_WORKFLOW] ?? actionInputs[INPUT_KEYS.RELEASE_WORKFLOW];
    const hotfixWorkflow = additionalParams[INPUT_KEYS.HOTFIX_WORKFLOW] ?? actionInputs[INPUT_KEYS.HOTFIX_WORKFLOW];

    /**
     * Emoji-title
     */
    const titleEmoji = (additionalParams[INPUT_KEYS.EMOJI_LABELED_TITLE] ?? actionInputs[INPUT_KEYS.EMOJI_LABELED_TITLE]) === 'true';
    const branchManagementEmoji = additionalParams[INPUT_KEYS.BRANCH_MANAGEMENT_EMOJI] ?? actionInputs[INPUT_KEYS.BRANCH_MANAGEMENT_EMOJI];

    /**
     * Labels
     */
    const branchManagementLauncherLabel = additionalParams[INPUT_KEYS.BRANCH_MANAGEMENT_LAUNCHER_LABEL] ?? actionInputs[INPUT_KEYS.BRANCH_MANAGEMENT_LAUNCHER_LABEL];
    const bugfixLabel = additionalParams[INPUT_KEYS.BUGFIX_LABEL] ?? actionInputs[INPUT_KEYS.BUGFIX_LABEL];
    const bugLabel = additionalParams[INPUT_KEYS.BUG_LABEL] ?? actionInputs[INPUT_KEYS.BUG_LABEL];
    const hotfixLabel = additionalParams[INPUT_KEYS.HOTFIX_LABEL] ?? actionInputs[INPUT_KEYS.HOTFIX_LABEL];
    const enhancementLabel = additionalParams[INPUT_KEYS.ENHANCEMENT_LABEL] ?? actionInputs[INPUT_KEYS.ENHANCEMENT_LABEL];
    const featureLabel = additionalParams[INPUT_KEYS.FEATURE_LABEL] ?? actionInputs[INPUT_KEYS.FEATURE_LABEL];
    const releaseLabel = additionalParams[INPUT_KEYS.RELEASE_LABEL] ?? actionInputs[INPUT_KEYS.RELEASE_LABEL];
    const questionLabel = additionalParams[INPUT_KEYS.QUESTION_LABEL] ?? actionInputs[INPUT_KEYS.QUESTION_LABEL];
    const helpLabel = additionalParams[INPUT_KEYS.HELP_LABEL] ?? actionInputs[INPUT_KEYS.HELP_LABEL];
    const deployLabel = additionalParams[INPUT_KEYS.DEPLOY_LABEL] ?? actionInputs[INPUT_KEYS.DEPLOY_LABEL];
    const deployedLabel = additionalParams[INPUT_KEYS.DEPLOYED_LABEL] ?? actionInputs[INPUT_KEYS.DEPLOYED_LABEL];
    const docsLabel = additionalParams[INPUT_KEYS.DOCS_LABEL] ?? actionInputs[INPUT_KEYS.DOCS_LABEL];
    const documentationLabel = additionalParams[INPUT_KEYS.DOCUMENTATION_LABEL] ?? actionInputs[INPUT_KEYS.DOCUMENTATION_LABEL];
    const choreLabel = additionalParams[INPUT_KEYS.CHORE_LABEL] ?? actionInputs[INPUT_KEYS.CHORE_LABEL];
    const maintenanceLabel = additionalParams[INPUT_KEYS.MAINTENANCE_LABEL] ?? actionInputs[INPUT_KEYS.MAINTENANCE_LABEL];
    const priorityHighLabel = additionalParams[INPUT_KEYS.PRIORITY_HIGH_LABEL] ?? actionInputs[INPUT_KEYS.PRIORITY_HIGH_LABEL];
    const priorityMediumLabel = additionalParams[INPUT_KEYS.PRIORITY_MEDIUM_LABEL] ?? actionInputs[INPUT_KEYS.PRIORITY_MEDIUM_LABEL];
    const priorityLowLabel = additionalParams[INPUT_KEYS.PRIORITY_LOW_LABEL] ?? actionInputs[INPUT_KEYS.PRIORITY_LOW_LABEL];
    const priorityNoneLabel = additionalParams[INPUT_KEYS.PRIORITY_NONE_LABEL] ?? actionInputs[INPUT_KEYS.PRIORITY_NONE_LABEL];
    const sizeXxlLabel = additionalParams[INPUT_KEYS.SIZE_XXL_LABEL] ?? actionInputs[INPUT_KEYS.SIZE_XXL_LABEL];
    const sizeXlLabel = additionalParams[INPUT_KEYS.SIZE_XL_LABEL] ?? actionInputs[INPUT_KEYS.SIZE_XL_LABEL];
    const sizeLLabel = additionalParams[INPUT_KEYS.SIZE_L_LABEL] ?? actionInputs[INPUT_KEYS.SIZE_L_LABEL];
    const sizeMLabel = additionalParams[INPUT_KEYS.SIZE_M_LABEL] ?? actionInputs[INPUT_KEYS.SIZE_M_LABEL];
    const sizeSLabel = additionalParams[INPUT_KEYS.SIZE_S_LABEL] ?? actionInputs[INPUT_KEYS.SIZE_S_LABEL];
    const sizeXsLabel = additionalParams[INPUT_KEYS.SIZE_XS_LABEL] ?? actionInputs[INPUT_KEYS.SIZE_XS_LABEL];

    /**
     * Issue Types
     */
    const issueTypeBug = additionalParams[INPUT_KEYS.ISSUE_TYPE_BUG] ?? actionInputs[INPUT_KEYS.ISSUE_TYPE_BUG];
    const issueTypeHotfix = additionalParams[INPUT_KEYS.ISSUE_TYPE_HOTFIX] ?? actionInputs[INPUT_KEYS.ISSUE_TYPE_HOTFIX];
    const issueTypeFeature = additionalParams[INPUT_KEYS.ISSUE_TYPE_FEATURE] ?? actionInputs[INPUT_KEYS.ISSUE_TYPE_FEATURE];
    const issueTypeDocumentation = additionalParams[INPUT_KEYS.ISSUE_TYPE_DOCUMENTATION] ?? actionInputs[INPUT_KEYS.ISSUE_TYPE_DOCUMENTATION];
    const issueTypeMaintenance = additionalParams[INPUT_KEYS.ISSUE_TYPE_MAINTENANCE] ?? actionInputs[INPUT_KEYS.ISSUE_TYPE_MAINTENANCE];
    const issueTypeRelease = additionalParams[INPUT_KEYS.ISSUE_TYPE_RELEASE] ?? actionInputs[INPUT_KEYS.ISSUE_TYPE_RELEASE];
    const issueTypeQuestion = additionalParams[INPUT_KEYS.ISSUE_TYPE_QUESTION] ?? actionInputs[INPUT_KEYS.ISSUE_TYPE_QUESTION];
    const issueTypeHelp = additionalParams[INPUT_KEYS.ISSUE_TYPE_HELP] ?? actionInputs[INPUT_KEYS.ISSUE_TYPE_HELP];
    const issueTypeTask = additionalParams[INPUT_KEYS.ISSUE_TYPE_TASK] ?? actionInputs[INPUT_KEYS.ISSUE_TYPE_TASK];

    /**
     * Locale
     */
    const issueLocale = additionalParams[INPUT_KEYS.ISSUES_LOCALE] ?? actionInputs[INPUT_KEYS.ISSUES_LOCALE] ?? Locale.DEFAULT;
    const pullRequestLocale = additionalParams[INPUT_KEYS.PULL_REQUESTS_LOCALE] ?? actionInputs[INPUT_KEYS.PULL_REQUESTS_LOCALE] ?? Locale.DEFAULT;

    /**
     * Size Thresholds
     */
    const sizeXxlThresholdLines = parseInt(additionalParams[INPUT_KEYS.SIZE_XXL_THRESHOLD_LINES] ?? actionInputs[INPUT_KEYS.SIZE_XXL_THRESHOLD_LINES]) ?? 1000;
    const sizeXxlThresholdFiles = parseInt(additionalParams[INPUT_KEYS.SIZE_XXL_THRESHOLD_FILES] ?? actionInputs[INPUT_KEYS.SIZE_XXL_THRESHOLD_FILES]) ?? 20;
    const sizeXxlThresholdCommits = parseInt(additionalParams[INPUT_KEYS.SIZE_XXL_THRESHOLD_COMMITS] ?? actionInputs[INPUT_KEYS.SIZE_XXL_THRESHOLD_COMMITS]) ?? 10;
    const sizeXlThresholdLines = parseInt(additionalParams[INPUT_KEYS.SIZE_XL_THRESHOLD_LINES] ?? actionInputs[INPUT_KEYS.SIZE_XL_THRESHOLD_LINES]) ?? 500;
    const sizeXlThresholdFiles = parseInt(additionalParams[INPUT_KEYS.SIZE_XL_THRESHOLD_FILES] ?? actionInputs[INPUT_KEYS.SIZE_XL_THRESHOLD_FILES]) ?? 10;
    const sizeXlThresholdCommits = parseInt(additionalParams[INPUT_KEYS.SIZE_XL_THRESHOLD_COMMITS] ?? actionInputs[INPUT_KEYS.SIZE_XL_THRESHOLD_COMMITS]) ?? 5;
    const sizeLThresholdLines = parseInt(additionalParams[INPUT_KEYS.SIZE_L_THRESHOLD_LINES] ?? actionInputs[INPUT_KEYS.SIZE_L_THRESHOLD_LINES]) ?? 250;
    const sizeLThresholdFiles = parseInt(additionalParams[INPUT_KEYS.SIZE_L_THRESHOLD_FILES] ?? actionInputs[INPUT_KEYS.SIZE_L_THRESHOLD_FILES]) ?? 5;
    const sizeLThresholdCommits = parseInt(additionalParams[INPUT_KEYS.SIZE_L_THRESHOLD_COMMITS] ?? actionInputs[INPUT_KEYS.SIZE_L_THRESHOLD_COMMITS]) ?? 3;
    const sizeMThresholdLines = parseInt(additionalParams[INPUT_KEYS.SIZE_M_THRESHOLD_LINES] ?? actionInputs[INPUT_KEYS.SIZE_M_THRESHOLD_LINES]) ?? 100;
    const sizeMThresholdFiles = parseInt(additionalParams[INPUT_KEYS.SIZE_M_THRESHOLD_FILES] ?? actionInputs[INPUT_KEYS.SIZE_M_THRESHOLD_FILES]) ?? 3;
    const sizeMThresholdCommits = parseInt(additionalParams[INPUT_KEYS.SIZE_M_THRESHOLD_COMMITS] ?? actionInputs[INPUT_KEYS.SIZE_M_THRESHOLD_COMMITS]) ?? 2;
    const sizeSThresholdLines = parseInt(additionalParams[INPUT_KEYS.SIZE_S_THRESHOLD_LINES] ?? actionInputs[INPUT_KEYS.SIZE_S_THRESHOLD_LINES]) ?? 50;
    const sizeSThresholdFiles = parseInt(additionalParams[INPUT_KEYS.SIZE_S_THRESHOLD_FILES] ?? actionInputs[INPUT_KEYS.SIZE_S_THRESHOLD_FILES]) ?? 2;
    const sizeSThresholdCommits = parseInt(additionalParams[INPUT_KEYS.SIZE_S_THRESHOLD_COMMITS] ?? actionInputs[INPUT_KEYS.SIZE_S_THRESHOLD_COMMITS]) ?? 1;
    const sizeXsThresholdLines = parseInt(additionalParams[INPUT_KEYS.SIZE_XS_THRESHOLD_LINES] ?? actionInputs[INPUT_KEYS.SIZE_XS_THRESHOLD_LINES]) ?? 25;
    const sizeXsThresholdFiles = parseInt(additionalParams[INPUT_KEYS.SIZE_XS_THRESHOLD_FILES] ?? actionInputs[INPUT_KEYS.SIZE_XS_THRESHOLD_FILES]) ?? 1;
    const sizeXsThresholdCommits = parseInt(additionalParams[INPUT_KEYS.SIZE_XS_THRESHOLD_COMMITS] ?? actionInputs[INPUT_KEYS.SIZE_XS_THRESHOLD_COMMITS]) ?? 1;
    
    /**
     * Branches
     */
    const mainBranch = additionalParams[INPUT_KEYS.MAIN_BRANCH] ?? actionInputs[INPUT_KEYS.MAIN_BRANCH];
    const developmentBranch = additionalParams[INPUT_KEYS.DEVELOPMENT_BRANCH] ?? actionInputs[INPUT_KEYS.DEVELOPMENT_BRANCH];
    const featureTree = additionalParams[INPUT_KEYS.FEATURE_TREE] ?? actionInputs[INPUT_KEYS.FEATURE_TREE];
    const bugfixTree = additionalParams[INPUT_KEYS.BUGFIX_TREE] ?? actionInputs[INPUT_KEYS.BUGFIX_TREE];
    const hotfixTree = additionalParams[INPUT_KEYS.HOTFIX_TREE] ?? actionInputs[INPUT_KEYS.HOTFIX_TREE];
    const releaseTree = additionalParams[INPUT_KEYS.RELEASE_TREE] ?? actionInputs[INPUT_KEYS.RELEASE_TREE];
    const docsTree = additionalParams[INPUT_KEYS.DOCS_TREE] ?? actionInputs[INPUT_KEYS.DOCS_TREE];
    const choreTree = additionalParams[INPUT_KEYS.CHORE_TREE] ?? actionInputs[INPUT_KEYS.CHORE_TREE];

    /**
     * Prefix builder
     */
    let commitPrefixBuilder = additionalParams[INPUT_KEYS.COMMIT_PREFIX_TRANSFORMS] ?? actionInputs[INPUT_KEYS.COMMIT_PREFIX_TRANSFORMS] ?? '';
    if (commitPrefixBuilder.length === 0) {
        commitPrefixBuilder = 'replace-slash';
    }

    /**
     * Issue
     */
    const branchManagementAlways = (additionalParams[INPUT_KEYS.BRANCH_MANAGEMENT_ALWAYS] ?? actionInputs[INPUT_KEYS.BRANCH_MANAGEMENT_ALWAYS]) === 'true';
    const reopenIssueOnPush = (additionalParams[INPUT_KEYS.REOPEN_ISSUE_ON_PUSH] ?? actionInputs[INPUT_KEYS.REOPEN_ISSUE_ON_PUSH]) === 'true';
    const issueDesiredAssigneesCount = parseInt(additionalParams[INPUT_KEYS.DESIRED_ASSIGNEES_COUNT] ?? actionInputs[INPUT_KEYS.DESIRED_ASSIGNEES_COUNT]) ?? 0;

    /**
     * Pull Request
     */
    const pullRequestDesiredAssigneesCount = parseInt(additionalParams[INPUT_KEYS.PULL_REQUEST_DESIRED_ASSIGNEES_COUNT] ?? actionInputs[INPUT_KEYS.PULL_REQUEST_DESIRED_ASSIGNEES_COUNT]) ?? 0;
    const pullRequestDesiredReviewersCount = parseInt(additionalParams[INPUT_KEYS.PULL_REQUEST_DESIRED_REVIEWERS_COUNT] ?? actionInputs[INPUT_KEYS.PULL_REQUEST_DESIRED_REVIEWERS_COUNT]) ?? 0;
    const pullRequestMergeTimeout = parseInt(additionalParams[INPUT_KEYS.PULL_REQUEST_MERGE_TIMEOUT] ?? actionInputs[INPUT_KEYS.PULL_REQUEST_MERGE_TIMEOUT]) ?? 0;

    /**
     * Supabase
     */
    const supabaseUrl = additionalParams[INPUT_KEYS.SUPABASE_URL] ?? actionInputs[INPUT_KEYS.SUPABASE_URL];
    const supabaseKey = additionalParams[INPUT_KEYS.SUPABASE_KEY] ?? actionInputs[INPUT_KEYS.SUPABASE_KEY];
    let supabaseConfig: SupabaseConfig | undefined = undefined;
    if (supabaseUrl.length > 0 && supabaseKey.length > 0) {
        supabaseConfig = new SupabaseConfig(supabaseUrl, supabaseKey);
    }

    const execution = new Execution(
        debug,
        new DockerConfig(
            dockerContainerName,
            dockerDomain,
            dockerPort,
            dockerCacheOs,
            dockerCacheArch,
        ),
        new SingleAction(
            singleAction,
            singleActionIssue,
            singleActionVersion,
            singleActionTitle,
            singleActionChangelog,
        ),
        commitPrefixBuilder,
        new Issue(
            branchManagementAlways,
            reopenIssueOnPush,
            issueDesiredAssigneesCount,
            additionalParams,
        ),
        new PullRequest(
            pullRequestDesiredAssigneesCount,
            pullRequestDesiredReviewersCount,
            pullRequestMergeTimeout,
            additionalParams,
        ),
        new Emoji(
            titleEmoji,
            branchManagementEmoji,
        ),
        new Images(
            imagesOnIssue,
            imagesOnPullRequest,
            imagesOnCommit,
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
            imagesCommitAutomatic,
            imagesCommitFeature,
            imagesCommitBugfix,
            imagesCommitRelease,
            imagesCommitHotfix,
            imagesCommitDocs,
            imagesCommitChore,
        ),
        new Tokens(
            token,
            classicToken,
        ),
        new Ai(
            openrouterApiKey,
            openrouterModel,
            aiPullRequestDescription,
            aiMembersOnly,
            aiIgnoreFiles,
            aiIncludeReasoning,
            Object.keys(providerRouting).length > 0 ? providerRouting : undefined
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
            priorityHighLabel,
            priorityMediumLabel,
            priorityLowLabel,
            priorityNoneLabel,
            sizeXxlLabel,
            sizeXlLabel,
            sizeLLabel,
            sizeMLabel,
            sizeSLabel,
            sizeXsLabel,
        ),
        new IssueTypes(
            issueTypeTask,
            issueTypeBug,
            issueTypeFeature,
            issueTypeDocumentation,
            issueTypeMaintenance,
            issueTypeHotfix,
            issueTypeRelease,
            issueTypeQuestion,
            issueTypeHelp,
        ),
        new Locale(issueLocale, pullRequestLocale),
        new SizeThresholds(
            new SizeThreshold(
                sizeXxlThresholdLines,
                sizeXxlThresholdFiles,
                sizeXxlThresholdCommits,
            ),
            new SizeThreshold(
                sizeXlThresholdLines,
                sizeXlThresholdFiles,
                sizeXlThresholdCommits,
            ),
            new SizeThreshold(
                sizeLThresholdLines,
                sizeLThresholdFiles,
                sizeLThresholdCommits,
            ),
            new SizeThreshold(
                sizeMThresholdLines,
                sizeMThresholdFiles,
                sizeMThresholdCommits,
            ),
            new SizeThreshold(
                sizeSThresholdLines,
                sizeSThresholdFiles,
                sizeSThresholdCommits,
            ),
            new SizeThreshold(
                sizeXsThresholdLines,
                sizeXsThresholdFiles,
                sizeXsThresholdCommits,
            ),
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
        new Projects(
            projects,
            projectColumnIssueCreated,
            projectColumnPullRequestCreated,
            projectColumnIssueInProgress,
            projectColumnPullRequestInProgress,
        ),
        supabaseConfig,
        new Welcome(welcomeTitle, welcomeMessages),
        additionalParams,
    )

    const results = await mainRun(execution);

    let content = ''
    const stepsContent = results
        .filter(result => result.executed && result.steps.length > 0)
        .map(result => chalk.gray(result.steps.join('\n'))).join('\n')

    if (stepsContent.length > 0) {
        content +=  '\n' + chalk.cyan('Steps:') + '\n' + stepsContent
    }

    const errorsContent = results
        .filter(result => !result.executed && result.errors.length > 0)
        .map(result => chalk.gray(result.errors.join('\n'))).join('\n')

    if (errorsContent.length > 0) {
        content +=  '\n' + chalk.red('Errors:') + '\n' + errorsContent
    }

    const reminderContent = results
        .filter(result => result.executed && result.reminders.length > 0)
        .map(result => chalk.gray(result.reminders.join('\n'))).join('\n')

    if (reminderContent.length > 0) {
        content +=  '\n' + chalk.cyan('Reminder:') + '\n' + reminderContent
    }

    logInfo('\n')
    logInfo(
        boxen(
            content,
            {
                padding: 1,
                margin: 1,
                borderStyle: 'round',
                borderColor: 'cyan',
                title: TITLE,
                titleAlignment: 'center'
            }
        )
    );
}

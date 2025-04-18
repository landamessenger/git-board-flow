"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runLocalAction = runLocalAction;
const ai_1 = require("../data/model/ai");
const branches_1 = require("../data/model/branches");
const docker_config_1 = require("../data/model/docker_config");
const emoji_1 = require("../data/model/emoji");
const execution_1 = require("../data/model/execution");
const hotfix_1 = require("../data/model/hotfix");
const images_1 = require("../data/model/images");
const issue_1 = require("../data/model/issue");
const issue_types_1 = require("../data/model/issue_types");
const labels_1 = require("../data/model/labels");
const locale_1 = require("../data/model/locale");
const projects_1 = require("../data/model/projects");
const pull_request_1 = require("../data/model/pull_request");
const release_1 = require("../data/model/release");
const single_action_1 = require("../data/model/single_action");
const size_threshold_1 = require("../data/model/size_threshold");
const size_thresholds_1 = require("../data/model/size_thresholds");
const supabase_config_1 = require("../data/model/supabase_config");
const tokens_1 = require("../data/model/tokens");
const workflows_1 = require("../data/model/workflows");
const project_repository_1 = require("../data/repository/project_repository");
const constants_1 = require("../utils/constants");
const logger_1 = require("../utils/logger");
const yml_utils_1 = require("../utils/yml_utils");
const common_action_1 = require("./common_action");
async function runLocalAction(additionalParams) {
    const projectRepository = new project_repository_1.ProjectRepository();
    const actionInputs = (0, yml_utils_1.getActionInputsWithDefaults)();
    /**
     * Debug
     */
    const debug = (additionalParams[constants_1.INPUT_KEYS.DEBUG] ?? actionInputs[constants_1.INPUT_KEYS.DEBUG]) == 'true';
    /**
     * Docker
     */
    const dockerContainerName = additionalParams[constants_1.INPUT_KEYS.DOCKER_CONTAINER_NAME] ?? actionInputs[constants_1.INPUT_KEYS.DOCKER_CONTAINER_NAME];
    const dockerDomain = additionalParams[constants_1.INPUT_KEYS.DOCKER_DOMAIN] ?? actionInputs[constants_1.INPUT_KEYS.DOCKER_DOMAIN];
    const dockerPort = parseInt(additionalParams[constants_1.INPUT_KEYS.DOCKER_PORT] ?? actionInputs[constants_1.INPUT_KEYS.DOCKER_PORT]);
    /**
     * Single action
     */
    const singleAction = additionalParams[constants_1.INPUT_KEYS.SINGLE_ACTION] ?? actionInputs[constants_1.INPUT_KEYS.SINGLE_ACTION];
    const singleActionIssue = additionalParams[constants_1.INPUT_KEYS.SINGLE_ACTION_ISSUE] ?? actionInputs[constants_1.INPUT_KEYS.SINGLE_ACTION_ISSUE];
    /**
     * Tokens
     */
    const token = additionalParams[constants_1.INPUT_KEYS.TOKEN] ?? actionInputs[constants_1.INPUT_KEYS.TOKEN];
    /**
     * AI
     */
    const openrouterApiKey = additionalParams[constants_1.INPUT_KEYS.OPENROUTER_API_KEY] ?? actionInputs[constants_1.INPUT_KEYS.OPENROUTER_API_KEY];
    const openrouterModel = additionalParams[constants_1.INPUT_KEYS.OPENROUTER_MODEL] ?? actionInputs[constants_1.INPUT_KEYS.OPENROUTER_MODEL];
    const aiPullRequestDescription = (additionalParams[constants_1.INPUT_KEYS.AI_PULL_REQUEST_DESCRIPTION] ?? actionInputs[constants_1.INPUT_KEYS.AI_PULL_REQUEST_DESCRIPTION]) === 'true';
    const aiMembersOnly = (additionalParams[constants_1.INPUT_KEYS.AI_MEMBERS_ONLY] ?? actionInputs[constants_1.INPUT_KEYS.AI_MEMBERS_ONLY]) === 'true';
    const aiIgnoreFilesInput = additionalParams[constants_1.INPUT_KEYS.AI_IGNORE_FILES] ?? actionInputs[constants_1.INPUT_KEYS.AI_IGNORE_FILES];
    const aiIgnoreFiles = aiIgnoreFilesInput
        .split(',')
        .map(path => path.trim())
        .filter(path => path.length > 0);
    // Provider routing configuration
    const openRouterProviderOrderInput = additionalParams[constants_1.INPUT_KEYS.OPENROUTER_PROVIDER_ORDER] ?? actionInputs[constants_1.INPUT_KEYS.OPENROUTER_PROVIDER_ORDER];
    const openRouterProviderOrder = openRouterProviderOrderInput
        .split(',')
        .map(provider => provider.trim())
        .filter(provider => provider.length > 0);
    const openRouterProviderAllowFallbacks = (additionalParams[constants_1.INPUT_KEYS.OPENROUTER_PROVIDER_ALLOW_FALLBACKS] ?? actionInputs[constants_1.INPUT_KEYS.OPENROUTER_PROVIDER_ALLOW_FALLBACKS]) === 'true';
    const openRouterProviderRequireParameters = (additionalParams[constants_1.INPUT_KEYS.OPENROUTER_PROVIDER_REQUIRE_PARAMETERS] ?? actionInputs[constants_1.INPUT_KEYS.OPENROUTER_PROVIDER_REQUIRE_PARAMETERS]) === 'true';
    const openRouterProviderDataCollection = (additionalParams[constants_1.INPUT_KEYS.OPENROUTER_PROVIDER_DATA_COLLECTION] ?? actionInputs[constants_1.INPUT_KEYS.OPENROUTER_PROVIDER_DATA_COLLECTION]);
    const openRouterProviderIgnoreInput = additionalParams[constants_1.INPUT_KEYS.OPENROUTER_PROVIDER_IGNORE] ?? actionInputs[constants_1.INPUT_KEYS.OPENROUTER_PROVIDER_IGNORE];
    const openRouterProviderIgnore = openRouterProviderIgnoreInput
        .split(',')
        .map(provider => provider.trim())
        .filter(provider => provider.length > 0);
    const openRouterProviderQuantizationsInput = additionalParams[constants_1.INPUT_KEYS.OPENROUTER_PROVIDER_QUANTIZATIONS] ?? actionInputs[constants_1.INPUT_KEYS.OPENROUTER_PROVIDER_QUANTIZATIONS];
    const openRouterProviderQuantizations = openRouterProviderQuantizationsInput
        .split(',')
        .map(level => level.trim())
        .filter(level => level.length > 0);
    const openRouterProviderSort = (additionalParams[constants_1.INPUT_KEYS.OPENROUTER_PROVIDER_SORT] ?? actionInputs[constants_1.INPUT_KEYS.OPENROUTER_PROVIDER_SORT]);
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
    const projectIdsInput = additionalParams[constants_1.INPUT_KEYS.PROJECT_IDS] ?? actionInputs[constants_1.INPUT_KEYS.PROJECT_IDS];
    const projectIds = projectIdsInput
        .split(',')
        .map(id => id.trim())
        .filter(id => id.length > 0);
    const projects = [];
    for (const projectId of projectIds) {
        const detail = await projectRepository.getProjectDetail(projectId, token);
        projects.push(detail);
    }
    const projectColumnIssueCreated = additionalParams[constants_1.INPUT_KEYS.PROJECT_COLUMN_ISSUE_CREATED] ?? actionInputs[constants_1.INPUT_KEYS.PROJECT_COLUMN_ISSUE_CREATED];
    const projectColumnPullRequestCreated = additionalParams[constants_1.INPUT_KEYS.PROJECT_COLUMN_PULL_REQUEST_CREATED] ?? actionInputs[constants_1.INPUT_KEYS.PROJECT_COLUMN_PULL_REQUEST_CREATED];
    const projectColumnIssueInProgress = additionalParams[constants_1.INPUT_KEYS.PROJECT_COLUMN_ISSUE_IN_PROGRESS] ?? actionInputs[constants_1.INPUT_KEYS.PROJECT_COLUMN_ISSUE_IN_PROGRESS];
    const projectColumnPullRequestInProgress = additionalParams[constants_1.INPUT_KEYS.PROJECT_COLUMN_PULL_REQUEST_IN_PROGRESS] ?? actionInputs[constants_1.INPUT_KEYS.PROJECT_COLUMN_PULL_REQUEST_IN_PROGRESS];
    /**
     * Images
     */
    const imagesOnIssue = (additionalParams[constants_1.INPUT_KEYS.IMAGES_ON_ISSUE] ?? actionInputs[constants_1.INPUT_KEYS.IMAGES_ON_ISSUE]) === 'true';
    const imagesOnPullRequest = (additionalParams[constants_1.INPUT_KEYS.IMAGES_ON_PULL_REQUEST] ?? actionInputs[constants_1.INPUT_KEYS.IMAGES_ON_PULL_REQUEST]) === 'true';
    const imagesOnCommit = (additionalParams[constants_1.INPUT_KEYS.IMAGES_ON_COMMIT] ?? actionInputs[constants_1.INPUT_KEYS.IMAGES_ON_COMMIT]) === 'true';
    const imagesIssueAutomaticInput = additionalParams[constants_1.INPUT_KEYS.IMAGES_ISSUE_AUTOMATIC] ?? actionInputs[constants_1.INPUT_KEYS.IMAGES_ISSUE_AUTOMATIC];
    const imagesIssueAutomatic = imagesIssueAutomaticInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    if (imagesIssueAutomatic.length === 0) {
        imagesIssueAutomatic.push(...constants_1.DEFAULT_IMAGE_CONFIG.issue.automatic);
    }
    const imagesIssueFeatureInput = additionalParams[constants_1.INPUT_KEYS.IMAGES_ISSUE_FEATURE] ?? actionInputs[constants_1.INPUT_KEYS.IMAGES_ISSUE_FEATURE];
    const imagesIssueFeature = imagesIssueFeatureInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    if (imagesIssueFeature.length === 0) {
        imagesIssueFeature.push(...constants_1.DEFAULT_IMAGE_CONFIG.issue.feature);
    }
    const imagesIssueBugfixInput = additionalParams[constants_1.INPUT_KEYS.IMAGES_ISSUE_BUGFIX] ?? actionInputs[constants_1.INPUT_KEYS.IMAGES_ISSUE_BUGFIX];
    const imagesIssueBugfix = imagesIssueBugfixInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    if (imagesIssueBugfix.length === 0) {
        imagesIssueBugfix.push(...constants_1.DEFAULT_IMAGE_CONFIG.issue.bugfix);
    }
    const imagesIssueDocsInput = additionalParams[constants_1.INPUT_KEYS.IMAGES_ISSUE_DOCS] ?? actionInputs[constants_1.INPUT_KEYS.IMAGES_ISSUE_DOCS];
    const imagesIssueDocs = imagesIssueDocsInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    if (imagesIssueDocs.length === 0) {
        imagesIssueDocs.push(...constants_1.DEFAULT_IMAGE_CONFIG.issue.docs);
    }
    const imagesIssueChoreInput = additionalParams[constants_1.INPUT_KEYS.IMAGES_ISSUE_CHORE] ?? actionInputs[constants_1.INPUT_KEYS.IMAGES_ISSUE_CHORE];
    const imagesIssueChore = imagesIssueChoreInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    if (imagesIssueChore.length === 0) {
        imagesIssueChore.push(...constants_1.DEFAULT_IMAGE_CONFIG.issue.chore);
    }
    const imagesIssueReleaseInput = additionalParams[constants_1.INPUT_KEYS.IMAGES_ISSUE_RELEASE] ?? actionInputs[constants_1.INPUT_KEYS.IMAGES_ISSUE_RELEASE];
    const imagesIssueRelease = imagesIssueReleaseInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    if (imagesIssueRelease.length === 0) {
        imagesIssueRelease.push(...constants_1.DEFAULT_IMAGE_CONFIG.issue.release);
    }
    const imagesIssueHotfixInput = additionalParams[constants_1.INPUT_KEYS.IMAGES_ISSUE_HOTFIX] ?? actionInputs[constants_1.INPUT_KEYS.IMAGES_ISSUE_HOTFIX];
    const imagesIssueHotfix = imagesIssueHotfixInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    if (imagesIssueHotfix.length === 0) {
        imagesIssueHotfix.push(...constants_1.DEFAULT_IMAGE_CONFIG.issue.hotfix);
    }
    const imagesPullRequestAutomaticInput = additionalParams[constants_1.INPUT_KEYS.IMAGES_PULL_REQUEST_AUTOMATIC] ?? actionInputs[constants_1.INPUT_KEYS.IMAGES_PULL_REQUEST_AUTOMATIC];
    const imagesPullRequestAutomatic = imagesPullRequestAutomaticInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    if (imagesPullRequestAutomatic.length === 0) {
        imagesPullRequestAutomatic.push(...constants_1.DEFAULT_IMAGE_CONFIG.pullRequest.automatic);
    }
    const imagesPullRequestFeatureInput = additionalParams[constants_1.INPUT_KEYS.IMAGES_PULL_REQUEST_FEATURE] ?? actionInputs[constants_1.INPUT_KEYS.IMAGES_PULL_REQUEST_FEATURE];
    const imagesPullRequestFeature = imagesPullRequestFeatureInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    if (imagesPullRequestFeature.length === 0) {
        imagesPullRequestFeature.push(...constants_1.DEFAULT_IMAGE_CONFIG.pullRequest.feature);
    }
    const imagesPullRequestBugfixInput = additionalParams[constants_1.INPUT_KEYS.IMAGES_PULL_REQUEST_BUGFIX] ?? actionInputs[constants_1.INPUT_KEYS.IMAGES_PULL_REQUEST_BUGFIX];
    const imagesPullRequestBugfix = imagesPullRequestBugfixInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    if (imagesPullRequestBugfix.length === 0) {
        imagesPullRequestBugfix.push(...constants_1.DEFAULT_IMAGE_CONFIG.pullRequest.bugfix);
    }
    const imagesPullRequestReleaseInput = additionalParams[constants_1.INPUT_KEYS.IMAGES_PULL_REQUEST_RELEASE] ?? actionInputs[constants_1.INPUT_KEYS.IMAGES_PULL_REQUEST_RELEASE];
    const imagesPullRequestRelease = imagesPullRequestReleaseInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    if (imagesPullRequestRelease.length === 0) {
        imagesPullRequestRelease.push(...constants_1.DEFAULT_IMAGE_CONFIG.pullRequest.release);
    }
    const imagesPullRequestHotfixInput = additionalParams[constants_1.INPUT_KEYS.IMAGES_PULL_REQUEST_HOTFIX] ?? actionInputs[constants_1.INPUT_KEYS.IMAGES_PULL_REQUEST_HOTFIX];
    const imagesPullRequestHotfix = imagesPullRequestHotfixInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    if (imagesPullRequestHotfix.length === 0) {
        imagesPullRequestHotfix.push(...constants_1.DEFAULT_IMAGE_CONFIG.pullRequest.hotfix);
    }
    const imagesPullRequestDocsInput = additionalParams[constants_1.INPUT_KEYS.IMAGES_PULL_REQUEST_DOCS] ?? actionInputs[constants_1.INPUT_KEYS.IMAGES_PULL_REQUEST_DOCS];
    const imagesPullRequestDocs = imagesPullRequestDocsInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    if (imagesPullRequestDocs.length === 0) {
        imagesPullRequestDocs.push(...constants_1.DEFAULT_IMAGE_CONFIG.pullRequest.docs);
    }
    const imagesPullRequestChoreInput = additionalParams[constants_1.INPUT_KEYS.IMAGES_PULL_REQUEST_CHORE] ?? actionInputs[constants_1.INPUT_KEYS.IMAGES_PULL_REQUEST_CHORE];
    const imagesPullRequestChore = imagesPullRequestChoreInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    if (imagesPullRequestChore.length === 0) {
        imagesPullRequestChore.push(...constants_1.DEFAULT_IMAGE_CONFIG.pullRequest.chore);
    }
    const imagesCommitAutomaticInput = additionalParams[constants_1.INPUT_KEYS.IMAGES_COMMIT_AUTOMATIC] ?? actionInputs[constants_1.INPUT_KEYS.IMAGES_COMMIT_AUTOMATIC];
    const imagesCommitAutomatic = imagesCommitAutomaticInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    if (imagesCommitAutomatic.length === 0) {
        imagesCommitAutomatic.push(...constants_1.DEFAULT_IMAGE_CONFIG.commit.automatic);
    }
    const imagesCommitFeatureInput = additionalParams[constants_1.INPUT_KEYS.IMAGES_COMMIT_FEATURE] ?? actionInputs[constants_1.INPUT_KEYS.IMAGES_COMMIT_FEATURE];
    const imagesCommitFeature = imagesCommitFeatureInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    if (imagesCommitFeature.length === 0) {
        imagesCommitFeature.push(...constants_1.DEFAULT_IMAGE_CONFIG.commit.feature);
    }
    const imagesCommitBugfixInput = additionalParams[constants_1.INPUT_KEYS.IMAGES_COMMIT_BUGFIX] ?? actionInputs[constants_1.INPUT_KEYS.IMAGES_COMMIT_BUGFIX];
    const imagesCommitBugfix = imagesCommitBugfixInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    if (imagesCommitBugfix.length === 0) {
        imagesCommitBugfix.push(...constants_1.DEFAULT_IMAGE_CONFIG.commit.bugfix);
    }
    const imagesCommitReleaseInput = additionalParams[constants_1.INPUT_KEYS.IMAGES_COMMIT_RELEASE] ?? actionInputs[constants_1.INPUT_KEYS.IMAGES_COMMIT_RELEASE];
    const imagesCommitRelease = imagesCommitReleaseInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    if (imagesCommitRelease.length === 0) {
        imagesCommitRelease.push(...constants_1.DEFAULT_IMAGE_CONFIG.commit.release);
    }
    const imagesCommitHotfixInput = additionalParams[constants_1.INPUT_KEYS.IMAGES_COMMIT_HOTFIX] ?? actionInputs[constants_1.INPUT_KEYS.IMAGES_COMMIT_HOTFIX];
    const imagesCommitHotfix = imagesCommitHotfixInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    if (imagesCommitHotfix.length === 0) {
        imagesCommitHotfix.push(...constants_1.DEFAULT_IMAGE_CONFIG.commit.hotfix);
    }
    const imagesCommitDocsInput = additionalParams[constants_1.INPUT_KEYS.IMAGES_COMMIT_DOCS] ?? actionInputs[constants_1.INPUT_KEYS.IMAGES_COMMIT_DOCS];
    const imagesCommitDocs = imagesCommitDocsInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    if (imagesCommitDocs.length === 0) {
        imagesCommitDocs.push(...constants_1.DEFAULT_IMAGE_CONFIG.commit.docs);
    }
    const imagesCommitChoreInput = additionalParams[constants_1.INPUT_KEYS.IMAGES_COMMIT_CHORE] ?? actionInputs[constants_1.INPUT_KEYS.IMAGES_COMMIT_CHORE];
    const imagesCommitChore = imagesCommitChoreInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    if (imagesCommitChore.length === 0) {
        imagesCommitChore.push(...constants_1.DEFAULT_IMAGE_CONFIG.commit.chore);
    }
    /**
     * Workflows
     */
    const releaseWorkflow = additionalParams[constants_1.INPUT_KEYS.RELEASE_WORKFLOW] ?? actionInputs[constants_1.INPUT_KEYS.RELEASE_WORKFLOW];
    const hotfixWorkflow = additionalParams[constants_1.INPUT_KEYS.HOTFIX_WORKFLOW] ?? actionInputs[constants_1.INPUT_KEYS.HOTFIX_WORKFLOW];
    /**
     * Emoji-title
     */
    const titleEmoji = (additionalParams[constants_1.INPUT_KEYS.EMOJI_LABELED_TITLE] ?? actionInputs[constants_1.INPUT_KEYS.EMOJI_LABELED_TITLE]) === 'true';
    const branchManagementEmoji = additionalParams[constants_1.INPUT_KEYS.BRANCH_MANAGEMENT_EMOJI] ?? actionInputs[constants_1.INPUT_KEYS.BRANCH_MANAGEMENT_EMOJI];
    /**
     * Labels
     */
    const branchManagementLauncherLabel = additionalParams[constants_1.INPUT_KEYS.BRANCH_MANAGEMENT_LAUNCHER_LABEL] ?? actionInputs[constants_1.INPUT_KEYS.BRANCH_MANAGEMENT_LAUNCHER_LABEL];
    const bugfixLabel = additionalParams[constants_1.INPUT_KEYS.BUGFIX_LABEL] ?? actionInputs[constants_1.INPUT_KEYS.BUGFIX_LABEL];
    const bugLabel = additionalParams[constants_1.INPUT_KEYS.BUG_LABEL] ?? actionInputs[constants_1.INPUT_KEYS.BUG_LABEL];
    const hotfixLabel = additionalParams[constants_1.INPUT_KEYS.HOTFIX_LABEL] ?? actionInputs[constants_1.INPUT_KEYS.HOTFIX_LABEL];
    const enhancementLabel = additionalParams[constants_1.INPUT_KEYS.ENHANCEMENT_LABEL] ?? actionInputs[constants_1.INPUT_KEYS.ENHANCEMENT_LABEL];
    const featureLabel = additionalParams[constants_1.INPUT_KEYS.FEATURE_LABEL] ?? actionInputs[constants_1.INPUT_KEYS.FEATURE_LABEL];
    const releaseLabel = additionalParams[constants_1.INPUT_KEYS.RELEASE_LABEL] ?? actionInputs[constants_1.INPUT_KEYS.RELEASE_LABEL];
    const questionLabel = additionalParams[constants_1.INPUT_KEYS.QUESTION_LABEL] ?? actionInputs[constants_1.INPUT_KEYS.QUESTION_LABEL];
    const helpLabel = additionalParams[constants_1.INPUT_KEYS.HELP_LABEL] ?? actionInputs[constants_1.INPUT_KEYS.HELP_LABEL];
    const deployLabel = additionalParams[constants_1.INPUT_KEYS.DEPLOY_LABEL] ?? actionInputs[constants_1.INPUT_KEYS.DEPLOY_LABEL];
    const deployedLabel = additionalParams[constants_1.INPUT_KEYS.DEPLOYED_LABEL] ?? actionInputs[constants_1.INPUT_KEYS.DEPLOYED_LABEL];
    const docsLabel = additionalParams[constants_1.INPUT_KEYS.DOCS_LABEL] ?? actionInputs[constants_1.INPUT_KEYS.DOCS_LABEL];
    const documentationLabel = additionalParams[constants_1.INPUT_KEYS.DOCUMENTATION_LABEL] ?? actionInputs[constants_1.INPUT_KEYS.DOCUMENTATION_LABEL];
    const choreLabel = additionalParams[constants_1.INPUT_KEYS.CHORE_LABEL] ?? actionInputs[constants_1.INPUT_KEYS.CHORE_LABEL];
    const maintenanceLabel = additionalParams[constants_1.INPUT_KEYS.MAINTENANCE_LABEL] ?? actionInputs[constants_1.INPUT_KEYS.MAINTENANCE_LABEL];
    const priorityHighLabel = additionalParams[constants_1.INPUT_KEYS.PRIORITY_HIGH_LABEL] ?? actionInputs[constants_1.INPUT_KEYS.PRIORITY_HIGH_LABEL];
    const priorityMediumLabel = additionalParams[constants_1.INPUT_KEYS.PRIORITY_MEDIUM_LABEL] ?? actionInputs[constants_1.INPUT_KEYS.PRIORITY_MEDIUM_LABEL];
    const priorityLowLabel = additionalParams[constants_1.INPUT_KEYS.PRIORITY_LOW_LABEL] ?? actionInputs[constants_1.INPUT_KEYS.PRIORITY_LOW_LABEL];
    const priorityNoneLabel = additionalParams[constants_1.INPUT_KEYS.PRIORITY_NONE_LABEL] ?? actionInputs[constants_1.INPUT_KEYS.PRIORITY_NONE_LABEL];
    const sizeXxlLabel = additionalParams[constants_1.INPUT_KEYS.SIZE_XXL_LABEL] ?? actionInputs[constants_1.INPUT_KEYS.SIZE_XXL_LABEL];
    const sizeXlLabel = additionalParams[constants_1.INPUT_KEYS.SIZE_XL_LABEL] ?? actionInputs[constants_1.INPUT_KEYS.SIZE_XL_LABEL];
    const sizeLLabel = additionalParams[constants_1.INPUT_KEYS.SIZE_L_LABEL] ?? actionInputs[constants_1.INPUT_KEYS.SIZE_L_LABEL];
    const sizeMLabel = additionalParams[constants_1.INPUT_KEYS.SIZE_M_LABEL] ?? actionInputs[constants_1.INPUT_KEYS.SIZE_M_LABEL];
    const sizeSLabel = additionalParams[constants_1.INPUT_KEYS.SIZE_S_LABEL] ?? actionInputs[constants_1.INPUT_KEYS.SIZE_S_LABEL];
    const sizeXsLabel = additionalParams[constants_1.INPUT_KEYS.SIZE_XS_LABEL] ?? actionInputs[constants_1.INPUT_KEYS.SIZE_XS_LABEL];
    /**
     * Issue Types
     */
    const issueTypeBug = additionalParams[constants_1.INPUT_KEYS.ISSUE_TYPE_BUG] ?? actionInputs[constants_1.INPUT_KEYS.ISSUE_TYPE_BUG];
    const issueTypeHotfix = additionalParams[constants_1.INPUT_KEYS.ISSUE_TYPE_HOTFIX] ?? actionInputs[constants_1.INPUT_KEYS.ISSUE_TYPE_HOTFIX];
    const issueTypeFeature = additionalParams[constants_1.INPUT_KEYS.ISSUE_TYPE_FEATURE] ?? actionInputs[constants_1.INPUT_KEYS.ISSUE_TYPE_FEATURE];
    const issueTypeDocumentation = additionalParams[constants_1.INPUT_KEYS.ISSUE_TYPE_DOCUMENTATION] ?? actionInputs[constants_1.INPUT_KEYS.ISSUE_TYPE_DOCUMENTATION];
    const issueTypeMaintenance = additionalParams[constants_1.INPUT_KEYS.ISSUE_TYPE_MAINTENANCE] ?? actionInputs[constants_1.INPUT_KEYS.ISSUE_TYPE_MAINTENANCE];
    const issueTypeRelease = additionalParams[constants_1.INPUT_KEYS.ISSUE_TYPE_RELEASE] ?? actionInputs[constants_1.INPUT_KEYS.ISSUE_TYPE_RELEASE];
    const issueTypeQuestion = additionalParams[constants_1.INPUT_KEYS.ISSUE_TYPE_QUESTION] ?? actionInputs[constants_1.INPUT_KEYS.ISSUE_TYPE_QUESTION];
    const issueTypeHelp = additionalParams[constants_1.INPUT_KEYS.ISSUE_TYPE_HELP] ?? actionInputs[constants_1.INPUT_KEYS.ISSUE_TYPE_HELP];
    const issueTypeTask = additionalParams[constants_1.INPUT_KEYS.ISSUE_TYPE_TASK] ?? actionInputs[constants_1.INPUT_KEYS.ISSUE_TYPE_TASK];
    /**
     * Locale
     */
    const issueLocale = additionalParams[constants_1.INPUT_KEYS.ISSUES_LOCALE] ?? actionInputs[constants_1.INPUT_KEYS.ISSUES_LOCALE] ?? locale_1.Locale.DEFAULT;
    const pullRequestLocale = additionalParams[constants_1.INPUT_KEYS.PULL_REQUESTS_LOCALE] ?? actionInputs[constants_1.INPUT_KEYS.PULL_REQUESTS_LOCALE] ?? locale_1.Locale.DEFAULT;
    /**
     * Size Thresholds
     */
    const sizeXxlThresholdLines = parseInt(additionalParams[constants_1.INPUT_KEYS.SIZE_XXL_THRESHOLD_LINES] ?? actionInputs[constants_1.INPUT_KEYS.SIZE_XXL_THRESHOLD_LINES]) ?? 1000;
    const sizeXxlThresholdFiles = parseInt(additionalParams[constants_1.INPUT_KEYS.SIZE_XXL_THRESHOLD_FILES] ?? actionInputs[constants_1.INPUT_KEYS.SIZE_XXL_THRESHOLD_FILES]) ?? 20;
    const sizeXxlThresholdCommits = parseInt(additionalParams[constants_1.INPUT_KEYS.SIZE_XXL_THRESHOLD_COMMITS] ?? actionInputs[constants_1.INPUT_KEYS.SIZE_XXL_THRESHOLD_COMMITS]) ?? 10;
    const sizeXlThresholdLines = parseInt(additionalParams[constants_1.INPUT_KEYS.SIZE_XL_THRESHOLD_LINES] ?? actionInputs[constants_1.INPUT_KEYS.SIZE_XL_THRESHOLD_LINES]) ?? 500;
    const sizeXlThresholdFiles = parseInt(additionalParams[constants_1.INPUT_KEYS.SIZE_XL_THRESHOLD_FILES] ?? actionInputs[constants_1.INPUT_KEYS.SIZE_XL_THRESHOLD_FILES]) ?? 10;
    const sizeXlThresholdCommits = parseInt(additionalParams[constants_1.INPUT_KEYS.SIZE_XL_THRESHOLD_COMMITS] ?? actionInputs[constants_1.INPUT_KEYS.SIZE_XL_THRESHOLD_COMMITS]) ?? 5;
    const sizeLThresholdLines = parseInt(additionalParams[constants_1.INPUT_KEYS.SIZE_L_THRESHOLD_LINES] ?? actionInputs[constants_1.INPUT_KEYS.SIZE_L_THRESHOLD_LINES]) ?? 250;
    const sizeLThresholdFiles = parseInt(additionalParams[constants_1.INPUT_KEYS.SIZE_L_THRESHOLD_FILES] ?? actionInputs[constants_1.INPUT_KEYS.SIZE_L_THRESHOLD_FILES]) ?? 5;
    const sizeLThresholdCommits = parseInt(additionalParams[constants_1.INPUT_KEYS.SIZE_L_THRESHOLD_COMMITS] ?? actionInputs[constants_1.INPUT_KEYS.SIZE_L_THRESHOLD_COMMITS]) ?? 3;
    const sizeMThresholdLines = parseInt(additionalParams[constants_1.INPUT_KEYS.SIZE_M_THRESHOLD_LINES] ?? actionInputs[constants_1.INPUT_KEYS.SIZE_M_THRESHOLD_LINES]) ?? 100;
    const sizeMThresholdFiles = parseInt(additionalParams[constants_1.INPUT_KEYS.SIZE_M_THRESHOLD_FILES] ?? actionInputs[constants_1.INPUT_KEYS.SIZE_M_THRESHOLD_FILES]) ?? 3;
    const sizeMThresholdCommits = parseInt(additionalParams[constants_1.INPUT_KEYS.SIZE_M_THRESHOLD_COMMITS] ?? actionInputs[constants_1.INPUT_KEYS.SIZE_M_THRESHOLD_COMMITS]) ?? 2;
    const sizeSThresholdLines = parseInt(additionalParams[constants_1.INPUT_KEYS.SIZE_S_THRESHOLD_LINES] ?? actionInputs[constants_1.INPUT_KEYS.SIZE_S_THRESHOLD_LINES]) ?? 50;
    const sizeSThresholdFiles = parseInt(additionalParams[constants_1.INPUT_KEYS.SIZE_S_THRESHOLD_FILES] ?? actionInputs[constants_1.INPUT_KEYS.SIZE_S_THRESHOLD_FILES]) ?? 2;
    const sizeSThresholdCommits = parseInt(additionalParams[constants_1.INPUT_KEYS.SIZE_S_THRESHOLD_COMMITS] ?? actionInputs[constants_1.INPUT_KEYS.SIZE_S_THRESHOLD_COMMITS]) ?? 1;
    const sizeXsThresholdLines = parseInt(additionalParams[constants_1.INPUT_KEYS.SIZE_XS_THRESHOLD_LINES] ?? actionInputs[constants_1.INPUT_KEYS.SIZE_XS_THRESHOLD_LINES]) ?? 25;
    const sizeXsThresholdFiles = parseInt(additionalParams[constants_1.INPUT_KEYS.SIZE_XS_THRESHOLD_FILES] ?? actionInputs[constants_1.INPUT_KEYS.SIZE_XS_THRESHOLD_FILES]) ?? 1;
    const sizeXsThresholdCommits = parseInt(additionalParams[constants_1.INPUT_KEYS.SIZE_XS_THRESHOLD_COMMITS] ?? actionInputs[constants_1.INPUT_KEYS.SIZE_XS_THRESHOLD_COMMITS]) ?? 1;
    /**
     * Branches
     */
    const mainBranch = additionalParams[constants_1.INPUT_KEYS.MAIN_BRANCH] ?? actionInputs[constants_1.INPUT_KEYS.MAIN_BRANCH];
    const developmentBranch = additionalParams[constants_1.INPUT_KEYS.DEVELOPMENT_BRANCH] ?? actionInputs[constants_1.INPUT_KEYS.DEVELOPMENT_BRANCH];
    const featureTree = additionalParams[constants_1.INPUT_KEYS.FEATURE_TREE] ?? actionInputs[constants_1.INPUT_KEYS.FEATURE_TREE];
    const bugfixTree = additionalParams[constants_1.INPUT_KEYS.BUGFIX_TREE] ?? actionInputs[constants_1.INPUT_KEYS.BUGFIX_TREE];
    const hotfixTree = additionalParams[constants_1.INPUT_KEYS.HOTFIX_TREE] ?? actionInputs[constants_1.INPUT_KEYS.HOTFIX_TREE];
    const releaseTree = additionalParams[constants_1.INPUT_KEYS.RELEASE_TREE] ?? actionInputs[constants_1.INPUT_KEYS.RELEASE_TREE];
    const docsTree = additionalParams[constants_1.INPUT_KEYS.DOCS_TREE] ?? actionInputs[constants_1.INPUT_KEYS.DOCS_TREE];
    const choreTree = additionalParams[constants_1.INPUT_KEYS.CHORE_TREE] ?? actionInputs[constants_1.INPUT_KEYS.CHORE_TREE];
    /**
     * Prefix builder
     */
    let commitPrefixBuilder = additionalParams[constants_1.INPUT_KEYS.COMMIT_PREFIX_BUILDER] ?? actionInputs[constants_1.INPUT_KEYS.COMMIT_PREFIX_BUILDER] ?? '';
    if (commitPrefixBuilder.length === 0) {
        commitPrefixBuilder = 'branchName.replace("/", "-");';
    }
    /**
     * Issue
     */
    const branchManagementAlways = (additionalParams[constants_1.INPUT_KEYS.BRANCH_MANAGEMENT_ALWAYS] ?? actionInputs[constants_1.INPUT_KEYS.BRANCH_MANAGEMENT_ALWAYS]) === 'true';
    const reopenIssueOnPush = (additionalParams[constants_1.INPUT_KEYS.REOPEN_ISSUE_ON_PUSH] ?? actionInputs[constants_1.INPUT_KEYS.REOPEN_ISSUE_ON_PUSH]) === 'true';
    const issueDesiredAssigneesCount = parseInt(additionalParams[constants_1.INPUT_KEYS.DESIRED_ASSIGNEES_COUNT] ?? actionInputs[constants_1.INPUT_KEYS.DESIRED_ASSIGNEES_COUNT]) ?? 0;
    /**
     * Pull Request
     */
    const pullRequestDesiredAssigneesCount = parseInt(additionalParams[constants_1.INPUT_KEYS.PULL_REQUEST_DESIRED_ASSIGNEES_COUNT] ?? actionInputs[constants_1.INPUT_KEYS.PULL_REQUEST_DESIRED_ASSIGNEES_COUNT]) ?? 0;
    const pullRequestDesiredReviewersCount = parseInt(additionalParams[constants_1.INPUT_KEYS.PULL_REQUEST_DESIRED_REVIEWERS_COUNT] ?? actionInputs[constants_1.INPUT_KEYS.PULL_REQUEST_DESIRED_REVIEWERS_COUNT]) ?? 0;
    const pullRequestMergeTimeout = parseInt(additionalParams[constants_1.INPUT_KEYS.PULL_REQUEST_MERGE_TIMEOUT] ?? actionInputs[constants_1.INPUT_KEYS.PULL_REQUEST_MERGE_TIMEOUT]) ?? 0;
    /**
     * Supabase
     */
    const supabaseUrl = additionalParams[constants_1.INPUT_KEYS.SUPABASE_URL] ?? actionInputs[constants_1.INPUT_KEYS.SUPABASE_URL];
    const supabaseKey = additionalParams[constants_1.INPUT_KEYS.SUPABASE_KEY] ?? actionInputs[constants_1.INPUT_KEYS.SUPABASE_KEY];
    const execution = new execution_1.Execution(debug, new docker_config_1.DockerConfig(dockerContainerName, dockerDomain, dockerPort), new single_action_1.SingleAction(singleAction, singleActionIssue), commitPrefixBuilder, new issue_1.Issue(branchManagementAlways, reopenIssueOnPush, issueDesiredAssigneesCount, additionalParams), new pull_request_1.PullRequest(pullRequestDesiredAssigneesCount, pullRequestDesiredReviewersCount, pullRequestMergeTimeout, additionalParams), new emoji_1.Emoji(titleEmoji, branchManagementEmoji), new images_1.Images(imagesOnIssue, imagesOnPullRequest, imagesOnCommit, imagesIssueAutomatic, imagesIssueFeature, imagesIssueBugfix, imagesIssueDocs, imagesIssueChore, imagesIssueRelease, imagesIssueHotfix, imagesPullRequestAutomatic, imagesPullRequestFeature, imagesPullRequestBugfix, imagesPullRequestRelease, imagesPullRequestHotfix, imagesPullRequestDocs, imagesPullRequestChore, imagesCommitAutomatic, imagesCommitFeature, imagesCommitBugfix, imagesCommitRelease, imagesCommitHotfix, imagesCommitDocs, imagesCommitChore), new tokens_1.Tokens(token), new ai_1.Ai(openrouterApiKey, openrouterModel, aiPullRequestDescription, aiMembersOnly, aiIgnoreFiles, Object.keys(providerRouting).length > 0 ? providerRouting : undefined), new labels_1.Labels(branchManagementLauncherLabel, bugLabel, bugfixLabel, hotfixLabel, enhancementLabel, featureLabel, releaseLabel, questionLabel, helpLabel, deployLabel, deployedLabel, docsLabel, documentationLabel, choreLabel, maintenanceLabel, priorityHighLabel, priorityMediumLabel, priorityLowLabel, priorityNoneLabel, sizeXxlLabel, sizeXlLabel, sizeLLabel, sizeMLabel, sizeSLabel, sizeXsLabel), new issue_types_1.IssueTypes(issueTypeTask, issueTypeBug, issueTypeFeature, issueTypeDocumentation, issueTypeMaintenance, issueTypeHotfix, issueTypeRelease, issueTypeQuestion, issueTypeHelp), new locale_1.Locale(issueLocale, pullRequestLocale), new size_thresholds_1.SizeThresholds(new size_threshold_1.SizeThreshold(sizeXxlThresholdLines, sizeXxlThresholdFiles, sizeXxlThresholdCommits), new size_threshold_1.SizeThreshold(sizeXlThresholdLines, sizeXlThresholdFiles, sizeXlThresholdCommits), new size_threshold_1.SizeThreshold(sizeLThresholdLines, sizeLThresholdFiles, sizeLThresholdCommits), new size_threshold_1.SizeThreshold(sizeMThresholdLines, sizeMThresholdFiles, sizeMThresholdCommits), new size_threshold_1.SizeThreshold(sizeSThresholdLines, sizeSThresholdFiles, sizeSThresholdCommits), new size_threshold_1.SizeThreshold(sizeXsThresholdLines, sizeXsThresholdFiles, sizeXsThresholdCommits)), new branches_1.Branches(mainBranch, developmentBranch, featureTree, bugfixTree, hotfixTree, releaseTree, docsTree, choreTree), new release_1.Release(), new hotfix_1.Hotfix(), new workflows_1.Workflows(releaseWorkflow, hotfixWorkflow), new projects_1.Projects(projects, projectColumnIssueCreated, projectColumnPullRequestCreated, projectColumnIssueInProgress, projectColumnPullRequestInProgress), new supabase_config_1.SupabaseConfig(supabaseUrl, supabaseKey), additionalParams);
    const results = await (0, common_action_1.mainRun)(execution);
    (0, logger_1.logInfo)(`Results: ${JSON.stringify(results, null, 2)}`);
}

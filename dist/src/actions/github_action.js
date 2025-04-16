"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runGitHubAction = runGitHubAction;
const core = __importStar(require("@actions/core"));
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
const tokens_1 = require("../data/model/tokens");
const workflows_1 = require("../data/model/workflows");
const project_repository_1 = require("../data/repository/project_repository");
const publish_resume_use_case_1 = require("../usecase/steps/common/publish_resume_use_case");
const store_configuration_use_case_1 = require("../usecase/steps/common/store_configuration_use_case");
const constants_1 = require("../utils/constants");
const common_action_1 = require("./common_action");
const supabase_config_1 = require("../data/model/supabase_config");
async function runGitHubAction() {
    const projectRepository = new project_repository_1.ProjectRepository();
    /**
     * Debug
     */
    const debug = core.getInput(constants_1.INPUT_KEYS.DEBUG) == 'true';
    const dockerContainerName = core.getInput(constants_1.INPUT_KEYS.DOCKER_CONTAINER_NAME);
    const dockerDomain = core.getInput(constants_1.INPUT_KEYS.DOCKER_DOMAIN);
    const dockerPort = parseInt(core.getInput(constants_1.INPUT_KEYS.DOCKER_PORT));
    /**
     * Single action
     */
    const singleAction = core.getInput(constants_1.INPUT_KEYS.SINGLE_ACTION);
    const singleActionIssue = core.getInput(constants_1.INPUT_KEYS.SINGLE_ACTION_ISSUE);
    /**
     * Tokens
     */
    const token = core.getInput(constants_1.INPUT_KEYS.TOKEN, { required: true });
    /**
     * AI
     */
    const openrouterApiKey = core.getInput(constants_1.INPUT_KEYS.OPENROUTER_API_KEY);
    const openrouterModel = core.getInput(constants_1.INPUT_KEYS.OPENROUTER_MODEL);
    const aiPullRequestDescription = core.getInput(constants_1.INPUT_KEYS.AI_PULL_REQUEST_DESCRIPTION) === 'true';
    const aiMembersOnly = core.getInput(constants_1.INPUT_KEYS.AI_MEMBERS_ONLY) === 'true';
    const aiIgnoreFilesInput = core.getInput(constants_1.INPUT_KEYS.AI_IGNORE_FILES);
    const aiIgnoreFiles = aiIgnoreFilesInput
        .split(',')
        .map(path => path.trim())
        .filter(path => path.length > 0);
    // Provider routing configuration
    const openRouterProviderOrderInput = core.getInput(constants_1.INPUT_KEYS.OPENROUTER_PROVIDER_ORDER);
    const openRouterProviderOrder = openRouterProviderOrderInput
        .split(',')
        .map(provider => provider.trim())
        .filter(provider => provider.length > 0);
    const openRouterProviderAllowFallbacks = core.getInput(constants_1.INPUT_KEYS.OPENROUTER_PROVIDER_ALLOW_FALLBACKS) === 'true';
    const openRouterProviderRequireParameters = core.getInput(constants_1.INPUT_KEYS.OPENROUTER_PROVIDER_REQUIRE_PARAMETERS) === 'true';
    const openRouterProviderDataCollection = core.getInput(constants_1.INPUT_KEYS.OPENROUTER_PROVIDER_DATA_COLLECTION);
    const openRouterProviderIgnoreInput = core.getInput(constants_1.INPUT_KEYS.OPENROUTER_PROVIDER_IGNORE);
    const openRouterProviderIgnore = openRouterProviderIgnoreInput
        .split(',')
        .map(provider => provider.trim())
        .filter(provider => provider.length > 0);
    const openRouterProviderQuantizationsInput = core.getInput(constants_1.INPUT_KEYS.OPENROUTER_PROVIDER_QUANTIZATIONS);
    const openRouterProviderQuantizations = openRouterProviderQuantizationsInput
        .split(',')
        .map(level => level.trim())
        .filter(level => level.length > 0);
    const openRouterProviderSort = core.getInput(constants_1.INPUT_KEYS.OPENROUTER_PROVIDER_SORT);
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
    const projectIdsInput = core.getInput(constants_1.INPUT_KEYS.PROJECT_IDS);
    const projectIds = projectIdsInput
        .split(',')
        .map(id => id.trim())
        .filter(id => id.length > 0);
    const projects = [];
    for (const projectId of projectIds) {
        const detail = await projectRepository.getProjectDetail(projectId, token);
        projects.push(detail);
    }
    const projectColumnIssueCreated = core.getInput(constants_1.INPUT_KEYS.PROJECT_COLUMN_ISSUE_CREATED);
    const projectColumnPullRequestCreated = core.getInput(constants_1.INPUT_KEYS.PROJECT_COLUMN_PULL_REQUEST_CREATED);
    const projectColumnIssueInProgress = core.getInput(constants_1.INPUT_KEYS.PROJECT_COLUMN_ISSUE_IN_PROGRESS);
    const projectColumnPullRequestInProgress = core.getInput(constants_1.INPUT_KEYS.PROJECT_COLUMN_PULL_REQUEST_IN_PROGRESS);
    /**
     * Images
     */
    const imagesOnIssue = core.getInput(constants_1.INPUT_KEYS.IMAGES_ON_ISSUE) === 'true';
    const imagesOnPullRequest = core.getInput(constants_1.INPUT_KEYS.IMAGES_ON_PULL_REQUEST) === 'true';
    const imagesOnCommit = core.getInput(constants_1.INPUT_KEYS.IMAGES_ON_COMMIT) === 'true';
    const imagesIssueAutomaticInput = core.getInput(constants_1.INPUT_KEYS.IMAGES_ISSUE_AUTOMATIC);
    const imagesIssueAutomatic = imagesIssueAutomaticInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    if (imagesIssueAutomatic.length === 0) {
        imagesIssueAutomatic.push(...constants_1.DEFAULT_IMAGE_CONFIG.issue.automatic);
    }
    const imagesIssueFeatureInput = core.getInput(constants_1.INPUT_KEYS.IMAGES_ISSUE_FEATURE);
    const imagesIssueFeature = imagesIssueFeatureInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    if (imagesIssueFeature.length === 0) {
        imagesIssueFeature.push(...constants_1.DEFAULT_IMAGE_CONFIG.issue.feature);
    }
    const imagesIssueBugfixInput = core.getInput(constants_1.INPUT_KEYS.IMAGES_ISSUE_BUGFIX);
    const imagesIssueBugfix = imagesIssueBugfixInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    if (imagesIssueBugfix.length === 0) {
        imagesIssueBugfix.push(...constants_1.DEFAULT_IMAGE_CONFIG.issue.bugfix);
    }
    const imagesIssueDocsInput = core.getInput(constants_1.INPUT_KEYS.IMAGES_ISSUE_DOCS);
    const imagesIssueDocs = imagesIssueDocsInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    if (imagesIssueDocs.length === 0) {
        imagesIssueDocs.push(...constants_1.DEFAULT_IMAGE_CONFIG.issue.docs);
    }
    const imagesIssueChoreInput = core.getInput(constants_1.INPUT_KEYS.IMAGES_ISSUE_CHORE);
    const imagesIssueChore = imagesIssueChoreInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    if (imagesIssueChore.length === 0) {
        imagesIssueChore.push(...constants_1.DEFAULT_IMAGE_CONFIG.issue.chore);
    }
    const imagesIssueReleaseInput = core.getInput(constants_1.INPUT_KEYS.IMAGES_ISSUE_RELEASE);
    const imagesIssueRelease = imagesIssueReleaseInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    if (imagesIssueRelease.length === 0) {
        imagesIssueRelease.push(...constants_1.DEFAULT_IMAGE_CONFIG.issue.release);
    }
    const imagesIssueHotfixInput = core.getInput(constants_1.INPUT_KEYS.IMAGES_ISSUE_HOTFIX);
    const imagesIssueHotfix = imagesIssueHotfixInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    if (imagesIssueHotfix.length === 0) {
        imagesIssueHotfix.push(...constants_1.DEFAULT_IMAGE_CONFIG.issue.hotfix);
    }
    const imagesPullRequestAutomaticInput = core.getInput(constants_1.INPUT_KEYS.IMAGES_PULL_REQUEST_AUTOMATIC);
    const imagesPullRequestAutomatic = imagesPullRequestAutomaticInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    if (imagesPullRequestAutomatic.length === 0) {
        imagesPullRequestAutomatic.push(...constants_1.DEFAULT_IMAGE_CONFIG.pullRequest.automatic);
    }
    const imagesPullRequestFeatureInput = core.getInput(constants_1.INPUT_KEYS.IMAGES_PULL_REQUEST_FEATURE);
    const imagesPullRequestFeature = imagesPullRequestFeatureInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    if (imagesPullRequestFeature.length === 0) {
        imagesPullRequestFeature.push(...constants_1.DEFAULT_IMAGE_CONFIG.pullRequest.feature);
    }
    const imagesPullRequestBugfixInput = core.getInput(constants_1.INPUT_KEYS.IMAGES_PULL_REQUEST_BUGFIX);
    const imagesPullRequestBugfix = imagesPullRequestBugfixInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    if (imagesPullRequestBugfix.length === 0) {
        imagesPullRequestBugfix.push(...constants_1.DEFAULT_IMAGE_CONFIG.pullRequest.bugfix);
    }
    const imagesPullRequestReleaseInput = core.getInput(constants_1.INPUT_KEYS.IMAGES_PULL_REQUEST_RELEASE);
    const imagesPullRequestRelease = imagesPullRequestReleaseInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    if (imagesPullRequestRelease.length === 0) {
        imagesPullRequestRelease.push(...constants_1.DEFAULT_IMAGE_CONFIG.pullRequest.release);
    }
    const imagesPullRequestHotfixInput = core.getInput(constants_1.INPUT_KEYS.IMAGES_PULL_REQUEST_HOTFIX);
    const imagesPullRequestHotfix = imagesPullRequestHotfixInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    if (imagesPullRequestHotfix.length === 0) {
        imagesPullRequestHotfix.push(...constants_1.DEFAULT_IMAGE_CONFIG.pullRequest.hotfix);
    }
    const imagesPullRequestDocsInput = core.getInput(constants_1.INPUT_KEYS.IMAGES_PULL_REQUEST_DOCS);
    const imagesPullRequestDocs = imagesPullRequestDocsInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    if (imagesPullRequestDocs.length === 0) {
        imagesPullRequestDocs.push(...constants_1.DEFAULT_IMAGE_CONFIG.pullRequest.docs);
    }
    const imagesPullRequestChoreInput = core.getInput(constants_1.INPUT_KEYS.IMAGES_PULL_REQUEST_CHORE);
    const imagesPullRequestChore = imagesPullRequestChoreInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    if (imagesPullRequestChore.length === 0) {
        imagesPullRequestChore.push(...constants_1.DEFAULT_IMAGE_CONFIG.pullRequest.chore);
    }
    const imagesCommitAutomaticInput = core.getInput(constants_1.INPUT_KEYS.IMAGES_COMMIT_AUTOMATIC);
    const imagesCommitAutomatic = imagesCommitAutomaticInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    if (imagesCommitAutomatic.length === 0) {
        imagesCommitAutomatic.push(...constants_1.DEFAULT_IMAGE_CONFIG.commit.automatic);
    }
    const imagesCommitFeatureInput = core.getInput(constants_1.INPUT_KEYS.IMAGES_COMMIT_FEATURE);
    const imagesCommitFeature = imagesCommitFeatureInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    if (imagesCommitFeature.length === 0) {
        imagesCommitFeature.push(...constants_1.DEFAULT_IMAGE_CONFIG.commit.feature);
    }
    const imagesCommitBugfixInput = core.getInput(constants_1.INPUT_KEYS.IMAGES_COMMIT_BUGFIX);
    const imagesCommitBugfix = imagesCommitBugfixInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    if (imagesCommitBugfix.length === 0) {
        imagesCommitBugfix.push(...constants_1.DEFAULT_IMAGE_CONFIG.commit.bugfix);
    }
    const imagesCommitReleaseInput = core.getInput(constants_1.INPUT_KEYS.IMAGES_COMMIT_RELEASE);
    const imagesCommitRelease = imagesCommitReleaseInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    if (imagesCommitRelease.length === 0) {
        imagesCommitRelease.push(...constants_1.DEFAULT_IMAGE_CONFIG.commit.release);
    }
    const imagesCommitHotfixInput = core.getInput(constants_1.INPUT_KEYS.IMAGES_COMMIT_HOTFIX);
    const imagesCommitHotfix = imagesCommitHotfixInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    if (imagesCommitHotfix.length === 0) {
        imagesCommitHotfix.push(...constants_1.DEFAULT_IMAGE_CONFIG.commit.hotfix);
    }
    const imagesCommitDocsInput = core.getInput(constants_1.INPUT_KEYS.IMAGES_COMMIT_DOCS);
    const imagesCommitDocs = imagesCommitDocsInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    if (imagesCommitDocs.length === 0) {
        imagesCommitDocs.push(...constants_1.DEFAULT_IMAGE_CONFIG.commit.docs);
    }
    const imagesCommitChoreInput = core.getInput(constants_1.INPUT_KEYS.IMAGES_COMMIT_CHORE);
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
    const releaseWorkflow = core.getInput(constants_1.INPUT_KEYS.RELEASE_WORKFLOW);
    const hotfixWorkflow = core.getInput(constants_1.INPUT_KEYS.HOTFIX_WORKFLOW);
    /**
     * Emoji-title
     */
    const titleEmoji = core.getInput(constants_1.INPUT_KEYS.EMOJI_LABELED_TITLE) === 'true';
    const branchManagementEmoji = core.getInput(constants_1.INPUT_KEYS.BRANCH_MANAGEMENT_EMOJI);
    /**
     * Labels
     */
    const branchManagementLauncherLabel = core.getInput(constants_1.INPUT_KEYS.BRANCH_MANAGEMENT_LAUNCHER_LABEL);
    const bugfixLabel = core.getInput(constants_1.INPUT_KEYS.BUGFIX_LABEL);
    const bugLabel = core.getInput(constants_1.INPUT_KEYS.BUG_LABEL);
    const hotfixLabel = core.getInput(constants_1.INPUT_KEYS.HOTFIX_LABEL);
    const enhancementLabel = core.getInput(constants_1.INPUT_KEYS.ENHANCEMENT_LABEL);
    const featureLabel = core.getInput(constants_1.INPUT_KEYS.FEATURE_LABEL);
    const releaseLabel = core.getInput(constants_1.INPUT_KEYS.RELEASE_LABEL);
    const questionLabel = core.getInput(constants_1.INPUT_KEYS.QUESTION_LABEL);
    const helpLabel = core.getInput(constants_1.INPUT_KEYS.HELP_LABEL);
    const deployLabel = core.getInput(constants_1.INPUT_KEYS.DEPLOY_LABEL);
    const deployedLabel = core.getInput(constants_1.INPUT_KEYS.DEPLOYED_LABEL);
    const docsLabel = core.getInput(constants_1.INPUT_KEYS.DOCS_LABEL);
    const documentationLabel = core.getInput(constants_1.INPUT_KEYS.DOCUMENTATION_LABEL);
    const choreLabel = core.getInput(constants_1.INPUT_KEYS.CHORE_LABEL);
    const maintenanceLabel = core.getInput(constants_1.INPUT_KEYS.MAINTENANCE_LABEL);
    const priorityHighLabel = core.getInput(constants_1.INPUT_KEYS.PRIORITY_HIGH_LABEL);
    const priorityMediumLabel = core.getInput(constants_1.INPUT_KEYS.PRIORITY_MEDIUM_LABEL);
    const priorityLowLabel = core.getInput(constants_1.INPUT_KEYS.PRIORITY_LOW_LABEL);
    const priorityNoneLabel = core.getInput(constants_1.INPUT_KEYS.PRIORITY_NONE_LABEL);
    const sizeXxlLabel = core.getInput(constants_1.INPUT_KEYS.SIZE_XXL_LABEL);
    const sizeXlLabel = core.getInput(constants_1.INPUT_KEYS.SIZE_XL_LABEL);
    const sizeLLabel = core.getInput(constants_1.INPUT_KEYS.SIZE_L_LABEL);
    const sizeMLabel = core.getInput(constants_1.INPUT_KEYS.SIZE_M_LABEL);
    const sizeSLabel = core.getInput(constants_1.INPUT_KEYS.SIZE_S_LABEL);
    const sizeXsLabel = core.getInput(constants_1.INPUT_KEYS.SIZE_XS_LABEL);
    /**
     * Issue Types
     */
    const issueTypeBug = core.getInput(constants_1.INPUT_KEYS.ISSUE_TYPE_BUG);
    const issueTypeHotfix = core.getInput(constants_1.INPUT_KEYS.ISSUE_TYPE_HOTFIX);
    const issueTypeFeature = core.getInput(constants_1.INPUT_KEYS.ISSUE_TYPE_FEATURE);
    const issueTypeDocumentation = core.getInput(constants_1.INPUT_KEYS.ISSUE_TYPE_DOCUMENTATION);
    const issueTypeMaintenance = core.getInput(constants_1.INPUT_KEYS.ISSUE_TYPE_MAINTENANCE);
    const issueTypeRelease = core.getInput(constants_1.INPUT_KEYS.ISSUE_TYPE_RELEASE);
    const issueTypeQuestion = core.getInput(constants_1.INPUT_KEYS.ISSUE_TYPE_QUESTION);
    const issueTypeHelp = core.getInput(constants_1.INPUT_KEYS.ISSUE_TYPE_HELP);
    const issueTypeTask = core.getInput(constants_1.INPUT_KEYS.ISSUE_TYPE_TASK);
    /**
     * Locale
     */
    const issueLocale = core.getInput(constants_1.INPUT_KEYS.ISSUES_LOCALE) ?? locale_1.Locale.DEFAULT;
    const pullRequestLocale = core.getInput(constants_1.INPUT_KEYS.PULL_REQUESTS_LOCALE) ?? locale_1.Locale.DEFAULT;
    /**
     * Size Thresholds
     */
    const sizeXxlThresholdLines = parseInt(core.getInput(constants_1.INPUT_KEYS.SIZE_XXL_THRESHOLD_LINES)) ?? 1000;
    const sizeXxlThresholdFiles = parseInt(core.getInput(constants_1.INPUT_KEYS.SIZE_XXL_THRESHOLD_FILES)) ?? 20;
    const sizeXxlThresholdCommits = parseInt(core.getInput(constants_1.INPUT_KEYS.SIZE_XXL_THRESHOLD_COMMITS)) ?? 10;
    const sizeXlThresholdLines = parseInt(core.getInput(constants_1.INPUT_KEYS.SIZE_XL_THRESHOLD_LINES)) ?? 500;
    const sizeXlThresholdFiles = parseInt(core.getInput(constants_1.INPUT_KEYS.SIZE_XL_THRESHOLD_FILES)) ?? 10;
    const sizeXlThresholdCommits = parseInt(core.getInput(constants_1.INPUT_KEYS.SIZE_XL_THRESHOLD_COMMITS)) ?? 5;
    const sizeLThresholdLines = parseInt(core.getInput(constants_1.INPUT_KEYS.SIZE_L_THRESHOLD_LINES)) ?? 250;
    const sizeLThresholdFiles = parseInt(core.getInput(constants_1.INPUT_KEYS.SIZE_L_THRESHOLD_FILES)) ?? 5;
    const sizeLThresholdCommits = parseInt(core.getInput(constants_1.INPUT_KEYS.SIZE_L_THRESHOLD_COMMITS)) ?? 3;
    const sizeMThresholdLines = parseInt(core.getInput(constants_1.INPUT_KEYS.SIZE_M_THRESHOLD_LINES)) ?? 100;
    const sizeMThresholdFiles = parseInt(core.getInput(constants_1.INPUT_KEYS.SIZE_M_THRESHOLD_FILES)) ?? 3;
    const sizeMThresholdCommits = parseInt(core.getInput(constants_1.INPUT_KEYS.SIZE_M_THRESHOLD_COMMITS)) ?? 2;
    const sizeSThresholdLines = parseInt(core.getInput(constants_1.INPUT_KEYS.SIZE_S_THRESHOLD_LINES)) ?? 50;
    const sizeSThresholdFiles = parseInt(core.getInput(constants_1.INPUT_KEYS.SIZE_S_THRESHOLD_FILES)) ?? 2;
    const sizeSThresholdCommits = parseInt(core.getInput(constants_1.INPUT_KEYS.SIZE_S_THRESHOLD_COMMITS)) ?? 1;
    const sizeXsThresholdLines = parseInt(core.getInput(constants_1.INPUT_KEYS.SIZE_XS_THRESHOLD_LINES)) ?? 25;
    const sizeXsThresholdFiles = parseInt(core.getInput(constants_1.INPUT_KEYS.SIZE_XS_THRESHOLD_FILES)) ?? 1;
    const sizeXsThresholdCommits = parseInt(core.getInput(constants_1.INPUT_KEYS.SIZE_XS_THRESHOLD_COMMITS)) ?? 1;
    /**
     * Branches
     */
    const mainBranch = core.getInput(constants_1.INPUT_KEYS.MAIN_BRANCH);
    const developmentBranch = core.getInput(constants_1.INPUT_KEYS.DEVELOPMENT_BRANCH);
    const featureTree = core.getInput(constants_1.INPUT_KEYS.FEATURE_TREE);
    const bugfixTree = core.getInput(constants_1.INPUT_KEYS.BUGFIX_TREE);
    const hotfixTree = core.getInput(constants_1.INPUT_KEYS.HOTFIX_TREE);
    const releaseTree = core.getInput(constants_1.INPUT_KEYS.RELEASE_TREE);
    const docsTree = core.getInput(constants_1.INPUT_KEYS.DOCS_TREE);
    const choreTree = core.getInput(constants_1.INPUT_KEYS.CHORE_TREE);
    /**
     * Prefix builder
     */
    let commitPrefixBuilder = core.getInput(constants_1.INPUT_KEYS.COMMIT_PREFIX_BUILDER) ?? '';
    if (commitPrefixBuilder.length === 0) {
        commitPrefixBuilder = 'branchName.replace("/", "-");';
    }
    /**
     * Issue
     */
    const branchManagementAlways = core.getInput(constants_1.INPUT_KEYS.BRANCH_MANAGEMENT_ALWAYS) === 'true';
    const reopenIssueOnPush = core.getInput(constants_1.INPUT_KEYS.REOPEN_ISSUE_ON_PUSH) === 'true';
    const issueDesiredAssigneesCount = parseInt(core.getInput(constants_1.INPUT_KEYS.DESIRED_ASSIGNEES_COUNT)) ?? 0;
    /**
     * Pull Request
     */
    const pullRequestDesiredAssigneesCount = parseInt(core.getInput(constants_1.INPUT_KEYS.PULL_REQUEST_DESIRED_ASSIGNEES_COUNT)) ?? 0;
    const pullRequestDesiredReviewersCount = parseInt(core.getInput(constants_1.INPUT_KEYS.PULL_REQUEST_DESIRED_REVIEWERS_COUNT)) ?? 0;
    const pullRequestMergeTimeout = parseInt(core.getInput(constants_1.INPUT_KEYS.PULL_REQUEST_MERGE_TIMEOUT)) ?? 0;
    /**
     * Supabase
     */
    const supabaseUrl = core.getInput(constants_1.INPUT_KEYS.SUPABASE_URL);
    const supabaseKey = core.getInput(constants_1.INPUT_KEYS.SUPABASE_KEY);
    const execution = new execution_1.Execution(debug, new docker_config_1.DockerConfig(dockerContainerName, dockerDomain, dockerPort), new single_action_1.SingleAction(singleAction, singleActionIssue), commitPrefixBuilder, new issue_1.Issue(branchManagementAlways, reopenIssueOnPush, issueDesiredAssigneesCount), new pull_request_1.PullRequest(pullRequestDesiredAssigneesCount, pullRequestDesiredReviewersCount, pullRequestMergeTimeout), new emoji_1.Emoji(titleEmoji, branchManagementEmoji), new images_1.Images(imagesOnIssue, imagesOnPullRequest, imagesOnCommit, imagesIssueAutomatic, imagesIssueFeature, imagesIssueBugfix, imagesIssueDocs, imagesIssueChore, imagesIssueRelease, imagesIssueHotfix, imagesPullRequestAutomatic, imagesPullRequestFeature, imagesPullRequestBugfix, imagesPullRequestRelease, imagesPullRequestHotfix, imagesPullRequestDocs, imagesPullRequestChore, imagesCommitAutomatic, imagesCommitFeature, imagesCommitBugfix, imagesCommitRelease, imagesCommitHotfix, imagesCommitDocs, imagesCommitChore), new tokens_1.Tokens(token), new ai_1.Ai(openrouterApiKey, openrouterModel, aiPullRequestDescription, aiMembersOnly, aiIgnoreFiles, Object.keys(providerRouting).length > 0 ? providerRouting : undefined), new labels_1.Labels(branchManagementLauncherLabel, bugLabel, bugfixLabel, hotfixLabel, enhancementLabel, featureLabel, releaseLabel, questionLabel, helpLabel, deployLabel, deployedLabel, docsLabel, documentationLabel, choreLabel, maintenanceLabel, priorityHighLabel, priorityMediumLabel, priorityLowLabel, priorityNoneLabel, sizeXxlLabel, sizeXlLabel, sizeLLabel, sizeMLabel, sizeSLabel, sizeXsLabel), new issue_types_1.IssueTypes(issueTypeTask, issueTypeBug, issueTypeFeature, issueTypeDocumentation, issueTypeMaintenance, issueTypeHotfix, issueTypeRelease, issueTypeQuestion, issueTypeHelp), new locale_1.Locale(issueLocale, pullRequestLocale), new size_thresholds_1.SizeThresholds(new size_threshold_1.SizeThreshold(sizeXxlThresholdLines, sizeXxlThresholdFiles, sizeXxlThresholdCommits), new size_threshold_1.SizeThreshold(sizeXlThresholdLines, sizeXlThresholdFiles, sizeXlThresholdCommits), new size_threshold_1.SizeThreshold(sizeLThresholdLines, sizeLThresholdFiles, sizeLThresholdCommits), new size_threshold_1.SizeThreshold(sizeMThresholdLines, sizeMThresholdFiles, sizeMThresholdCommits), new size_threshold_1.SizeThreshold(sizeSThresholdLines, sizeSThresholdFiles, sizeSThresholdCommits), new size_threshold_1.SizeThreshold(sizeXsThresholdLines, sizeXsThresholdFiles, sizeXsThresholdCommits)), new branches_1.Branches(mainBranch, developmentBranch, featureTree, bugfixTree, hotfixTree, releaseTree, docsTree, choreTree), new release_1.Release(), new hotfix_1.Hotfix(), new workflows_1.Workflows(releaseWorkflow, hotfixWorkflow), new projects_1.Projects(projects, projectColumnIssueCreated, projectColumnPullRequestCreated, projectColumnIssueInProgress, projectColumnPullRequestInProgress), new supabase_config_1.SupabaseConfig(supabaseUrl, supabaseKey), undefined);
    const results = await (0, common_action_1.mainRun)(execution);
    await finishWithResults(execution, results);
}
async function finishWithResults(execution, results) {
    execution.currentConfiguration.results = results;
    await new publish_resume_use_case_1.PublishResultUseCase().invoke(execution);
    await new store_configuration_use_case_1.StoreConfigurationUseCase().invoke(execution);
}
runGitHubAction();

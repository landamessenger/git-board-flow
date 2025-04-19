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
exports.Execution = void 0;
const github = __importStar(require("@actions/github"));
const configuration_handler_1 = require("../../manager/description/configuration_handler");
const get_hotfix_version_use_case_1 = require("../../usecase/steps/common/get_hotfix_version_use_case");
const get_release_type_use_case_1 = require("../../usecase/steps/common/get_release_type_use_case");
const get_release_version_use_case_1 = require("../../usecase/steps/common/get_release_version_use_case");
const constants_1 = require("../../utils/constants");
const label_utils_1 = require("../../utils/label_utils");
const logger_1 = require("../../utils/logger");
const title_utils_1 = require("../../utils/title_utils");
const version_utils_1 = require("../../utils/version_utils");
const branch_repository_1 = require("../repository/branch_repository");
const issue_repository_1 = require("../repository/issue_repository");
const project_repository_1 = require("../repository/project_repository");
const commit_1 = require("./commit");
const config_1 = require("./config");
class Execution {
    get eventName() {
        return this.inputs?.eventName ?? github.context.eventName;
    }
    get actor() {
        return this.inputs?.actor ?? github.context.actor;
    }
    get isSingleAction() {
        return this.singleAction.enabledSingleAction;
    }
    get isIssue() {
        return this.issue.isIssue || this.issue.isIssueComment || this.singleAction.isIssue;
    }
    get isPullRequest() {
        return this.pullRequest.isPullRequest || this.pullRequest.isPullRequestReviewComment || this.singleAction.isPullRequest;
    }
    get isPush() {
        return this.eventName === 'push';
    }
    get repo() {
        return this.inputs?.repo?.repo ?? github.context.repo.repo;
    }
    get owner() {
        return this.inputs?.repo?.owner ?? github.context.repo.owner;
    }
    get isFeature() {
        return this.issueType === this.branches.featureTree;
    }
    get isBugfix() {
        return this.issueType === this.branches.bugfixTree;
    }
    get isDocs() {
        return this.issueType === this.branches.docsTree;
    }
    get isChore() {
        return this.issueType === this.branches.choreTree;
    }
    get isBranched() {
        return this.issue.branchManagementAlways ||
            this.labels.containsBranchedLabel ||
            this.labels.isMandatoryBranchedLabel;
    }
    get issueNotBranched() {
        return this.isIssue && !this.isBranched;
    }
    get managementBranch() {
        return (0, label_utils_1.branchesForManagement)(this, this.labels.currentIssueLabels, this.labels.feature, this.labels.enhancement, this.labels.bugfix, this.labels.bug, this.labels.hotfix, this.labels.release, this.labels.docs, this.labels.documentation, this.labels.chore, this.labels.maintenance);
    }
    get issueType() {
        return (0, label_utils_1.typesForIssue)(this, this.labels.currentIssueLabels, this.labels.feature, this.labels.enhancement, this.labels.bugfix, this.labels.bug, this.labels.hotfix, this.labels.release, this.labels.docs, this.labels.documentation, this.labels.chore, this.labels.maintenance);
    }
    get cleanIssueBranches() {
        return this.isIssue
            && this.previousConfiguration !== undefined
            && this.previousConfiguration?.branchType != this.currentConfiguration.branchType;
    }
    get commit() {
        return new commit_1.Commit(this.inputs);
    }
    get runnedByToken() {
        return this.tokenUser === this.actor;
    }
    constructor(debug, dockerConfig, singleAction, commitPrefixBuilder, issue, pullRequest, emoji, giphy, tokens, ai, labels, issueTypes, locale, sizeThresholds, branches, release, hotfix, workflows, project, supabaseConfig, welcome, inputs) {
        this.debug = false;
        /**
         * Every usage of this field should be checked.
         * PRs with no issue ID in the head branch won't have it.
         *
         * master <- develop
         */
        this.issueNumber = -1;
        this.commitPrefixBuilderParams = {};
        this.setup = async () => {
            (0, logger_1.setGlobalLoggerDebug)(this.debug);
            const issueRepository = new issue_repository_1.IssueRepository();
            const projectRepository = new project_repository_1.ProjectRepository();
            this.tokenUser = await projectRepository.getUserFromToken(this.tokens.token);
            if (!this.tokenUser) {
                throw new Error('Failed to get user from token');
            }
            /**
             * Set the issue number
             */
            if (this.isSingleAction) {
                /**
                 * Single actions can run as isolated processes or as part of a workflow.
                 * In the case of a workflow, the issue number is got from the workflow.
                 * In the case of a single action, the issue number is set.
                 */
                if (this.inputs[constants_1.INPUT_KEYS.SINGLE_ACTION_ISSUE]) {
                    this.issueNumber = this.inputs[constants_1.INPUT_KEYS.SINGLE_ACTION_ISSUE];
                }
                else if (this.isIssue) {
                    this.singleAction.isIssue = true;
                    this.issueNumber = this.issue.number;
                    this.singleAction.currentSingleActionIssue = this.issueNumber;
                }
                else if (this.isPullRequest) {
                    this.singleAction.isPullRequest = true;
                    this.issueNumber = (0, title_utils_1.extractIssueNumberFromBranch)(this.pullRequest.head);
                    this.singleAction.currentSingleActionIssue = this.issueNumber;
                }
                else if (this.isPush) {
                    this.singleAction.isPush = true;
                    this.issueNumber = (0, title_utils_1.extractIssueNumberFromPush)(this.commit.branch);
                    this.singleAction.currentSingleActionIssue = this.issueNumber;
                }
                else {
                    this.singleAction.isPullRequest = await issueRepository.isPullRequest(this.owner, this.repo, this.singleAction.currentSingleActionIssue, this.tokens.token);
                    this.singleAction.isIssue = await issueRepository.isIssue(this.owner, this.repo, this.singleAction.currentSingleActionIssue, this.tokens.token);
                    if (this.singleAction.isIssue) {
                        this.issueNumber = this.singleAction.currentSingleActionIssue;
                    }
                    else if (this.singleAction.isPullRequest) {
                        const head = await issueRepository.getHeadBranch(this.owner, this.repo, this.singleAction.currentSingleActionIssue, this.tokens.token);
                        if (head === undefined) {
                            return;
                        }
                        this.issueNumber = (0, title_utils_1.extractIssueNumberFromBranch)(head);
                    }
                }
            }
            else if (this.isIssue) {
                this.issueNumber = this.issue.number;
            }
            else if (this.isPullRequest) {
                this.issueNumber = (0, title_utils_1.extractIssueNumberFromBranch)(this.pullRequest.head);
            }
            else if (this.isPush) {
                this.issueNumber = (0, title_utils_1.extractIssueNumberFromPush)(this.commit.branch);
            }
            this.previousConfiguration = await new configuration_handler_1.ConfigurationHandler().get(this);
            (0, logger_1.logDebugInfo)(`Previous configuration: ${JSON.stringify(this.previousConfiguration, null, 2)}`);
            /**
             * Get labels of issue
             */
            this.labels.currentIssueLabels = await issueRepository.getLabels(this.owner, this.repo, this.issueNumber, this.tokens.token);
            /**
             * Contains release label
             */
            this.release.active = this.labels.isRelease;
            this.hotfix.active = this.labels.isHotfix;
            /**
             * Get previous state
             */
            if (this.release.active) {
                const previousReleaseBranch = this.previousConfiguration?.releaseBranch;
                if (previousReleaseBranch) {
                    this.release.version = previousReleaseBranch.split('/')[1] ?? '';
                    this.release.branch = `${this.branches.releaseTree}/${this.release.version}`;
                    this.currentConfiguration.parentBranch = this.previousConfiguration?.parentBranch;
                    this.currentConfiguration.releaseBranch = this.release.branch;
                }
            }
            else if (this.hotfix.active) {
                const previousHotfixOriginBranch = this.previousConfiguration?.hotfixOriginBranch;
                if (previousHotfixOriginBranch) {
                    this.hotfix.baseVersion = previousHotfixOriginBranch.split('/v')[1] ?? '';
                    this.hotfix.baseBranch = `tags/v${this.hotfix.baseVersion}`;
                    this.currentConfiguration.hotfixOriginBranch = this.hotfix.baseBranch;
                    this.currentConfiguration.parentBranch = this.hotfix.baseBranch;
                }
                const previousHotfixBranch = this.previousConfiguration?.hotfixBranch;
                if (previousHotfixBranch) {
                    this.hotfix.version = previousHotfixBranch.split('/')[1] ?? '';
                    this.hotfix.branch = `${this.branches.hotfixTree}/${this.hotfix.version}`;
                    this.currentConfiguration.hotfixBranch = this.hotfix.branch;
                }
            }
            else {
                this.currentConfiguration.parentBranch = this.previousConfiguration?.parentBranch;
            }
            if (this.isSingleAction) {
                /**
                 * Nothing to do here (for now)
                 */
            }
            else if (this.isIssue) {
                const branchRepository = new branch_repository_1.BranchRepository();
                if (this.release.active && this.release.version === undefined) {
                    const versionResult = await new get_release_version_use_case_1.GetReleaseVersionUseCase().invoke(this);
                    const versionInfo = versionResult[versionResult.length - 1];
                    if (versionInfo.executed && versionInfo.success) {
                        this.release.version = versionInfo.payload['releaseVersion'];
                    }
                    else {
                        const typeResult = await new get_release_type_use_case_1.GetReleaseTypeUseCase().invoke(this);
                        const typeInfo = typeResult[typeResult.length - 1];
                        if (typeInfo.executed && typeInfo.success) {
                            this.release.type = typeInfo.payload['releaseType'];
                            if (this.release.type === undefined) {
                                return;
                            }
                            const lastTag = await branchRepository.getLatestTag();
                            if (lastTag === undefined) {
                                return;
                            }
                            this.release.version = (0, version_utils_1.incrementVersion)(lastTag, this.release.type);
                        }
                    }
                    this.release.branch = `${this.branches.releaseTree}/${this.release.version}`;
                }
                else if (this.hotfix.active && this.hotfix.version === undefined) {
                    const versionResult = await new get_hotfix_version_use_case_1.GetHotfixVersionUseCase().invoke(this);
                    const versionInfo = versionResult[versionResult.length - 1];
                    if (versionInfo.executed && versionInfo.success) {
                        this.hotfix.baseVersion = versionInfo.payload['baseVersion'];
                        this.hotfix.version = versionInfo.payload['hotfixVersion'];
                    }
                    else {
                        this.hotfix.baseVersion = await branchRepository.getLatestTag();
                        if (this.hotfix.baseVersion === undefined) {
                            return;
                        }
                        this.hotfix.version = (0, version_utils_1.incrementVersion)(this.hotfix.baseVersion, 'Patch');
                    }
                    this.hotfix.branch = `${this.branches.hotfixTree}/${this.hotfix.version}`;
                    this.currentConfiguration.hotfixBranch = this.hotfix.branch;
                    this.hotfix.baseBranch = `tags/v${this.hotfix.baseVersion}`;
                    this.currentConfiguration.hotfixOriginBranch = this.hotfix.baseBranch;
                }
            }
            else if (this.isPullRequest) {
                this.labels.currentPullRequestLabels = await issueRepository.getLabels(this.owner, this.repo, this.pullRequest.number, this.tokens.token);
                this.release.active = this.pullRequest.base.indexOf(`${this.branches.releaseTree}/`) > -1;
                this.hotfix.active = this.pullRequest.base.indexOf(`${this.branches.hotfixTree}/`) > -1;
            }
            this.currentConfiguration.branchType = this.issueType;
            (0, logger_1.logDebugInfo)(`Current configuration: ${JSON.stringify(this.currentConfiguration, null, 2)}`);
        };
        this.debug = debug;
        this.dockerConfig = dockerConfig;
        this.singleAction = singleAction;
        this.commitPrefixBuilder = commitPrefixBuilder;
        this.issue = issue;
        this.pullRequest = pullRequest;
        this.images = giphy;
        this.tokens = tokens;
        this.ai = ai;
        this.emoji = emoji;
        this.labels = labels;
        this.issueTypes = issueTypes;
        this.locale = locale;
        this.sizeThresholds = sizeThresholds;
        this.branches = branches;
        this.release = release;
        this.hotfix = hotfix;
        this.project = project;
        this.workflows = workflows;
        this.currentConfiguration = new config_1.Config({});
        this.supabaseConfig = supabaseConfig;
        this.inputs = inputs;
        this.welcome = welcome;
    }
}
exports.Execution = Execution;

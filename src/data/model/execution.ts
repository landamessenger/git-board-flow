import * as github from "@actions/github";

import { ConfigurationHandler } from "../../manager/description/configuration_handler";
import { GetHotfixVersionUseCase } from "../../usecase/steps/common/get_hotfix_version_use_case";
import { GetReleaseTypeUseCase } from "../../usecase/steps/common/get_release_type_use_case";
import { GetReleaseVersionUseCase } from "../../usecase/steps/common/get_release_version_use_case";
import { INPUT_KEYS } from "../../utils/constants";
import { branchesForManagement, typesForIssue } from "../../utils/label_utils";
import { logDebugInfo, setGlobalLoggerDebug } from "../../utils/logger";
import { extractIssueNumberFromBranch, extractIssueNumberFromPush } from "../../utils/title_utils";
import { incrementVersion } from "../../utils/version_utils";
import { BranchRepository } from "../repository/branch_repository";
import { IssueRepository } from "../repository/issue_repository";
import { ProjectRepository } from "../repository/project_repository";
import { Ai } from "./ai";
import { Branches } from "./branches";
import { Commit } from "./commit";
import { Config } from "./config";
import { DockerConfig } from "./docker_config";
import { Emoji } from "./emoji";
import { Hotfix } from "./hotfix";
import { Images } from "./images";
import { Issue } from "./issue";
import { IssueTypes } from "./issue_types";
import { Labels } from "./labels";
import { Locale } from "./locale";
import { Projects } from "./projects";
import { PullRequest } from "./pull_request";
import { Release } from "./release";
import { SingleAction } from "./single_action";
import { SizeThresholds } from "./size_thresholds";
import { SupabaseConfig } from "./supabase_config";
import { Tokens } from "./tokens";
import { Welcome } from "./welcome";
import { Workflows } from "./workflows";
 
export class Execution {
    debug: boolean = false;
    welcome: Welcome | undefined;
    /**
     * Every usage of this field should be checked.
     * PRs with no issue ID in the head branch won't have it.
     *
     * master <- develop
     */
    issueNumber: number = -1
    singleAction: SingleAction;
    commitPrefixBuilder: string;
    commitPrefixBuilderParams: any = {};
    emoji: Emoji;
    images: Images;
    tokens: Tokens;
    ai: Ai;
    labels: Labels;
    issueTypes: IssueTypes;
    locale: Locale;
    sizeThresholds: SizeThresholds;
    branches: Branches;
    release: Release;
    hotfix: Hotfix;
    issue: Issue;
    pullRequest: PullRequest;
    workflows: Workflows;
    project: Projects;
    previousConfiguration: Config | undefined;
    currentConfiguration: Config;
    tokenUser: string | undefined;
    dockerConfig: DockerConfig;
    supabaseConfig: SupabaseConfig | undefined;
    inputs: any | undefined;

    get eventName(): string {
        return this.inputs?.eventName ?? github.context.eventName;
    }

    get actor(): string {
        return this.inputs?.actor ?? github.context.actor;
    }

    get isSingleAction(): boolean {
        return this.singleAction.enabledSingleAction;
    }

    get isIssue(): boolean {
        return this.issue.isIssue || this.issue.isIssueComment || this.singleAction.isIssue;
    }

    get isPullRequest(): boolean {
        return this.pullRequest.isPullRequest || this.pullRequest.isPullRequestReviewComment || this.singleAction.isPullRequest;
    }

    get isPush(): boolean {
        return this.eventName === 'push';
    }

    get repo(): string {
        return this.inputs?.repo?.repo ?? github.context.repo.repo;
    }

    get owner(): string {
        return this.inputs?.repo?.owner ?? github.context.repo.owner;
    }

    get isFeature(): boolean {
        return this.issueType === this.branches.featureTree;
    }

    get isBugfix(): boolean {
        return this.issueType === this.branches.bugfixTree;
    }

    get isDocs(): boolean {
        return this.issueType === this.branches.docsTree;
    }

    get isChore(): boolean {
        return this.issueType === this.branches.choreTree;
    }

    get isBranched(): boolean {
        return this.issue.branchManagementAlways ||
            this.labels.containsBranchedLabel ||
            this.labels.isMandatoryBranchedLabel;
    }

    get issueNotBranched(): boolean {
        return this.isIssue && !this.isBranched;
    }

    get managementBranch(): string {
        return branchesForManagement(
            this,
            this.labels.currentIssueLabels,
            this.labels.feature,
            this.labels.enhancement,
            this.labels.bugfix,
            this.labels.bug,
            this.labels.hotfix,
            this.labels.release,
            this.labels.docs,
            this.labels.documentation,
            this.labels.chore,
            this.labels.maintenance,
        );
    }

    get issueType(): string {
        return typesForIssue(
            this,
            this.labels.currentIssueLabels,
            this.labels.feature,
            this.labels.enhancement,
            this.labels.bugfix,
            this.labels.bug,
            this.labels.hotfix,
            this.labels.release,
            this.labels.docs,
            this.labels.documentation,
            this.labels.chore,
            this.labels.maintenance,
        );
    }

    get cleanIssueBranches(): boolean {
        return this.isIssue
            && this.previousConfiguration !== undefined
            && this.previousConfiguration?.branchType != this.currentConfiguration.branchType;
    }

    get commit(): Commit {
        return new Commit(this.inputs);
    }

    get runnedByToken(): boolean {
        return this.tokenUser === this.actor;
    }

    constructor(
        debug: boolean,
        dockerConfig: DockerConfig,
        singleAction: SingleAction,
        commitPrefixBuilder: string,
        issue: Issue,
        pullRequest: PullRequest,
        emoji: Emoji,
        giphy: Images,
        tokens: Tokens,
        ai: Ai,
        labels: Labels,
        issueTypes: IssueTypes,
        locale: Locale,
        sizeThresholds: SizeThresholds,
        branches: Branches,
        release: Release,
        hotfix: Hotfix,
        workflows: Workflows,
        project: Projects,
        supabaseConfig: SupabaseConfig | undefined,
        welcome: Welcome | undefined,
        inputs: any | undefined
    ) {
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
        this.currentConfiguration = new Config({});
        this.supabaseConfig = supabaseConfig;
        this.inputs = inputs;
        this.welcome = welcome;
    }

    setup = async () => {
        setGlobalLoggerDebug(this.debug, this.inputs === undefined);
      
        const issueRepository = new IssueRepository();
        const projectRepository = new ProjectRepository();

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
            if (this.inputs?.[INPUT_KEYS.SINGLE_ACTION_ISSUE]) {
                this.issueNumber = this.inputs[INPUT_KEYS.SINGLE_ACTION_ISSUE];
            } else if (this.isIssue) {
                this.singleAction.isIssue = true;
                this.issueNumber = this.issue.number;
                this.singleAction.issue = this.issueNumber;
            } else if (this.isPullRequest) {
                this.singleAction.isPullRequest = true;
                this.issueNumber = extractIssueNumberFromBranch(this.pullRequest.head);
                this.singleAction.issue = this.issueNumber;
            } else if (this.isPush) {
                this.singleAction.isPush = true;
                this.issueNumber = extractIssueNumberFromPush(this.commit.branch)
                this.singleAction.issue = this.issueNumber;
            } else {
                this.singleAction.isPullRequest = await issueRepository.isPullRequest(
                    this.owner,
                    this.repo,
                    this.singleAction.issue,
                    this.tokens.token,
                )
                this.singleAction.isIssue = await issueRepository.isIssue(
                    this.owner,
                    this.repo,
                    this.singleAction.issue,
                    this.tokens.token,
                )

                if (this.singleAction.isIssue) {
                    this.issueNumber = this.singleAction.issue
                } else if (this.singleAction.isPullRequest) {
                    const head = await issueRepository.getHeadBranch(
                        this.owner,
                        this.repo,
                        this.singleAction.issue,
                        this.tokens.token,
                    )
                    if (head === undefined) {
                        return
                    }
                    this.issueNumber = extractIssueNumberFromBranch(head);
                }
            }
        } else if (this.isIssue) {
            this.issueNumber = this.issue.number;
        } else if (this.isPullRequest) {
            this.issueNumber = extractIssueNumberFromBranch(this.pullRequest.head);
        } else if (this.isPush) {
            this.issueNumber = extractIssueNumberFromPush(this.commit.branch)
        }

        this.previousConfiguration = await new ConfigurationHandler().get(this)
        logDebugInfo(`Previous configuration: ${JSON.stringify(this.previousConfiguration, null, 2)}`);

        /**
         * Get labels of issue
         */
        this.labels.currentIssueLabels = await issueRepository.getLabels(
            this.owner,
            this.repo,
            this.issueNumber,
            this.tokens.token
        );

        /**
         * Contains release label
         */
        this.release.active = this.labels.isRelease;
        this.hotfix.active = this.labels.isHotfix;

        /**
         * Get previous state
         */
        if (this.release.active) {
            const previousReleaseBranch = this.previousConfiguration?.releaseBranch
            if (previousReleaseBranch) {
                this.release.version = previousReleaseBranch.split('/')[1] ?? ''
                this.release.branch = `${this.branches.releaseTree}/${this.release.version}`;
                this.currentConfiguration.parentBranch = this.previousConfiguration?.parentBranch
                this.currentConfiguration.releaseBranch = this.release.branch
            }
        } else if (this.hotfix.active) {
            const previousHotfixOriginBranch = this.previousConfiguration?.hotfixOriginBranch
            if (previousHotfixOriginBranch) {
                this.hotfix.baseVersion = previousHotfixOriginBranch.split('/v')[1] ?? ''
                this.hotfix.baseBranch = `tags/v${this.hotfix.baseVersion}`;
                this.currentConfiguration.hotfixOriginBranch = this.hotfix.baseBranch;
                this.currentConfiguration.parentBranch = this.hotfix.baseBranch
            }
            const previousHotfixBranch = this.previousConfiguration?.hotfixBranch
            if (previousHotfixBranch) {
                this.hotfix.version = previousHotfixBranch.split('/')[1] ?? ''
                this.hotfix.branch = `${this.branches.hotfixTree}/${this.hotfix.version}`;
                this.currentConfiguration.hotfixBranch = this.hotfix.branch
            }
        } else {
            this.currentConfiguration.parentBranch = this.previousConfiguration?.parentBranch
        }

        if (this.isSingleAction) {
            /**
             * Nothing to do here (for now)
             */
        } else if (this.isIssue) {
            const branchRepository = new BranchRepository();

            if (this.release.active && this.release.version === undefined) {
                const versionResult = await new GetReleaseVersionUseCase().invoke(this);
                const versionInfo = versionResult[versionResult.length - 1];
                if (versionInfo.executed && versionInfo.success) {
                    this.release.version = versionInfo.payload['releaseVersion']
                } else {
                    const typeResult = await new GetReleaseTypeUseCase().invoke(this);
                    const typeInfo = typeResult[typeResult.length - 1];
                    if (typeInfo.executed && typeInfo.success) {
                        this.release.type = typeInfo.payload['releaseType']
                        if (this.release.type === undefined) {
                            return
                        }

                        const lastTag = await branchRepository.getLatestTag();
                        if (lastTag === undefined) {
                            return
                        }

                        this.release.version = incrementVersion(lastTag, this.release.type)
                    }
                }

                this.release.branch = `${this.branches.releaseTree}/${this.release.version}`;
            } else if (this.hotfix.active && this.hotfix.version === undefined) {
                const versionResult = await new GetHotfixVersionUseCase().invoke(this);
                const versionInfo = versionResult[versionResult.length - 1];
                if (versionInfo.executed && versionInfo.success) {
                    this.hotfix.baseVersion = versionInfo.payload['baseVersion']
                    this.hotfix.version = versionInfo.payload['hotfixVersion']
                } else {
                    this.hotfix.baseVersion = await branchRepository.getLatestTag();
                    if (this.hotfix.baseVersion === undefined) {
                        return
                    }
                    this.hotfix.version = incrementVersion(this.hotfix.baseVersion, 'Patch')
                }

                this.hotfix.branch = `${this.branches.hotfixTree}/${this.hotfix.version}`;
                this.currentConfiguration.hotfixBranch = this.hotfix.branch;

                this.hotfix.baseBranch = `tags/v${this.hotfix.baseVersion}`;
                this.currentConfiguration.hotfixOriginBranch = this.hotfix.baseBranch;
            }
        } else if (this.isPullRequest) {
            this.labels.currentPullRequestLabels = await issueRepository.getLabels(
                this.owner,
                this.repo,
                this.pullRequest.number,
                this.tokens.token
            );
            this.release.active = this.pullRequest.base.indexOf(`${this.branches.releaseTree}/`) > -1
            this.hotfix.active = this.pullRequest.base.indexOf(`${this.branches.hotfixTree}/`) > -1
        }

        this.currentConfiguration.branchType = this.issueType

        logDebugInfo(`Current configuration: ${JSON.stringify(this.currentConfiguration, null, 2)}`);
    }
}
import {ProjectDetail} from "./project_detail";
import {Tokens} from "./tokens";
import {Labels} from "./labels";
import {Branches} from "./branches";
import {Hotfix} from "./hotfix";
import {IssueRepository} from "../repository/issue_repository";
import * as github from "@actions/github";
import {branchesForManagement, typesForIssue} from "../utils/label_utils";
import {Issue} from "./issue";
import {PullRequest} from "./pull_request";
import {extractIssueNumberFromBranch, extractIssueNumberFromPush} from "../utils/title_utils";
import {Config} from "./config";
import {Images} from "./images";
import {Commit} from "./commit";
import {Emoji} from "./emoji";
import {ConfigurationHandler} from "../manager/description/configuration_handler";
import {Workflows} from "./workflows";
import {Release} from "./release";
import {GetHotfixVersionUseCase} from "../usecase/steps/get_hotfix_version_use_case";
import {GetReleaseVersionUseCase} from "../usecase/steps/get_release_version_use_case";
import {GetReleaseTypeUseCase} from "../usecase/steps/get_release_type_use_case";
import {BranchConfiguration} from "./branch_configuration";
import {BranchRepository} from "../repository/branch_repository";
import {incrementVersion} from "../utils/version_utils";

export class Execution {
    /**
     * Every usage of this field should be checked.
     * PRs with no issue ID in the head branch won't have it.
     *
     * master <- develop
     */
    issueNumber: number = -1
    commitPrefixBuilder: string;
    commitPrefixBuilderParams: any = {};
    emoji: Emoji;
    giphy: Images;
    tokens: Tokens;
    labels: Labels;
    branches: Branches;
    release: Release;
    hotfix: Hotfix;
    issue: Issue;
    pullRequest: PullRequest;
    workflows: Workflows;
    projects: ProjectDetail[];
    previousConfiguration: Config | undefined;
    currentConfiguration: Config;

    get eventName(): string {
        return github.context.eventName;
    }

    get isIssue(): boolean {
        return this.eventName === 'issues';
    }

    get isPullRequest(): boolean {
        return this.eventName === 'pull_request';
    }

    get isPush(): boolean {
        return this.eventName === 'push';
    }

    get repo(): string {
        return github.context.repo.repo;
    }

    get owner(): string {
        return github.context.repo.owner;
    }

    get isFeature(): boolean {
        return this.issueType === 'feature';
    }

    get isBugfix(): boolean {
        return this.issueType === 'bugfix';
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
            this.labels.bugfix,
            this.labels.hotfix,
            this.labels.release,
        );
    }

    get issueType(): string {
        return typesForIssue(
            this,
            this.labels.currentIssueLabels,
            this.labels.bugfix,
            this.labels.hotfix,
            this.labels.release,
        );
    }

    get cleanIssueBranches(): boolean {
        return this.isIssue
            && this.previousConfiguration !== undefined
            && this.previousConfiguration?.branchType != this.currentConfiguration.branchType;
    }

    get commit(): Commit {
        return new Commit();
    }

    constructor(
        commitPrefixBuilder: string,
        issue: Issue,
        pullRequest: PullRequest,
        emoji: Emoji,
        giphy: Images,
        tokens: Tokens,
        labels: Labels,
        branches: Branches,
        release: Release,
        hotfix: Hotfix,
        workflows: Workflows,
        projects: ProjectDetail[],
    ) {
        this.commitPrefixBuilder = commitPrefixBuilder;
        this.issue = issue;
        this.pullRequest = pullRequest;
        this.giphy = giphy;
        this.tokens = tokens;
        this.emoji = emoji;
        this.labels = labels;
        this.branches = branches;
        this.release = release;
        this.hotfix = hotfix;
        this.projects = projects;
        this.workflows = workflows;
        this.currentConfiguration = new Config({});
    }

    setup = async () => {
        if (this.isIssue) {
            this.issueNumber = this.issue.number;
            const issueRepository = new IssueRepository();
            const branchRepository = new BranchRepository();
            this.labels.currentIssueLabels = await issueRepository.getLabels(
                this.owner,
                this.repo,
                this.issueNumber,
                this.tokens.token
            );
            this.release.active = await issueRepository.isRelease(
                this.owner,
                this.repo,
                this.issue.number,
                this.labels.release,
                this.tokens.token,
            );
            this.hotfix.active = await issueRepository.isHotfix(
                this.owner,
                this.repo,
                this.issue.number,
                this.labels.hotfix,
                this.tokens.token,
            );

            if (this.release.active) {
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
            } else if (this.hotfix.active) {
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
            }
        } else if (this.isPullRequest) {
            const issueRepository = new IssueRepository();
            this.issueNumber = extractIssueNumberFromBranch(this.pullRequest.head);
            if (this.issueNumber > -1) {
                this.labels.currentIssueLabels = await issueRepository.getLabels(
                    this.owner,
                    this.repo,
                    this.issueNumber,
                    this.tokens.token
                );
            }
            this.labels.currentPullRequestLabels = await issueRepository.getLabels(
                this.owner,
                this.repo,
                this.pullRequest.number,
                this.tokens.token
            );
            this.release.active = this.pullRequest.base.indexOf(`${this.branches.releaseTree}/`) > -1
            this.hotfix.active = this.pullRequest.base.indexOf(`${this.branches.hotfixTree}/`) > -1
        } else if (this.isPush) {
            this.issueNumber = extractIssueNumberFromPush(this.commit.branch)
        }
        this.previousConfiguration = await new ConfigurationHandler().get(this)
        this.currentConfiguration.branchType = this.issueType
    }
}
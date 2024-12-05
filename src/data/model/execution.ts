import {ProjectDetail} from "./project_detail";
import {Tokens} from "./tokens";
import {Labels} from "./labels";
import {Branches} from "./branches";
import {Hotfix} from "./hotfix";
import {PullRequestRepository} from "../repository/pull_request_repository";
import {IssueRepository} from "../repository/issue_repository";
import * as github from "@actions/github";
import {typesForIssue, branchesForManagement} from "../utils/label_utils";
import {Issue} from "./issue";
import {PullRequest} from "./pull_request";
import {extractIssueNumberFromBranch, extractIssueNumberFromBranchB} from "../utils/title_utils";
import {Config} from "./config";
import {Images} from "./images";
import {Commit} from "./commit";
import {Emoji} from "./emoji";

export class Execution {
    number: number = -1
    branchManagementAlways: boolean;
    reopenIssueOnPush: boolean;
    commitPrefixBuilder: string;
    commitPrefixBuilderParams: any = {};
    emoji: Emoji;
    giphy: Images;
    tokens: Tokens;
    labels: Labels;
    branches: Branches;
    hotfix: Hotfix;
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
        return this.branchManagementAlways || this.labels.containsBranchedLabel;
    }

    get issueNotBranched(): boolean {
        return this.isIssue && !this.isBranched;
    }

    get managementBranch(): string {
        return branchesForManagement(
            this,
            this.labels.currentLabels,
            this.labels.bugfix,
            this.labels.hotfix,
            this.labels.release,
        );
    }

    get issueType(): string {
        return typesForIssue(
            this,
            this.labels.currentLabels,
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

    get issue(): Issue {
        return new Issue();
    }

    get pullRequest(): PullRequest {
        return new PullRequest();
    }

    get commit(): Commit {
        return new Commit();
    }

    constructor(
        branchManagementAlways: boolean,
        reopenIssueOnPush: boolean,
        commitPrefixBuilder: string,
        emoji: Emoji,
        giphy: Images,
        tokens: Tokens,
        labels: Labels,
        branches: Branches,
        hotfix: Hotfix,
        projects: ProjectDetail[],
    ) {
        this.commitPrefixBuilder = commitPrefixBuilder;
        this.reopenIssueOnPush = reopenIssueOnPush;
        this.giphy = giphy;
        this.tokens = tokens;
        this.emoji = emoji;
        this.labels = labels;
        this.branches = branches;
        this.hotfix = hotfix;
        this.branchManagementAlways = branchManagementAlways;
        this.projects = projects;
        this.currentConfiguration = new Config({});
    }

    setup = async () => {
        if (this.isIssue) {
            this.number = this.issue.number;
            const issueRepository = new IssueRepository();
            this.labels.currentLabels = await issueRepository.getLabels(
                this.owner,
                this.repo,
                this.number,
                this.tokens.token
            );
            this.hotfix.active = await issueRepository.isHotfix(
                this.owner,
                this.repo,
                this.issue.number,
                this.labels.hotfix,
                this.tokens.token,
            );
            this.previousConfiguration = await issueRepository.readConfig(
                this.owner,
                this.repo,
                this.issue.number,
                this.tokens.token,
            )
        } else if (this.isPullRequest) {
            const pullRequestRepository = new PullRequestRepository();
            this.number = extractIssueNumberFromBranch(this.pullRequest.head);
            this.labels.currentLabels = await pullRequestRepository.getLabels(
                this.owner,
                this.repo,
                this.pullRequest.number,
                this.tokens.token
            );
            this.hotfix.active = this.pullRequest.base.indexOf(`${this.branches.hotfixTree}/`) > -1
            this.previousConfiguration = await pullRequestRepository.readConfig(
                this.owner,
                this.repo,
                this.pullRequest.number,
                this.tokens.token,
            )
        } else if (this.isPush) {
            this.number = extractIssueNumberFromBranchB(this.commit.branch)
            const pullRequestRepository = new PullRequestRepository();
            this.previousConfiguration = await pullRequestRepository.readConfig(
                this.owner,
                this.repo,
                this.number,
                this.tokens.token,
            )
        }
        this.currentConfiguration.branchType = this.issueType
    }
}
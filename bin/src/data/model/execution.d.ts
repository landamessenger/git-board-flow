import { Ai } from "./ai";
import { Branches } from "./branches";
import { Emoji } from "./emoji";
import { Hotfix } from "./hotfix";
import { Images } from "./images";
import { Issue } from "./issue";
import { IssueTypes } from "./issue_types";
import { Labels } from "./labels";
import { Projects } from "./projects";
import { PullRequest } from "./pull_request";
import { Release } from "./release";
import { SingleAction } from "./single_action";
import { SizeThresholds } from "./size_thresholds";
import { Tokens } from "./tokens";
import { Workflows } from "./workflows";
import { Locale } from "./locale";
import { SupabaseConfig } from "./supabase_config";
import { DockerConfig } from "./docker_config";
import { Config } from "./config";
import { Commit } from "./commit";
export declare class Execution {
    debug: boolean;
    /**
     * Every usage of this field should be checked.
     * PRs with no issue ID in the head branch won't have it.
     *
     * master <- develop
     */
    issueNumber: number;
    singleAction: SingleAction;
    commitPrefixBuilder: string;
    commitPrefixBuilderParams: any;
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
    get eventName(): string;
    get actor(): string;
    get isSingleAction(): boolean;
    get isIssue(): boolean;
    get isPullRequest(): boolean;
    get isPush(): boolean;
    get repo(): string;
    get owner(): string;
    get isFeature(): boolean;
    get isBugfix(): boolean;
    get isDocs(): boolean;
    get isChore(): boolean;
    get isBranched(): boolean;
    get issueNotBranched(): boolean;
    get managementBranch(): string;
    get issueType(): string;
    get cleanIssueBranches(): boolean;
    get commit(): Commit;
    get runnedByToken(): boolean;
    constructor(debug: boolean, dockerConfig: DockerConfig, singleAction: SingleAction, commitPrefixBuilder: string, issue: Issue, pullRequest: PullRequest, emoji: Emoji, giphy: Images, tokens: Tokens, ai: Ai, labels: Labels, issueTypes: IssueTypes, locale: Locale, sizeThresholds: SizeThresholds, branches: Branches, release: Release, hotfix: Hotfix, workflows: Workflows, project: Projects, supabaseConfig: SupabaseConfig | undefined, inputs: any | undefined);
    setup: () => Promise<void>;
}

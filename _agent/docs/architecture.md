---
name: Architecture
description: Project architecture, entry points, and use case flows.
---

# Architecture & Key Paths

## Entry and main flow

1. **GitHub Action**: `src/actions/github_action.ts` reads inputs, builds `Execution`, calls `mainRun(execution)` from `common_action.ts`.
2. **CLI**: `src/actions/local_action.ts` same flow with CLI/config inputs.
3. **common_action.ts**: Sets up; calls `waitForPreviousRuns(execution)` (sequential workflow); then:
   - **Single action** → `SingleActionUseCase`
   - **Issue** → `IssueCommentUseCase` or `IssueUseCase`
   - **Pull request** → `PullRequestReviewCommentUseCase` or `PullRequestUseCase`
   - **Push** → `CommitUseCase`

## Key paths

| Area | Path | Purpose |
|------|------|--------|
| Action entry | `src/actions/github_action.ts` | Reads inputs, builds Execution |
| CLI entry | `src/cli.ts` → `local_action.ts` | Same flow, local inputs |
| Shared flow | `src/actions/common_action.ts` | mainRun, waitForPreviousRuns, dispatch to use cases |
| Use cases | `src/usecase/` | issue_use_case, pull_request_use_case, commit_use_case, single_action_use_case |
| Single actions | `src/usecase/actions/` | check_progress, detect_errors, recommend_steps, think, initial_setup, create_release, create_tag, publish_github_action, deployed_action |
| Steps (issue) | `src/usecase/steps/issue/` | check_permissions, close_not_allowed_issue, assign_members, update_title, update_issue_type, link_issue_project, check_priority_issue_size, prepare_branches, remove_issue_branches, remove_not_needed_branches, label_deploy_added, label_deployed_added, move_issue_to_in_progress, answer_issue_help_use_case (question/help on open). On issue opened: RecommendStepsUseCase (non release/question/help) or AnswerIssueHelpUseCase (question/help). |
| Steps (PR) | `src/usecase/steps/pull_request/` | update_title, assign_members (issue), assign_reviewers_to_issue, link_pr_project, link_pr_issue, sync_size_and_progress_from_issue, check_priority_pull_request_size, update_description (AI), close_issue_after_merging |
| Steps (commit) | `src/usecase/steps/commit/` | notify commit, check size |
| Steps (issue comment) | `src/usecase/steps/issue_comment/` | check_issue_comment_language (translation) |
| Steps (PR review comment) | `src/usecase/steps/pull_request_review_comment/` | check_pull_request_comment_language (translation) |
| Bugbot autofix & user request | `src/usecase/steps/commit/bugbot/` + `user_request_use_case.ts` | detect_bugbot_fix_intent_use_case (plan agent: is_fix_request, is_do_request, target_finding_ids), BugbotAutofixUseCase + runBugbotAutofixCommitAndPush (fix findings), DoUserRequestUseCase + runUserRequestCommitAndPush (generic “do this”). Permission: ProjectRepository.isActorAllowedToModifyFiles (org member or repo owner). |
| Manager (content) | `src/manager/` | description handlers, configuration_handler, markdown_content_hotfix_handler (PR description, hotfix changelog content) |
| Models | `src/data/model/` | Execution, Issue, PullRequest, SingleAction, etc. |
| Repos | `src/data/repository/` | branch_repository, issue_repository, workflow_repository, ai_repository (OpenCode), file_repository, project_repository |
| Config | `src/utils/constants.ts` | INPUT_KEYS, ACTIONS, defaults |
| Metadata | `action.yml` | Action inputs and defaults |

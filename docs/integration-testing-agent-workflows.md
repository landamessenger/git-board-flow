# Final integration testing and validation of agent workflows within GitHub Actions context

This document describes how to run **integration testing and validation** of the OpenCode-based agent workflows when the action runs **inside GitHub Actions** (real events: push, pull_request, issue, issue_comment, pull_request_review_comment).

## Overview of agent workflows

| Workflow file | Trigger | Agent use | OpenCode usage |
|---------------|---------|-----------|----------------|
| **gbf_commit.yml** | `push` (all branches except master/develop) | Progress detection | `CheckProgressUseCase` → `askAgent(plan)` |
| **gbf_pull_request.yml** | `pull_request` (opened, synchronize, etc.) | PR description (optional) | `UpdatePullRequestDescriptionUseCase` → `askAgent(plan)` when `ai-pull-request-description: true` |
| **gbf_issue.yml** | `issues` (opened, edited, labeled, …) | No agent in core flow | — |
| **gbf_issue_comment.yml** | `issue_comment` (created, edited) | Think + comment language/translation | `ThinkUseCase` → `ask()`; `CheckIssueCommentLanguageUseCase` → `ask()` + `askAgent(plan)` |
| **gbf_pull_request_review_comment.yml** | `pull_request_review_comment` | Comment language/translation | `CheckPullRequestCommentLanguageUseCase` → `ask()` + `askAgent(plan)` |

Single actions (`check-progress`, `detect-errors`, `recommend-steps`) also use `askAgent(plan)` when run from the action (e.g. via `single-action` input or CLI).

## Prerequisites for agent workflows in GitHub Actions

1. **OpenCode server reachable from the runner**
   - **Option A – Managed server in the job**: Set `opencode-start-server: true` in the action. The action will start `npx opencode-ai serve` in the job and stop it when the job ends. Provide provider API keys (e.g. `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) as repository or organization secrets and pass them as `env` to the job.
   - **Option B – External server**: Set `opencode-server-url` (e.g. from a secret like `secrets.OPENCODE_SERVER_URL`) so the runner can reach your OpenCode instance.

2. **Model**
   - Set `opencode-model` (e.g. via `vars.OPENCODE_MODEL`) to a valid provider/model (e.g. `opencode/kimi-k2.5-free`, `anthropic/claude-3-5-sonnet`).

3. **Token and project (as for non-AI flows)**
   - `token`: PAT with repo and project permissions.
   - `project-ids`: If you use project automation.

4. **Feature flags (where applicable)**
   - Commit (progress): No extra flag; progress runs on every push when AI is configured.
   - Pull request description: Set `ai-pull-request-description: true` in the workflow that uses the action for PRs.

## Validation checklist (per workflow)

Use this checklist to validate each agent workflow **in a real GitHub repo** where the action is used.

### 1. Commit workflow (progress detection)

- [ ] **Config**: Workflow passes `opencode-model` (and either `opencode-server-url` or `opencode-start-server: true` with API keys in env).
- [ ] **Trigger**: Push to a branch that matches an issue (e.g. `feature/123-title` for issue `#123`).
- [ ] **Expected**: Job runs; issue and any open PRs for that branch get a progress label (e.g. `25%`, `50%`) and a comment with summary/reasoning (if enabled).
- [ ] **Failure cases**: Missing AI config → action reports “Missing required AI configuration” and does not call OpenCode. No branch for issue → clear error in logs.

### 2. Pull request workflow (AI description)

- [ ] **Config**: `ai-pull-request-description: true`, plus `opencode-model` and OpenCode server (URL or start-server).
- [ ] **Trigger**: Open a PR (or push to an existing PR) whose head branch is linked to an issue.
- [ ] **Expected**: PR description is generated or updated by the Plan agent.
- [ ] **Failure cases**: Missing AI config → description step is skipped or fails with a clear message.

### 3. Issue comment workflow (think + language)

- [ ] **Config**: `opencode-model` and OpenCode server (URL or start-server). No extra flag for think/language.
- [ ] **Trigger**: Create or edit a comment on an issue.
- [ ] **Expected**: Think use case and/or language/translation use case run; comments may be updated (e.g. translation) when conditions are met.
- [ ] **Failure cases**: Missing AI config → those steps fail gracefully (error result, no crash).

### 4. Pull request review comment workflow (language)

- [ ] **Config**: Same as issue comment (OpenCode URL/model or start-server).
- [ ] **Trigger**: Create or edit a review comment on a PR.
- [ ] **Expected**: Language/translation logic runs; comment may be updated when applicable.
- [ ] **Failure cases**: Same as issue comment.

## How to run final integration tests (manual)

1. **Use a test repository** where Git Board Flow is already configured (workflows present, PAT and optional OpenCode URL/model in vars/secrets).
2. **Commit workflow**
   - Create an issue (e.g. #123), then a branch `feature/123-test-progress`, push commits, and push to that branch. Check the “Git Board - Commit” run and the issue/PR for progress labels and comments.
3. **Pull request workflow**
   - With `ai-pull-request-description: true`, open a PR from a branch linked to an issue. Confirm the PR description is filled/updated by the action.
4. **Issue comment workflow**
   - Add or edit a comment on an issue and confirm the “Git Board - Issue Comment” job runs and that think/language steps behave as expected (e.g. no crashes, optional translation).
5. **Pull request review comment workflow**
   - Add or edit a review comment on a PR and confirm the “Git Board - Pull Request Review Comment” job runs and language steps behave as expected.

## Optional: automated smoke validation in CI

The repository includes a workflow that runs the action in a "smoke" mode to ensure it starts correctly in the GitHub Actions context. This does **not** replace the manual checks above (which require real issues, branches, and PRs). See [.github/workflows/validate_agent_workflows.yml](../.github/workflows/validate_agent_workflows.yml):

- **On push to `test/agent-smoke` or `test/agent-validation`**: Runs the action with `opencode-start-server: true` (and optional API keys from secrets). The run may log "Issue number not found. Skipping." if the branch is not linked to an issue—that is acceptable for a smoke run.
- **On workflow_dispatch**: Runs build, tests, and lint only (no action run with a real event). Use this to validate the codebase without triggering agent flows.

## Success criteria (summary)

- All workflows that use the agent have `opencode-model` and a reachable OpenCode server (URL or start-server).
- Commit runs update progress labels and post expected comments when a branch exists for the issue.
- PR runs with `ai-pull-request-description: true` update PR descriptions.
- Issue comment and PR review comment runs execute think/language steps without crashing; errors are reported as results, not unhandled exceptions.
- Logs clearly indicate “Missing required AI configuration” when OpenCode is not configured, and agent steps are skipped or return structured errors instead of failing the job unexpectedly.

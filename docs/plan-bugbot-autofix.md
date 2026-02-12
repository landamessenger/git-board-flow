# Plan: Bugbot Autofix (fix vulnerabilities on user request)

This document describes the **bugbot autofix** feature and the related **do user request** flow: the user can ask from an issue or pull request comment to fix one or more detected vulnerabilities, or to perform any other change in the repo; OpenCode interprets the request, applies fixes directly in the workspace, runs verify commands (build/test/lint), and the GitHub Action commits and pushes the changes. **Permission check:** only users who are **organization members** (when the repo owner is an org) or the **repo owner** (when the repo is user-owned) can trigger these file-modifying actions.

---

## 1. Requirements summary

| Origin | Scenario | Expected behaviour |
|--------|----------|--------------------|
| **Issue** | General comment (e.g. "fix it", "arregla las vulnerabilidades") | OpenCode interprets whether the user is asking to fix one or several open findings and which ones. |
| **PR** | Reply in the **same thread** as a vulnerability comment | OpenCode can use the parent comment as context and fix that specific finding (or the user may say "fix all"). |
| **PR** | New comment mentioning the bot (e.g. "fix X", "fix all") | OpenCode interprets which finding(s) to fix. |

Constraints:

- Act **only on explicit user request**; never exceed that scope.
- Focus on one or more **existing findings**; at most add tests to validate. No unrelated code changes.
- After fixes: run build/test/lint (configured by the user); if all pass, the Action commits and pushes. OpenCode applies changes **directly** in its workspace (no diff handling).

---

## 2. Intent detection: via OpenCode (no local parsing)

**Decision:** Any analysis to determine if the user is asking for a fix is done **through OpenCode**. We do not use local regex or keyword parsing.

- We send OpenCode (plan agent):
  - The **user's comment** (and, for PR, optional **parent comment body** when the user replied in a thread).
  - The list of **unresolved findings** (id, title, description, file, line, suggestion) from `loadBugbotContext`.
- We ask OpenCode: *"Is this comment requesting to fix one or more of these findings? Is it requesting some other change in the repo (e.g. add a test, refactor)?"*
- OpenCode responds with a structured payload: `{ is_fix_request: boolean, target_finding_ids: string[], is_do_request: boolean }`.
- If `is_fix_request` is true and `target_finding_ids` is non-empty, we run the **bugbot autofix** flow (build agent with those findings + user comment; then verify, commit, push). If `is_do_request` is true and we did not run autofix, we run the **do user request** flow (build agent with the user comment; then verify, commit, push). Otherwise we run **Think** so the user gets an AI reply (e.g. to a question).
- **Permission:** Before running any file-modifying action (autofix or do user request), we check `ProjectRepository.isActorAllowedToModifyFiles(owner, actor, token)`: when the repo owner is an **Organization**, the comment author (`actor`) must be a **member** of that org; when the repo owner is a **User**, the actor must be the **owner**. If not allowed, we skip the file-modifying action and run Think instead.

---

## 3. Architecture (relevant paths)

- **Bugbot (detection):** `DetectPotentialProblemsUseCase` → `loadBugbotContext`, `buildBugbotPrompt`, OpenCode plan agent → publishes findings with marker `<!-- copilot-bugbot finding_id:"id" resolved:true|false -->`.
- **Issue comment:** `IssueCommentUseCase` → language check → **intent** (DetectBugbotFixIntentUseCase: `is_fix_request`, `is_do_request`, `target_finding_ids`) → **permission** (`ProjectRepository.isActorAllowedToModifyFiles`) → if allowed: **Bugbot autofix** (when fix request) or **Do user request** (when do request); else or when no such intent: **Think**.
- **PR review comment:** `PullRequestReviewCommentUseCase` → same flow as issue comment.
- **OpenCode:** `askAgent` (plan: intent) and `copilotMessage` (build: apply fixes or user request, run commands). No diff API usage.
- **Branch for issue_comment:** When the event is issue_comment, `param.commit.branch` may be empty; we resolve the branch from an open PR that references the issue (e.g. head branch of first such PR).
- **Do user request:** `DoUserRequestUseCase` (build prompt from user comment, call `copilotMessage`) and `runUserRequestCommitAndPush` (same verify/add/commit/push as bugbot, with generic commit message e.g. `chore(#42): apply user request`).

---

## 4. Implementation checklist

Use this section to track progress. Tick when done.

### Phase 1: Config and OpenCode intent

- [x] **1.1** Add `BUGBOT_FIX_VERIFY_COMMANDS` in `constants.ts`, `action.yml`, `github_action.ts`, `local_action.ts`; add `getBugbotFixVerifyCommands()` to `Ai` model.
- [x] **1.2** Add `BUGBOT_FIX_INTENT_RESPONSE_SCHEMA` (`is_fix_request`, `target_finding_ids`, `is_do_request`) in `bugbot/schema.ts`.
- [x] **1.3** Add `buildBugbotFixIntentPrompt(commentBody, unresolvedFindingsSummary, parentCommentBody?)` in `bugbot/build_bugbot_fix_intent_prompt.ts` (English; prompt asks OpenCode to decide if fix is requested, which ids, and if user wants a generic change in the repo).
- [x] **1.4** Create `DetectBugbotFixIntentUseCase`: load bugbot context (with optional branch override for issue_comment), build intent prompt, call `askAgent(plan)` with schema, parse response, return `{ isFixRequest, isDoRequest, targetFindingIds, context, branchOverride }`. Skip when no OpenCode or no issue number or no unresolved findings.

### Phase 2: PR parent comment context

- [x] **2.1** Add `commentInReplyToId` to `PullRequest` model (from `github.context.payload.pull_request_review_comment?.in_reply_to_id` or equivalent).
- [x] **2.2** In `PullRequestRepository` add `getPullRequestReviewCommentBody(owner, repo, prNumber, commentId, token)` to fetch a single comment body.
- [x] **2.3** When building the intent prompt for PR review comment, if `commentInReplyToId` is set, fetch the parent comment body and include it in the prompt so OpenCode knows the thread context.

### Phase 3: Autofix use case and prompt

- [x] **3.1** Add `buildBugbotFixPrompt(param, context, targetFindingIds, userComment, verifyCommands)` in `bugbot/build_bugbot_fix_prompt.ts`: include repo, branch, issue, PR, selected findings (id, title, description, file, line, suggestion), user comment, strict rules (only those findings; at most add tests; run verify commands and confirm they pass).
- [x] **3.2** Create `BugbotAutofixUseCase`: input `(param, targetFindingIds, userComment)`. Load context if needed, filter findings by `targetFindingIds`, build fix prompt, call `copilotMessage` (build agent). Return success/failure (no diff handling; changes are already on disk).

### Phase 4: Branch resolution and commit/push

- [x] **4.1** Add `getHeadBranchForIssue(owner, repo, issueNumber, token): Promise<string | undefined>` in `PullRequestRepository`: list open PRs, return head ref of the first PR that references the issue (body contains `#issueNumber` or head ref contains issue number).
- [x] **4.2** In autofix flow, when `param.commit.branch` is empty (e.g. issue_comment), resolve branch via `getHeadBranchForIssue`; pass branch override to `loadBugbotContext` (optional `LoadBugbotContextOptions.branchOverride`) so context uses the correct branch.
- [x] **4.3** Create `runBugbotAutofixCommitAndPush(execution, options?)` in `bugbot/bugbot_autofix_commit.ts`: (1) optionally checkout branch when `branchOverride` set; (2) run verify commands in order; if any fails, return failure. (3) `git status --short`; if no changes, return success without commit. (4) `git add -A`, `git commit`, `git push`. Uses `@actions/exec`.
- [x] **4.4** Ensure workflows that run on issue_comment / pull_request_review_comment have `contents: write` and document that for issue_comment the action checks out the resolved branch when needed. Documented in [How to use](/how-to-use) (Bugbot autofix note) and [OpenCode → How Bugbot works](/opencode-integration#how-bugbot-works-potential-problems).

### Phase 5: Integration and permission

- [x] **5.1** In `IssueCommentUseCase`: after intent, call `ProjectRepository.isActorAllowedToModifyFiles(owner, actor, token)`. If allowed and `isFixRequest` with targets and context: run `BugbotAutofixUseCase` → `runBugbotAutofixCommitAndPush` → `markFindingsResolved`. If allowed and `isDoRequest` (and no autofix ran): run `DoUserRequestUseCase` → `runUserRequestCommitAndPush`. Otherwise run `ThinkUseCase`.
- [x] **5.2** In `PullRequestReviewCommentUseCase`: same as above; parent comment body is included in intent prompt when `commentInReplyToId` is set.
- [x] **5.3** `isActorAllowedToModifyFiles`: when repo owner is Organization, check org membership; when User, actor must equal owner. Implemented in `ProjectRepository`.

### Phase 6: Tests, docs, rules

- [x] **6.1** Unit tests: `build_bugbot_fix_intent_prompt.test.ts`, `build_bugbot_fix_prompt.test.ts` (prompt shape and content).
- [x] **6.2** Update `docs/features.mdx`: Bugbot autofix row in AI features table; config `bugbot-fix-verify-commands`.
- [x] **6.3** Update `docs/troubleshooting.mdx`: Bugbot autofix accordion (bot didn't run, commit not made).
- [x] **6.4** Update `.cursor/rules/architecture.mdc`: Bugbot autofix row in key paths table.

---

## 5. Test coverage

| Area | Test file | Notes |
|------|-----------|--------|
| Detection pipeline | `src/usecase/steps/commit/__tests__/detect_potential_problems_use_case.test.ts` | Full flow: OpenCode response, publish to issue/PR, resolve, limit, severity, path validation, marker. |
| Issue comment flow | `src/usecase/__tests__/issue_comment_use_case.test.ts` | Language → intent → autofix or Think; payload helpers; commit/skip. |
| PR comment flow | `src/usecase/__tests__/pull_request_review_comment_use_case.test.ts` | Same scenarios as issue (intent, autofix, Think when not fix request). |
| Intent prompt | `src/usecase/steps/commit/bugbot/__tests__/build_bugbot_fix_intent_prompt.test.ts` | Prompt content, parent comment block. |
| Fix prompt | `src/usecase/steps/commit/bugbot/__tests__/build_bugbot_fix_prompt.test.ts` | Repo context, findings block, verify commands. |
| Path validation | `src/usecase/steps/commit/bugbot/__tests__/path_validation.test.ts` | isSafeFindingFilePath, isAllowedPathForPr, resolveFindingPathForPr. |
| Severity, limit, dedupe, file ignore | `severity.test.ts`, `limit_comments.test.ts`, `deduplicate_findings.test.ts`, `file_ignore.test.ts` | Filtering and publishing limits. |
| Marker | `src/usecase/steps/commit/bugbot/__tests__/marker.test.ts` | sanitizeFindingIdForMarker, buildMarker, parseMarker, markerRegexForFinding, replaceMarkerInBody, extractTitleFromBody, buildCommentBody. |
| Load context | `src/usecase/steps/commit/bugbot/__tests__/load_bugbot_context_use_case.test.ts` | Empty context, issue comment parsing, previousFindingsBlock/unresolvedFindingsWithBody, branchOverride, prContext, PR review markers merge. |
| Publish findings | `src/usecase/steps/commit/bugbot/__tests__/publish_findings_use_case.test.ts` | Issue comment add/update, PR review comment when file in prFiles, pathToFirstDiffLine, update existing PR comment, overflow comment. |
| Detect fix intent | `src/usecase/steps/commit/bugbot/__tests__/detect_bugbot_fix_intent_use_case.test.ts` | Skips (no OpenCode, no issue, empty body, no branch), branchOverride, unresolved findings filter, askAgent + payload, parent comment for PR. |
| Autofix use case | `src/usecase/steps/commit/bugbot/__tests__/bugbot_autofix_use_case.test.ts` | No targets/OpenCode skip, provided vs loaded context, valid unresolved ids filter, copilotMessage no text / success with payload. |
| Commit/push | `src/usecase/steps/commit/bugbot/__tests__/bugbot_autofix_commit.test.ts` | No branch, branchOverride fetch/checkout, verify command failure, no changes, add/commit/push success, commit/push error; **runUserRequestCommitAndPush**: same flow with generic commit message. |
| Mark resolved | `src/usecase/steps/commit/bugbot/__tests__/mark_findings_resolved_use_case.test.ts` | Skip when resolved or not in set, update issue comment, update PR comment + resolve thread, missing comment, normalizedResolvedIds, replaceMarkerInBody no match, updateComment error. |
| Do user request | `src/usecase/steps/commit/__tests__/user_request_use_case.test.ts` | Skip when no OpenCode or empty comment; success when copilotMessage returns text; failure when no response. |
| Permission | `src/data/repository/__tests__/project_repository.test.ts` | isActorAllowedToModifyFiles: org member (204 vs 404), user owner, API error. |

---

## 6. Key files (reference)

| Area | Path |
|------|------|
| Intent schema + prompt | `src/usecase/steps/commit/bugbot/` (schema, `build_bugbot_fix_intent_prompt.ts`) |
| Intent use case | `src/usecase/steps/commit/bugbot/detect_bugbot_fix_intent_use_case.ts` |
| Fix prompt | `src/usecase/steps/commit/bugbot/build_bugbot_fix_prompt.ts` |
| Autofix use case | `src/usecase/steps/commit/bugbot/bugbot_autofix_use_case.ts` |
| Do user request | `src/usecase/steps/commit/user_request_use_case.ts` |
| Commit/push | `src/usecase/steps/commit/bugbot/bugbot_autofix_commit.ts` (`runBugbotAutofixCommitAndPush`, `runUserRequestCommitAndPush`) |
| Permission | `src/data/repository/project_repository.ts` (`isActorAllowedToModifyFiles`) |
| PR parent comment | `src/data/model/pull_request.ts` (`commentInReplyToId`), `PullRequestRepository` (get comment by id) |
| Branch for issue | `PullRequestRepository.getHeadBranchForIssue` or similar |
| Config | `action.yml`, `constants.ts`, `github_action.ts`, `src/data/model/ai.ts` |
| Integration | `issue_comment_use_case.ts`, `pull_request_review_comment_use_case.ts` |

---

## 7. Notes

- **OpenCode applies changes in disk:** The server must run from the repo directory (e.g. `opencode-start-server: true`). We do not use `getSessionDiff` or any diff logic.
- **Intent only via OpenCode:** No local "fix request" or "do request" parsing; OpenCode returns `is_fix_request`, `is_do_request`, and `target_finding_ids` from the user comment and the list of pending findings.
- **Permission:** File-modifying actions (bugbot autofix and do user request) run only when the comment author is an **organization member** (if the repo owner is an org) or the **repo owner** (if user-owned). Otherwise we run Think so the user still gets a reply.
- **Do user request:** When the user asks for a generic change (e.g. "add a test for X", "refactor this") and not specifically to fix findings, we run `DoUserRequestUseCase` and `runUserRequestCommitAndPush` with a generic commit message. Same verify commands and branch/checkout logic as bugbot autofix.
- **Branch on issue_comment:** When the trigger is issue_comment, we resolve the branch from an open PR that references the issue, and use that for loading context and for checkout/commit/push when needed.

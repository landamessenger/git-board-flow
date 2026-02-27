---
name: Bugbot
description: Detailed technical reference for Bugbot (detection, markers, context, intent, autofix, do user request, permissions).
---

# Bugbot – technical reference

Bugbot has two main modes: **detection** (on push or single action) and **fix/do** (on issue comment or PR review comment). All Bugbot code lives under `src/usecase/steps/commit/bugbot/` and `src/usecase/steps/commit/` (DetectPotentialProblemsUseCase, user_request_use_case).

## 1. Detection flow (push or single action)

**Entry:** `CommitUseCase` (on push) calls `DetectPotentialProblemsUseCase`; or `SingleActionUseCase` when action is `detect_potential_problems_action`.

**Steps:**

1. **Guard:** OpenCode must be configured; `issueNumber !== -1`.
2. **Load context:** `loadBugbotContext(param)` → issue comments + PR review comments parsed for markers; builds `existingByFindingId`, `issueComments`, `openPrNumbers`, `previousFindingsBlock`, `prContext`, `unresolvedFindingsWithBody`. Branch is `param.commit.branch` (or `options.branchOverride` when provided). PR context includes `prHeadSha`, `prFiles`, `pathToFirstDiffLine` for the first open PR.
3. **Build prompt:** `buildBugbotPrompt(param, context)` – repo context, head/base branch, issue number, optional `ai-ignore-files`, and `previousFindingsBlock` (task 2: which previous findings are now resolved). OpenCode is asked to compute the diff itself and return `findings` + `resolved_finding_ids`.
4. **Call OpenCode:** `askAgent(OPENCODE_AGENT_PLAN, prompt, BUGBOT_RESPONSE_SCHEMA)`.
5. **Process response:** Filter findings: safe path (`isSafeFindingFilePath`), not in `ai-ignore-files` (`fileMatchesIgnorePatterns`), `meetsMinSeverity` (min from `bugbot-severity`), `deduplicateFindings`. Apply `applyCommentLimit(findings, bugbot-comment-limit)` → `toPublish`, `overflowCount`, `overflowTitles`.
6. **Mark resolved:** `markFindingsResolved(execution, context, resolvedFindingIds, normalizedResolvedIds)` – for each existing finding in context whose id is in resolved set, update issue comment (and PR review comment if any) via `replaceMarkerInBody` to set `resolved:true`; if PR comment, call `resolveReviewThread` when applicable.
7. **Publish:** `publishFindings(execution, context, toPublish, overflowCount?, overflowTitles?)` – for each finding: add or update **issue comment** (always); add or update **PR review comment** only when `finding.file` is in `prContext.prFiles` (using `pathToFirstDiffLine` when finding has no line). Each comment body is built with `buildCommentBody(finding, resolved)` and includes the **marker** `<!-- copilot-bugbot finding_id:"id" resolved:false -->`. Overflow: one extra issue comment summarizing excess findings.

## 2. Marker format and context

**Marker:** Hidden HTML comment in every finding comment (issue and PR):

`<!-- copilot-bugbot finding_id:"<id>" resolved:true|false -->`

- **Parse:** `parseMarker(body)` returns `{ findingId, resolved }[]`. Used when loading context from issue comments and PR review comments.
- **Build:** `buildMarker(findingId, resolved)`. IDs are sanitized (`sanitizeFindingIdForMarker`) so they cannot break HTML (no `-->`, `<`, `>`, newlines, etc.).
- **Update:** `replaceMarkerInBody(body, findingId, newResolved)` – used when marking a finding as resolved (same comment, body updated with `resolved:true`).

## 3. Fix intent and file-modifying actions (issue comment / PR review comment)

**Entry:** `IssueCommentUseCase` or `PullRequestReviewCommentUseCase` (after language check).

**Steps:**

1. **Intent:** `DetectBugbotFixIntentUseCase.invoke(param)`  
   - Guards: OpenCode configured, issue number set, comment body non-empty, branch (or branchOverride from `getHeadBranchForIssue` when commit.branch empty).  
   - `loadBugbotContext(param, { branchOverride })` → unresolved findings.  
   - Build `UnresolvedFindingSummary[]` (id, title from `extractTitleFromBody`, description = fullBody.slice(0, 4000)).  
   - If PR review comment and `commentInReplyToId`: fetch parent comment body (`getPullRequestReviewCommentBody`), slice(0,1500).trim for prompt.  
   - `buildBugbotFixIntentPrompt(commentBody, unresolvedFindings, parentCommentBody?)` → prompt asks: is_fix_request?, target_finding_ids?, is_do_request?  
   - `askAgent(OPENCODE_AGENT_PLAN, prompt, BUGBOT_FIX_INTENT_RESPONSE_SCHEMA)` → `{ is_fix_request, target_finding_ids, is_do_request }`.  
   - Payload: `isFixRequest`, `isDoRequest`, `targetFindingIds` (filtered to valid unresolved ids), `context`, `branchOverride`.

2. **Permission:** `ProjectRepository.isActorAllowedToModifyFiles(owner, actor, token)`.  
   - If owner is Organization: `orgs.checkMembershipForUser` (204 = allowed).  
   - If owner is User: allowed only if `actor === owner`.

3. **Branch A – Bugbot autofix** (when `canRunBugbotAutofix(payload)` and `allowedToModifyFiles`):  
   - `BugbotAutofixUseCase.invoke({ execution, targetFindingIds, userComment, context, branchOverride })`  
   - Load context if not provided; filter targets to valid unresolved ids; `buildBugbotFixPrompt(...)` with repo, findings block (truncated fullBody per finding), user comment, verify commands; `copilotMessage(ai, prompt)` (build agent).  
   - If success: `runBugbotAutofixCommitAndPush(execution, { branchOverride, targetFindingIds })` – optional checkout if branchOverride, run verify commands (from `getBugbotFixVerifyCommands`, max 20), git add/commit/push (message `fix(#N): bugbot autofix - resolve ...`).  
   - If committed and context: `markFindingsResolved({ execution, context, resolvedFindingIds, normalizedResolvedIds })`.

4. **Branch B – Do user request** (when `!runAutofix && canRunDoUserRequest(payload)` and `allowedToModifyFiles`):  
   - `DoUserRequestUseCase.invoke({ execution, userComment, branchOverride })`  
   - `buildUserRequestPrompt(execution, userComment)` – repo context + sanitized user request; `copilotMessage(ai, prompt)`.  
   - If success: `runUserRequestCommitAndPush(execution, { branchOverride })` – same verify/checkout/add/commit/push with message `chore(#N): apply user request` or `chore: apply user request`.

5. **Think** (when no file-modifying action ran): `ThinkUseCase.invoke(param)` – answers the user (e.g. question).

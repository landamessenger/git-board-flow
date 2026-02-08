# Git Board Flow: Automated Branch and Project Management GitHub Action

**Git Board Flow** is a GitHub Action that automates issue, branch, and project management using the Git-Flow methodology. It creates and links branches to issues, monitors commits and pull requests, and integrates with GitHub Projects.

**Full documentation:** [docs.page/landamessenger/git-board-flow](https://docs.page/landamessenger/git-board-flow) — setup, configuration, single actions, and AI (OpenCode).

---

## AI features (OpenCode)

All AI features use **OpenCode** (75+ LLM providers: OpenAI, Anthropic, Gemini, local models, etc.):

- **Progress detection** — Analyzes branch vs issue and posts a progress percentage on the issue (`check_progress_action`).
- **Think / reasoning** — Deep code analysis and change proposals (`think_action`).
- **AI PR description** — Generates or updates pull request descriptions from issue and diff.
- **Vector / AI cache** — Codebase analysis and embedding generation (`ai_cache_action` / `ai_cache_local_action`).

You can set `opencode-server-url` and `opencode-model`, or use **`opencode-start-server: true`** so the action starts and stops an OpenCode server in the job (no separate install needed; pass provider API keys as secrets).

See the [OpenCode (AI)](https://docs.page/landamessenger/git-board-flow/opencode-integration) docs for configuration and [Features & Capabilities](https://docs.page/landamessenger/git-board-flow/features) for the full list of actions.

---

## Key features

- **Automatic branch creation** — From issue labels (feature, bugfix, hotfix, release, docs, chore); branches are linked to the issue and summarized in a comment.
- **Commit monitoring** — Posts commit summaries on the issue when pushes occur on linked branches; optional commit prefix validation.
- **Pull request linking** — Links PRs to issues, adds them to projects, assigns reviewers, and can generate PR descriptions with AI.
- **GitHub Project integration** — Links issues and PRs to the configured projects (`project-ids`) and moves them to the right columns.
- **Single actions** — Run on-demand actions: check progress, think, create release/tag, vector indexing, deployed marking, and more.

---

## Quick start

### Issue workflow

```yaml
name: Git Board Flow - Issue

on:
  issues:
    types: [opened, edited, labeled, unlabeled]

concurrency:
  group: ${{ github.workflow }}-${{ github.event.issue.number || github.ref }}
  cancel-in-progress: true

jobs:
  git-board-flow-issues:
    name: Git Board Flow - Issue
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: landamessenger/git-board-flow@master
        with:
          token: ${{ secrets.PAT }}
          project-ids: '2,3'
          commit-prefix-transforms: 'replace-slash'
```

### Pull request workflow

```yaml
name: Git Board Flow - Pull Request

on:
  pull_request:
    types: [opened, edited, labeled, unlabeled]

concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

jobs:
  git-board-flow-pull-requests:
    name: Git Board Flow - Pull Request
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: landamessenger/git-board-flow@master
        with:
          token: ${{ secrets.PAT }}
          project-ids: '2,3'
          commit-prefix-transforms: 'replace-slash'
```

### Commit (push) workflow

```yaml
name: Git Board Flow - Commit

on:
  push:
    branches: ['**']

jobs:
  git-board-flow-commits:
    name: Git Board Flow - Commit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: landamessenger/git-board-flow@master
        with:
          token: ${{ secrets.PAT }}
          commit-prefix-transforms: 'replace-slash'
```

A **fine-grained Personal Access Token (PAT)** is required for branch and project operations. See [Authentication](https://docs.page/landamessenger/git-board-flow/authentication) in the docs.

---

## Commit prefix transforms

The `commit-prefix-transforms` input defines how branch names are turned into commit prefixes. You can chain several transforms (comma-separated).

| Transform | Example |
|-----------|---------|
| `replace-slash` | `feature/user-auth` → `feature-user-auth` |
| `replace-all` | Replace special chars with `-` |
| `lowercase`, `uppercase` | Case conversion |
| `kebab-case`, `snake-case`, `camel-case` | Naming style |
| `trim`, `clean-dashes`, `clean-underscores` | Cleanup |
| `remove-numbers`, `remove-special`, `remove-spaces` | Character removal |

Example:

```yaml
commit-prefix-transforms: "replace-all,lowercase,clean-dashes"
# Feature/User_Auth! → feature-user-auth
```

Default is `replace-slash`. Full list and details: [Configuration](https://docs.page/landamessenger/git-board-flow/configuration).

---

## Why Git Board Flow

- **Git-Flow aligned** — Feature, bugfix, hotfix, release, docs, and chore branches with consistent naming.
- **Visibility** — Issues, branches, and PRs stay linked and reflected on project boards.
- **Less manual work** — Branch creation, linking, assignees, reviewers, and comments are automated.
- **Fast** — Runs on Ubuntu and is designed to complete quickly.

---

Transform your GitHub workflow with **Git Board Flow**. For full feature list, single actions, and configuration, see the [documentation](https://docs.page/landamessenger/git-board-flow).

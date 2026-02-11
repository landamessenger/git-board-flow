# Git Board Flow: Automated Branch and Project Management GitHub Action

**Git Board Flow** is a GitHub Action that automates issue, branch, and project management using the Git-Flow methodology. It creates and links branches to issues, monitors commits and pull requests, and integrates with GitHub Projects.

**Full documentation:** [docs.page/landamessenger/git-board-flow](https://docs.page/landamessenger/git-board-flow) — setup, configuration, single actions, and AI (OpenCode).

---

## AI features (OpenCode)

All AI features use **OpenCode** (75+ LLM providers: OpenAI, Anthropic, Gemini, local models, etc.):

- **Progress detection** — On every push, analyzes branch vs issue and updates the progress label on the issue and on any open PRs for that branch. You can also run it on demand via single action or CLI (`check-progress`).
- **Bugbot (potential problems)** — On every push (or on demand via single action / CLI `detect-potential-problems`), OpenCode analyzes the branch vs base and reports findings as **comments on the issue** and **review comments on open PRs**; it updates or marks them as resolved when findings are fixed.
- **Think / reasoning** — Deep code analysis and change proposals (`think_action`).
- **AI PR description** — Generates or updates pull request descriptions by filling your `.github/pull_request_template.md` from the issue and branch diff.

You can set `opencode-server-url` and `opencode-model`, or use **`opencode-start-server: true`** so the action starts and stops an OpenCode server in the job (no separate install needed; pass provider API keys as secrets).

See the [OpenCode (AI)](https://docs.page/landamessenger/git-board-flow/opencode-integration) docs for configuration and [Features & Capabilities](https://docs.page/landamessenger/git-board-flow/features) for the full list of actions.

---

## Key features

- **Automatic branch creation** — From issue labels (feature, bugfix, hotfix, release, docs, chore); branches are linked to the issue and summarized in a comment.
- **Commit monitoring** — Posts commit summaries on the issue when pushes occur on linked branches; optional commit prefix validation.
- **Pull request linking** — Links PRs to issues, adds them to projects, assigns reviewers, and can generate PR descriptions with AI.
- **GitHub Project integration** — Links issues and PRs to the configured projects (`project-ids`) and moves them to the right columns.
- **Single actions** — Run on-demand actions: check progress, think, create release/tag, deployed marking, and more.
- **Workflow concurrency** — The action waits for previous runs of the **same workflow name** to finish, so you can run workflows sequentially (no cancel). See [Features → Workflow concurrency](https://docs.page/landamessenger/git-board-flow/features#workflow-concurrency-and-sequential-execution).

---

## Quick start

### Issue workflow

```yaml
name: Git Board Flow - Issue

on:
  issues:
    types: [opened, edited, labeled, unlabeled]
    
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

This workflow runs on every push. It notifies the issue of new commits, updates **size** and **progress** labels on the issue and on any open PRs for that branch (progress requires OpenCode), and can run **Bugbot** to report potential problems as issue and PR comments (OpenCode). No separate "check progress" workflow is needed.

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
          # Optional: for progress labels, add OpenCode config
          # opencode-server-url: ${{ secrets.OPENCODE_SERVER_URL }}
          # opencode-model: 'anthropic/claude-3-5-sonnet'
```

A **fine-grained Personal Access Token (PAT)** is required for branch and project operations. See [Authentication](https://docs.page/landamessenger/git-board-flow/authentication) in the docs.

---

## Testing locally (CLI)

The same logic as the GitHub Action runs in **CLI mode** via the `giik` command, so you can test workflows locally before pushing.

### 1. Prerequisites

- **Node.js 20** (e.g. `nvm use 20`).
- **Git repo** with `origin` pointing to a GitHub repo (e.g. `github.com/owner/repo`). The CLI reads `git config remote.origin.url` to get owner/repo.
- **Personal Access Token** for GitHub (env `PERSONAL_ACCESS_TOKEN` or `-t` / `--token`).
- For **AI features**: a running [OpenCode](https://docs.page/landamessenger/git-board-flow/opencode-integration) server (default `http://localhost:4096`). Optional env: `OPENCODE_SERVER_URL`, `OPENCODE_MODEL`.

### 2. Build and run

```bash
nvm use 20
npm install
npm run build
```

Run the CLI from the repo root (same repo that will use the action, or any repo with the same `origin`):

```bash
# Using the built binary (no global install)
node build/cli/index.js <command> [options]

# Or, if you install/link the package so that `giik` is on PATH:
giik <command> [options]
```

### 3. Commands that mirror the action

| Command | Description | Example |
|--------|-------------|--------|
| `setup` | Initial setup: labels, issue types, verify access | `node build/cli/index.js setup -t <PAT>` |
| `check-progress` | Run progress check on demand (progress is also updated automatically on every push) | `node build/cli/index.js check-progress -i 123 -t <PAT>` |
| `detect-potential-problems` | Bugbot: detect potential problems, report on issue and PR (OpenCode) | `node build/cli/index.js detect-potential-problems -i 123 -t <PAT>` |
| `recommend-steps` | Recommend implementation steps for an issue (OpenCode Plan) | `node build/cli/index.js recommend-steps -i 123 -t <PAT>` |
| `think` | Deep code analysis / reasoning (needs a question) | `node build/cli/index.js think -q "Where is auth validated?" -t <PAT>` |
| `copilot` | AI development assistant (analyze/modify code) | `node build/cli/index.js copilot -p "Explain src/cli.ts" -t <PAT>` |

Add `-d` or `--debug` for verbose logs. For OpenCode, use `--opencode-server-url` and `--opencode-model` if you don’t set env vars.

For a step-by-step guide to testing the OpenCode Plan flows (check-progress, detect-potential-problems, recommend-steps) locally, see [Testing OpenCode Plan Locally](https://docs.page/landamessenger/git-board-flow/testing-opencode-plan-locally).

### 4. Optional: `.env` in repo root

You can put secrets in a `.env` file (do not commit it). The CLI loads it via `dotenv`:

```bash
# .env (do not commit)
PERSONAL_ACCESS_TOKEN=ghp_...
OPENCODE_SERVER_URL=http://localhost:4096
OPENCODE_MODEL=opencode/kimi-k2.5
```

Then you can run without passing `-t` every time, e.g.:

```bash
node build/cli/index.js setup
node build/cli/index.js check-progress -i 123
```

---

## Code quality (ESLint)

The project uses **ESLint** with **typescript-eslint** (similar to Detekt/Ktlint for Kotlin) for TypeScript linting:

- `npm run lint` — runs ESLint on `src/`. Reports unused variables, `any` usage, and recommended rules.
- `npm run lint:fix` — auto-fixes what can be fixed (e.g. `prefer-const`, useless escapes).

Config: `eslint.config.mjs` (flat config). Test files (`*.test.ts`, `__tests__/**`) have relaxed rules for mocks. Fix remaining issues over time so CI can run `npm run lint` without failures.

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

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, conventions, and how to submit changes.

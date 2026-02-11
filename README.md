# Copilot: Automated Branch and Project Management GitHub Action

**Copilot** is a GitHub Action that automates issue, branch, and project management using the Git-Flow methodology. It creates and links branches to issues, monitors commits and pull requests, and integrates with GitHub Projects.

---

## Documentation index

Full documentation is published at **[docs.page/vypdev/copilot](https://docs.page/vypdev/copilot)**. Use this index to jump to the right section:

| Section | Description |
|--------|-------------|
| [How to use](https://docs.page/vypdev/copilot/how-to-use) | Step-by-step setup for issues, pull requests, and push workflows |
| [Features & capabilities](https://docs.page/vypdev/copilot/features) | Workflow triggers, single actions, AI (OpenCode), workflow concurrency |
| [Authentication](https://docs.page/vypdev/copilot/authentication) | PAT setup, permissions, and token best practices |
| [Configuration](https://docs.page/vypdev/copilot/configuration) | All inputs: branches, labels, projects, commit prefix, images, etc. |
| [OpenCode (AI)](https://docs.page/vypdev/copilot/opencode-integration) | Progress detection, Bugbot, think, AI PR description; server and model config |
| [Testing OpenCode Plan locally](https://docs.page/vypdev/copilot/testing-opencode-plan-locally) | Run check-progress, detect-potential-problems, recommend-steps via CLI |
| [Single actions](https://docs.page/vypdev/copilot/single-actions) | On-demand: check progress, think, create release/tag, deployed, etc. |
| [Issues](https://docs.page/vypdev/copilot/issues) | Issue configuration and issue types (feature, bugfix, hotfix, release, docs, chore) |
| [Pull requests](https://docs.page/vypdev/copilot/pull-requests) | PR configuration and AI description |
| [Troubleshooting](https://docs.page/vypdev/copilot/troubleshooting) | Common issues and solutions |
| [Support](https://docs.page/vypdev/copilot/support) | How to get help |

---

## Installation

### 1. Prerequisites

- A **Personal Access Token (PAT)** with permissions for the repo and, if used, GitHub Projects. See [Authentication](https://docs.page/vypdev/copilot/authentication).
- Store the token as a repository secret (e.g. `PAT`).

### 2. Add the action from the marketplace

Use the published action from the GitHub Actions marketplace so workflows are stable and versioned:

```yaml
uses: vypdev/copilot@v1
```

Do **not** pin to a branch (e.g. `@master`) in production; use a major version tag such as `@v1` so you get fixes without breaking changes.

### 3. Add workflows to your repository

Copy the workflow files from **`setup/workflows/`** in this repo into your repo’s `.github/workflows/`:

| File | Purpose |
|------|--------|
| `copilot_issue.yml` | Runs on issue events (opened, edited, labeled, etc.) |
| `copilot_pull_request.yml` | Runs on pull request events |
| `copilot_commit.yml` | Runs on push; notifies issue, updates size/progress, optional Bugbot |
| `copilot_issue_comment.yml` | Runs on issue comments (e.g. translations, think) |
| `copilot_pull_request_comment.yml` | Runs on PR review comments (e.g. translations) |
| `release_workflow.yml` | Optional: manual release with create_tag, create_release, deployed_action |
| `hotfix_workflow.yml` | Optional: manual hotfix with create_tag, create_release, deployed_action |

The workflows in `setup/workflows/` are already configured to use **`vypdev/copilot@v1`**. After copying, set your `vars` and `secrets` (e.g. `vars.PROJECT_IDS`, `secrets.PAT`, and optionally OpenCode-related vars/secrets).

For a minimal setup, see [How to use](https://docs.page/vypdev/copilot/how-to-use). For all inputs and options, see [Configuration](https://docs.page/vypdev/copilot/configuration).

### Quick installation (CLI)

To install the Copilot CLI globally from source so you can run `copilot` from anywhere:

```bash
git clone https://github.com/vypdev/copilot.git
cd copilot
npm install . -g
```

If the repo does not include the compiled `build/` folder (e.g. it is gitignored), run `npm install` and `npm run build` before `npm install . -g`.

Then run `copilot setup`, `copilot check-progress -i 123`, etc. See [Testing locally (CLI)](#testing-locally-cli) and [Single actions → Workflow & CLI](https://docs.page/vypdev/copilot/single-actions/workflow-and-cli).

---

## Quick start (minimal workflows)

Below are minimal examples. Prefer the **`setup/workflows/`** files and **`vypdev/copilot@v1`** for a complete, versioned setup.

### Issue workflow

```yaml
name: Copilot - Issue
on:
  issues:
    types: [opened, edited, labeled, unlabeled]
jobs:
  copilot-issues:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: vypdev/copilot@v1
        with:
          token: ${{ secrets.PAT }}
          project-ids: '2,3'
          commit-prefix-transforms: 'replace-slash'
```

### Pull request workflow

```yaml
name: Copilot - Pull Request
on:
  pull_request:
    types: [opened, edited, labeled, unlabeled]
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
jobs:
  copilot-pull-requests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: vypdev/copilot@v1
        with:
          token: ${{ secrets.PAT }}
          project-ids: '2,3'
          commit-prefix-transforms: 'replace-slash'
```

### Commit (push) workflow

Runs on every push: notifies the issue, updates size and progress labels (progress needs OpenCode), and can run Bugbot. See [OpenCode (AI)](https://docs.page/vypdev/copilot/opencode-integration).

```yaml
name: Copilot - Commit
on:
  push:
    branches: ['**']
jobs:
  copilot-commits:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: vypdev/copilot@v1
        with:
          token: ${{ secrets.PAT }}
          commit-prefix-transforms: 'replace-slash'
          # Optional for progress/Bugbot:
          # opencode-server-url: ${{ secrets.OPENCODE_SERVER_URL }}
          # opencode-model: 'anthropic/claude-3-5-sonnet'
```

---

## Key features

- **Automatic branch creation** — From issue labels (feature, bugfix, hotfix, release, docs, chore); branches are linked to the issue.
- **Commit monitoring** — Posts commit summaries on the issue; optional commit prefix validation.
- **Pull request linking** — Links PRs to issues, adds them to projects, assigns reviewers; optional AI-generated PR descriptions.
- **GitHub Project integration** — Links issues and PRs to configured projects and moves them to the right columns.
- **Single actions** — On-demand: check progress, think, create release/tag, deployed marking, and more.
- **Workflow concurrency** — Waits for previous runs of the same workflow name so runs can be sequential. See [Features → Workflow concurrency](https://docs.page/vypdev/copilot/features#workflow-concurrency-and-sequential-execution).

---

## AI features (OpenCode)

AI features use **OpenCode** (many LLM providers). See [OpenCode (AI)](https://docs.page/vypdev/copilot/opencode-integration).

- **Progress detection** — Updates progress label on the issue and open PRs (on push or via single action / CLI).
- **Bugbot** — Reports potential problems as issue and PR comments; updates or marks as resolved when fixed.
- **Think** — Deep code analysis and change proposals.
- **AI PR description** — Fills `.github/pull_request_template.md` from the issue and diff.

You can set `opencode-server-url` and `opencode-model`, or use **`opencode-start-server: true`** and pass provider API keys as secrets.

---

## Testing locally (CLI)

The same logic runs via the **CLI** so you can test before pushing. See [Testing OpenCode Plan locally](https://docs.page/vypdev/copilot/testing-opencode-plan-locally) and [Single actions → Workflow & CLI](https://docs.page/vypdev/copilot/single-actions/workflow-and-cli).

```bash
nvm use 20
npm install
npm run build
copilot <command> [options]
```

Examples: `setup`, `check-progress -i 123 -t <PAT>`, `detect-potential-problems -i 123`, `think -q "..."`, `do -p "..."`. Use `-d` for debug. Optional `.env` for `PERSONAL_ACCESS_TOKEN`, `OPENCODE_SERVER_URL`, `OPENCODE_MODEL`.

---

## Commit prefix transforms

The `commit-prefix-transforms` input defines how branch names become commit prefixes. See [Configuration](https://docs.page/vypdev/copilot/configuration).

| Transform | Example |
|-----------|--------|
| `replace-slash` | `feature/user-auth` → `feature-user-auth` |
| `replace-all`, `lowercase`, `uppercase` | Case and special chars |
| `kebab-case`, `snake_case`, `camel-case` | Naming style |
| `trim`, `clean-dashes`, `remove-numbers` | Cleanup |

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, conventions, and how to submit changes.

[![GitHub Marketplace](https://img.shields.io/badge/marketplace/actions/copilot?logo=github)](https://github.com/marketplace/actions/copilot)
[![codecov](https://codecov.io/gh/vypdev/copilot/branch/master/graph/badge.svg)](https://codecov.io/gh/vypdev/copilot)
![Build](https://github.com/vypdev/copilot/actions/workflows/ci_check.yml/badge.svg)
![License](https://img.shields.io/github/license/vypdev/copilot)


# Copilot — GitHub with super powers

**Copilot** is a GitHub Action for task management using Git-Flow: it links issues, branches, and pull requests to GitHub Projects, automates branch creation from labels, and keeps boards and progress in sync. Think of it as bringing Atlassian-style integration (boards, tasks, branches) to GitHub.

Full documentation: **[docs.page/vypdev/copilot](https://docs.page/vypdev/copilot)**

---

## Documentation index

| Section | Description |
|--------|-------------|
| [How to use](https://docs.page/vypdev/copilot/how-to-use) | Step-by-step setup: PAT, `copilot setup`, workflows |
| [Features & capabilities](https://docs.page/vypdev/copilot/features) | Workflow triggers, single actions, AI (OpenCode), concurrency |
| [Authentication](https://docs.page/vypdev/copilot/authentication) | PAT setup, permissions, token best practices |
| [Configuration](https://docs.page/vypdev/copilot/configuration) | All inputs: branches, labels, projects, images, etc. |
| [OpenCode (AI)](https://docs.page/vypdev/copilot/opencode-integration) | Progress, Bugbot, think, AI PR description |
| [Testing OpenCode locally](https://docs.page/vypdev/copilot/testing-opencode-plan-locally) | Run check-progress, detect-potential-problems, recommend-steps via CLI |
| [Single actions](https://docs.page/vypdev/copilot/single-actions) | On-demand: check progress, think, create release/tag, deployed |
| [Issues](https://docs.page/vypdev/copilot/issues) | Issue configuration and types (feature, bugfix, hotfix, release, docs, chore) |
| [Pull requests](https://docs.page/vypdev/copilot/pull-requests) | PR configuration and AI description |
| [Troubleshooting](https://docs.page/vypdev/copilot/troubleshooting) | Common issues and solutions |
| [Support](https://docs.page/vypdev/copilot/support) | How to get help |

---

## Getting started

1. **Create a PAT** and store it as a repo secret (e.g. `PAT`). See [Authentication](https://docs.page/vypdev/copilot/authentication).
2. **Use the action** from the marketplace so versions are stable:
   ```yaml
   uses: vypdev/copilot@v1
   ```
3. **Add workflows** — Copy the files from `setup/workflows/` into your `.github/workflows/`, or run **`copilot setup`** from your repo root (with `PERSONAL_ACCESS_TOKEN` in `.env`). See [How to use](https://docs.page/vypdev/copilot/how-to-use).

---

## What it does

- **Issues** — Branch creation from labels (feature, bugfix, hotfix, release, docs, chore), project linking, assignees, size/progress labels; optional Bugbot (AI) on the issue; from a comment you can ask to fix reported findings (Bugbot autofix).
- **Pull requests** — Link PRs to issues, update project columns, assign reviewers; optional AI-generated PR description; from a PR review comment you can ask to fix reported findings (Bugbot autofix).
- **Push (commits)** — Notify the issue, update size/progress; optional Bugbot (detection) and prefix checks.
- **Projects** — Link issues and PRs to boards and move them to the right columns.
- **Single actions** — On-demand: check progress, think, create release/tag, mark deployed, etc.
- **Concurrency** — Waits for previous runs of the same workflow so runs can be sequential. See [Features → Workflow concurrency](https://docs.page/vypdev/copilot/features#workflow-concurrency-and-sequential-execution).

AI features (progress, Bugbot, think, AI PR description) use **OpenCode**; see [OpenCode (AI)](https://docs.page/vypdev/copilot/opencode-integration). You can also run progress and Bugbot locally via the **CLI** — [Testing OpenCode locally](https://docs.page/vypdev/copilot/testing-opencode-plan-locally) and [Single actions → Workflow & CLI](https://docs.page/vypdev/copilot/single-actions/workflow-and-cli).

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, conventions, and how to submit changes.

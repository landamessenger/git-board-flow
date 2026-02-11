# Contributing to Copilot

Thank you for your interest in contributing to Copilot. This document provides guidelines for setting up the project and submitting changes.

## Development Setup

### Prerequisites

- **Node.js 20** – Use `nvm use 20` if you have nvm.
- **Git** – A GitHub repository with `origin` pointing to a valid GitHub URL.

### Initial Setup

```bash
nvm use 20
npm install
npm run build
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Compiles `src/actions/github_action.ts` → `build/github_action/`, `src/cli.ts` → `build/cli/`, and sets the CLI as executable. |
| `npm test` | Runs Jest tests (exclude e2e when relevant). |
| `npm run test:watch` | Runs tests in watch mode. |
| `npm run test:coverage` | Runs tests with coverage report. |
| `npm run lint` | Runs ESLint on `src/` (recommended rules + unused-vars, no-explicit-any). |
| `npm run lint:fix` | Auto-fixes fixable lint issues. |

## Project Structure

- **`src/actions/`** – GitHub Action and CLI entry points.
  - `github_action.ts` – GitHub Action entry; reads inputs and runs the main flow.
  - `local_action.ts` – CLI entry; same logic with local/config inputs.
  - `common_action.ts` – Shared flow: single actions vs issue/PR/push pipelines.
- **`src/usecase/`** – Use cases (issue, pull request, commit, single actions).
- **`src/manager/`** – Content handlers for PR descriptions, hotfix changelog, and markdown (e.g. `configuration_handler`, `markdown_content_hotfix_handler`).
- **`src/data/model/`** – Domain models (Execution, Ai, Issue, etc.).
- **`src/data/repository/`** – Repositories (GitHub API, OpenCode API).
- **`src/utils/`** – Constants, logger, content utils, etc.
- **`action.yml`** – Action metadata and input definitions.
- **`build/`** – Compiled output (bundled JS); do not edit directly.

## Conventions

1. **TypeScript** – Prefer TypeScript; keep action and CLI buildable with `ncc`.
2. **Constants** – Use `INPUT_KEYS` and `ACTIONS` from `src/utils/constants.ts` instead of ad-hoc strings.
3. **Logging** – Use existing logger (`logInfo`, `logError`, `logDebugInfo`) from `src/utils/logger.ts`.
4. **New inputs** – When adding inputs:
   - Update `action.yml`
   - Add to `INPUT_KEYS` in `src/utils/constants.ts`
   - Read the input in `github_action.ts` (and optionally `local_action.ts`)

## Code Quality

- Run `npm run lint` before submitting; fix issues with `npm run lint:fix`.
- Add or update tests for new functionality.
- Run `npm test` to ensure all tests pass.

## Documentation

- Update the relevant docs in `docs/` when changing behavior or adding features.
- For user-facing changes, update `README.md` and the docs at [docs.page/vypdev/copilot](https://docs.page/vypdev/copilot).
- The project uses [docs.page](https://docs.page/) (invertase) for publishing; see `docs.json` for sidebar structure.
- Use only **docs.page components** so the site builds without errors: **Card**, **CardGroup** (for multiple cards in a row; use `cols={2}` or `cols={3}`), **Callouts** (**Info**, **Warning**, **Error**, **Success** only — do not use Note or Tip), **Tabs**, **Accordion**, **Steps**, **Code Group**, etc. Do **not** use Mintlify-only components such as **Columns** (use **CardGroup** instead). See [docs.page Components](https://use.docs.page/components).

## Commit messages

Commit messages should start with the **current branch name** as prefix (with `/` replaced by `-`), e.g. `feature-292-github-action-rename: add concurrency to CI`.

The git hook that applies this automatically is **installed when you run `npm install`** (postinstall script). If you need to reinstall it: `node scripts/install-git-hooks.cjs`.

## Submitting Changes

1. Fork the repository and create a branch from `master` or `develop` (if applicable).
2. Make your changes, following the conventions above.
3. Ensure tests pass and lint is clean.
4. Submit a pull request with a clear description of the changes.
5. Link the PR to an issue if applicable (Copilot will help with that!).

## Questions?

Open an issue on [GitHub](https://github.com/vypdev/copilot) or check the [Support](https://docs.page/vypdev/copilot/support) page in the documentation.

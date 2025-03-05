# Git Board Flow: Automated Branch and Project Management GitHub Action

**Git Board Flow** is a powerful GitHub Action designed to streamline issue, branch, and project management while adhering to the Git-Flow methodology. This action simplifies your workflow by automating the creation and management of branches, linking them to issues, and ensuring smooth integration with GitHub Projects.

---

## Key Features

### 1. **Automatic Branch Creation**
- Detects when an issue is created or updated.
- Analyzes issue labels (or configuration defined in your workflow) to determine the necessary branches:
- **Feature**, **Bugfix**, **Hotfix**, **Release**, etc., following Git-Flow standards.
- Automatically creates branches and links them to the issue.
- Adds a summary comment to the issue describing the actions taken.

### 2. **Commit Monitoring**
- Detects commits in branches linked to an issue.
- Posts updates in the issue with a summary of the commits, including:
- Commit messages.
- Branch names.
- Links to the commit history.

### 3. **Pull Request Linking**
- Detects new PRs from branches linked to an issue.
- Automatically links the PR to the corresponding issue.
- Posts a comment in the PR summarizing its linkage and actions.

### 4. **GitHub Project Integration**
- Seamlessly links issues and PRs to the specified GitHub Projects.
- Ensures that all relevant entities are included in the right projects automatically.

### 5. **Efficiency**
- Runs on **Ubuntu** and completes tasks in under **20 seconds**, making it cost-effective and efficient for any repository.

---

## Use Cases
- **Team Collaboration**: Keep issues, branches, and PRs connected effortlessly for better visibility.
- **Automated Workflows**: Reduce manual overhead with automated branch management and notifications.
- **Git-Flow Compliance**: Maintain Git-Flow structure without additional effort.

---

## Issues Management

<p align="center"><img width="80%" vspace="10" src="https://github.com/landamessenger/git-board-flow/raw/master/images/issue_feature.png"></p>


```yaml
name: Git Board Flow - Issue

on:
  issues:
    types: [opened, edited, labeled, unlabeled]

concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

jobs:
  git-board-flow-issues:
    name: Git Board Flow - Issue
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Git Board Flow - Issue
        uses: landamessenger/git-board-flow@master
        with:
          project-urls: https://github.com/orgs/landamessenger/projects/2, https://github.com/orgs/landamessenger/projects/3
          commit-prefix-builder: |
            branchName.replace("/", "-");
          github-token: ${{ secrets.GITHUB_TOKEN }}
          github-token-personal: ${{ secrets.REPO_PAT }}
```

## Pull Request Management

<p align="center"><img width="80%" vspace="10" src="https://github.com/landamessenger/git-board-flow/raw/master/images/pull_request_linking.png"></p>

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
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Git Board Flow - Pull Request
        uses: landamessenger/git-board-flow@master
        with:
          project-urls: https://github.com/orgs/landamessenger/projects/2, https://github.com/orgs/landamessenger/projects/3
          commit-prefix-builder: |
            branchName.replace("/", "-");
          github-token: ${{ secrets.GITHUB_TOKEN }}
          github-token-personal: ${{ secrets.REPO_PAT }}
```

## Commits Check

<p align="center"><img width="80%" vspace="10" src="https://github.com/landamessenger/git-board-flow/raw/master/images/issue_commit.png"></p>

```yaml
name: Git Board Flow - Commit

on:
  push:
    branches:
      - '**'

jobs:
  git-board-flow-commits:
    name: Git Board Flow - Commit
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Git Board Flow - Commit
        uses: landamessenger/git-board-flow@master
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          github-token-personal: ${{ secrets.REPO_PAT }}
          commit-prefix-builder: |
            branchName.replace("/", "-");
```

- Warning received if the prefix of the commit does not match the one defined from `commit-prefix-builder`.

<p align="center"><img width="80%" vspace="10" src="https://github.com/landamessenger/git-board-flow/raw/master/images/issue_commit_warning.png"></p>

---

## Why Git Board Flow?
- **Consistent Git-Flow Management**: Adheres strictly to Git-Flow methodology for clear branching strategies.
- **Project Visibility**: Ensures all relevant branches, issues, and PRs are properly tracked and communicated.
- **Time-Saving**: Automates repetitive tasks, freeing up time for development and review.
- **Affordable**: Fast execution keeps costs low, even in large repositories.

---

Transform your GitHub workflow with **Git Board Flow**! 🚀

Experience seamless project management, automated branch handling, and enhanced team collaboration. Start optimizing your development process today and take your Git workflow to the next level! ✨

ssh -i gitboardflow -T git@gitboardflow.github.com

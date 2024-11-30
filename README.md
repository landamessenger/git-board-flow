# Git-Board: Automated Branch and Project Management GitHub Action

**Git-Board** is a powerful GitHub Action designed to streamline issue, branch, and project management while adhering to the Git-Flow methodology. This action simplifies your workflow by automating the creation and management of branches, linking them to issues, and ensuring smooth integration with GitHub Projects.

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

<p align="center"><img width="80%" vspace="10" src="https://github.com/landamessenger/git-board/raw/master/images/issue_feature.png"></p>


```yaml
name: Git Board - Issue

on:
  issues:
    types: [opened, edited, labeled, unlabeled]

concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

jobs:
  git-board-issues:
    name: Git Board - Issues
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Git Board - Issues
        uses: landamessenger/git-board@master
        with:
          action: issue
          project-urls: https://github.com/orgs/landamessenger/projects/2, https://github.com/orgs/landamessenger/projects/3
          commit-prefix-builder: |
            branchName.replace("/", "-");
          github-token: ${{ secrets.GITHUB_TOKEN }}
          github-token-personal: ${{ secrets.REPO_PAT }}
```

## Pull Request Management

```yaml
name: Git Board - Pull Requests

on:
  pull_request:
    types: [opened, edited, labeled, unlabeled]

concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

jobs:
  git-board-pull-requests:
    name: Git Board - Pull Requests
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Git Board - Pull Requests
        uses: landamessenger/git-board@master
        with:
          action: pull-request
          project-urls: https://github.com/orgs/landamessenger/projects/2, https://github.com/orgs/landamessenger/projects/3
          commit-prefix-builder: |
            branchName.replace("/", "-");
          github-token: ${{ secrets.GITHUB_TOKEN }}
          github-token-personal: ${{ secrets.REPO_PAT }}
```

## Commits Check

<p align="center"><img width="80%" vspace="10" src="https://github.com/landamessenger/git-board/raw/master/images/issue_commit.png"></p>

```yaml
name: Git Board - Commits

on:
  push:
    branches:
      - '**'

jobs:
  git-board-commits:
    name: Git Board - Commits
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Git Board - Commits
        uses: landamessenger/git-board@master
        with:
          action: commit
          github-token: ${{ secrets.GITHUB_TOKEN }}
          github-token-personal: ${{ secrets.REPO_PAT }}
          commit-prefix-builder: |
            branchName.replace("/", "-");
```

- Warning received if the prefix of the commit does not match the one defined from `commit-prefix-builder`.

<p align="center"><img width="80%" vspace="10" src="https://github.com/landamessenger/git-board/raw/master/images/issue_commit_warning.png"></p>

---

## Why Git-Board?
- **Consistent Git-Flow Management**: Adheres strictly to Git-Flow methodology for clear branching strategies.
- **Project Visibility**: Ensures all relevant branches, issues, and PRs are properly tracked and communicated.
- **Time-Saving**: Automates repetitive tasks, freeing up time for development and review.
- **Affordable**: Fast execution keeps costs low, even in large repositories.

---

Get started with **Git-Board** and simplify your GitHub project workflows today! 🚀
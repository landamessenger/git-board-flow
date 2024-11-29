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

## Example Issues Management Workflow

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
          run-always: false
          action-launcher-label: git-board
          feature-label: feature
          bugfix-label: bugfix
          hotfix-label: hotfix
          question-label: question
          help-label: help
          emoji-labeled-title: true
          main-branch: master
          development-branch: develop
          feature-tree: feature
          bugfix-tree: bugfix
          hotfix-tree: hotfix
          release-tree: release
          images-feature: https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExYmc4YWplZWs0Y2c3ZXNtbGpwZnQzdWpncmNjNXpodjg3MHdtbnJ5NiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/OMK7LRBedcnhm/200.webp, https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHBrYXpmd2poeGU5cWswbjRqNmJlZ2U2dWc0ejVpY3RpcXVuYTY3dSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/llKJGxQ1ESmac/giphy.webp, https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExMnFleXV0MXZteGN6c2s2b3R3ZGc2cWY1aXB0Y3ZzNmpvZHhyNDVmNSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/10FwycrnAkpshW/giphy.webp, https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExdmM1OWR0cnk5eXI0dXpoNWRzbmVseTVyd2l3MzdrOHZueHJ6bjhjMiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/12yjKJaLB7DuG4/giphy.webp
          images-bugfix: https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExazc3OWszenA5c2FlemE3a25oNnlmZDBra3liMWRqMW82NzM2b2FveCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/xPGkOAdiIO3Is/giphy.webp, https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExYmFoaHdqMG10eHUzb2toZzJra3pibXZ0NHk5NnRnazE3YmFiNGV1ZyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/OspWhQ8YttRf8QxDOh/giphy.webp, https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExY3liaGF2NzI3bzM1YjRmdHFsaGdyenp4b3o3M3dqM3F0bGN5MHZtNSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/npUpB306c3EStRK6qP/200.webp, https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExZWh6d3Nld3E0MTF1eTk2YXFibnI3MTBhbGtpamJiemRwejl3YmkzMSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/gU25raLP4pUu4/giphy.webp
          images-hotfix: https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExd2R0cjNxbXBjZjRjNmg4NmN3MGlhazVkNHJsaDkxMHZkY2hweGRtZSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/pCU4bC7kC6sxy/200.webp, https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExenkyZTc3aDlweWl0MnI0cXJsZGptY3g0bzE2NTY1aWMyaHd4Y201ZiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/dbtDDSvWErdf2/giphy.webp, https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExM25ndGd2d3Uya3g3dnlnenJ1bjh0Y2NtNHdwZHY3Mjh2NnBmZDJpbyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/2xF8gHUf085aNyyAQR/200.webp, https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExdjU3bHdsc3FtamlyazBlbWppNHc3MTV3MW4xdHd2cWo4b2tzbTkwcSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/1EghTrigJJhq8/200.webp
          images-clean-up: https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExYzRsNGFicndqMXgzMTVwdnhpeXNyZGsydXVxamV4eGxndWhna291OSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/ktcUyw6mBlMVa/200.webp, https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExdjkyeWVubngzM28xODFrbXZ4Nng3Y2hubmM4cXJqNGpic3Bheml0NSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/M11UVCRrc0LUk/giphy.webp, https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExenQwNDJmZnZraDBzNXBoNjUwZjEzMzFlanMxcHVodmF4b3l3bDl2biZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/zrdUjl6N99nLq/200.webp, https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExbmozN3plMWNiYjZoemh6N2RmeTB1MG9ieHlqYTJsb3BrZmNoY3h0dyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/stv1Dliu5TrMs/giphy.webp
          images-pr-link: https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExb2l4d25hNjEyNHRpN3NldzhsOGI2d2liZDdjYzcxdGFqb3E5N2FmOSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/2UHbv8WT6TKBeeP9Mt/giphy.webp, https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3FzdHFnMmRtMzNqZzRtc3M5ZzJpcTEwMzcxc3E2b2M2em9yOXdlMyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/MOGOpGFr52Rm5wZjJx/giphy.webp, https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExeGE5cHZsbjlybXBleXEwdDJ2N2N5enR6OGtoZjJqcjVncHZpNWJmciZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/d2Z9QYzA2aidiWn6/giphy.webp
          commit-prefix-builder: |
            branchName.replace("/", "-");
          github-token: ${{ secrets.GITHUB_TOKEN }}
          github-token-personal: ${{ secrets.REPO_PAT }}
```

## Example PR Management Workflow

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

## Example Commits Check Workflow

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

---

## Why Git-Board?
- **Consistent Git-Flow Management**: Adheres strictly to Git-Flow methodology for clear branching strategies.
- **Project Visibility**: Ensures all relevant branches, issues, and PRs are properly tracked and communicated.
- **Time-Saving**: Automates repetitive tasks, freeing up time for development and review.
- **Affordable**: Fast execution keeps costs low, even in large repositories.

---

Get started with **Git-Board** and simplify your GitHub project workflows today! 🚀
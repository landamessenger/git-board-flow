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
          commit-prefix-transforms: "replace-slash"
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
          commit-prefix-transforms: "replace-slash"
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
          commit-prefix-transforms: "replace-slash"
```

- Warning received if the prefix of the commit does not match the one defined from `commit-prefix-transforms`.

<p align="center"><img width="80%" vspace="10" src="https://github.com/landamessenger/git-board-flow/raw/master/images/issue_commit_warning.png"></p>

---

## Commit Prefix Transforms

Git Board Flow allows you to customize how branch names are transformed into commit prefixes using the `commit-prefix-transforms` parameter. You can apply multiple transformations sequentially to achieve the desired format.

### Available Transformations

| Transform | Description | Example |
|----------|-------------|---------|
| `replace-slash` | Replace "/" with "-" | `feature/user-auth` → `feature-user-auth` |
| `replace-all` | Replace all special chars with "-" | `feature/user_auth!` → `feature-user-auth-` |
| `lowercase` | Convert to lowercase | `Feature/User-Auth` → `feature/user-auth` |
| `uppercase` | Convert to uppercase | `feature/user-auth` → `FEATURE/USER-AUTH` |
| `kebab-case` | Clean kebab-case format | `Feature/User_Auth` → `feature-user-auth` |
| `snake-case` | Convert to snake_case | `feature/user-auth` → `feature_user_auth` |
| `camel-case` | Convert to camelCase | `feature/user-auth` → `featureUserAuth` |
| `trim` | Remove leading/trailing spaces | ` feature/user-auth ` → `feature/user-auth` |
| `remove-numbers` | Remove all numbers | `feature/123-user-auth` → `feature/-user-auth` |
| `remove-special` | Remove all special characters | `feature/user-auth!` → `featureuserauth` |
| `remove-spaces` | Remove all spaces | `feature/ user auth ` → `feature/userauth` |
| `remove-dashes` | Remove all dashes | `feature-user-auth` → `featureuserauth` |
| `remove-underscores` | Remove all underscores | `feature_user_auth` → `featureuserauth` |
| `clean-dashes` | Clean multiple dashes | `feature--user---auth` → `feature-user-auth` |
| `clean-underscores` | Clean multiple underscores | `feature__user___auth` → `feature_user_auth` |
| `prefix` | Add prefix | `user-auth` → `prefix-user-auth` |
| `suffix` | Add suffix | `user-auth` → `user-auth-suffix` |

### Usage Examples

#### Single Transformation
```yaml
commit-prefix-transforms: "replace-slash"
# Result: feature/user-auth → feature-user-auth
```

#### Multiple Transformations
```yaml
commit-prefix-transforms: "replace-all,lowercase,clean-dashes"
# Result: Feature/User_Auth! → feature-user-auth
```

#### Advanced Example
```yaml
commit-prefix-transforms: "replace-all,remove-numbers,clean-dashes,kebab-case"
# Result: feature/123-user-auth_v2.0 → feature-user-auth-v
```

#### Custom Workflow Examples
```yaml
# For clean commit prefixes
commit-prefix-transforms: "replace-all,kebab-case"

# For snake_case convention
commit-prefix-transforms: "replace-all,snake-case"

# For camelCase convention  
commit-prefix-transforms: "replace-all,camel-case"

# For uppercase convention
commit-prefix-transforms: "replace-all,uppercase,clean-dashes"
```

### Default Behavior
If no `commit-prefix-transforms` is specified, the default `replace-slash` transformation is applied, maintaining backward compatibility with existing configurations.

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


```bash
supabase --version
supabase login

// here the password database must be provided
supabase link --project-ref hxfleraccrowoltlsyij

supabase db push
```

```bash
brew install supabase/tap/supabase
```
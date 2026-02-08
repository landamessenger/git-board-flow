# Git Board Flow: Automated Branch and Project Management GitHub Action

**Git Board Flow** is a powerful GitHub Action designed to streamline issue, branch, and project management while adhering to the Git-Flow methodology. This action simplifies your workflow by automating the creation and management of branches, linking them to issues, and ensuring smooth integration with GitHub Projects.

## 🤖 AI-Powered Features (OpenCode)

Git Board Flow uses **OpenCode** for all AI features, so you can use 75+ LLM providers (OpenAI, Anthropic, Gemini, local models, etc.) from a single configuration:

- **OpenCode backend**: Analysis, progress detection, error detection, PR descriptions, and the copilot agent all go through your OpenCode server.
- **Configurable model**: Set `opencode-server-url` and `opencode-model` (e.g. `openai/gpt-4o-mini` or `anthropic/claude-3-5-sonnet`) in the action or via env vars.
- **AI Container Management**: Docker container preparation with model pre-loading (when using the vector/AI cache flow).
- **Vector Indexing**: Semantic code analysis and embedding generation.
- **Smart Caching**: Optimized for both GitHub-hosted and self-hosted runners.

See [docs/opencode-integration.md](docs/opencode-integration.md) for setup and configuration.

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

---

## 🤖 AI Container System

Git Board Flow includes a sophisticated AI container management system for efficient code analysis and vector indexing.

### Architecture Overview

The AI system uses Docker containers with pre-loaded machine learning models to perform semantic code analysis:

```
🐳 AI Container (6.62 GB)
├── 🐍 Python 3.11-slim (base)
├── 🤖 InstructorEmbedding model (~4 GB)
├── 📦 Python dependencies (~2 GB)
├── 🚀 FastAPI server
└── 🔧 System tools
```

### Container Naming Convention

AI containers follow a standardized naming pattern:
```
{organization_name}-manager-ai:latest
```

Examples:
- `git-board-flow-manager-ai:latest`
- `mycompany-manager-ai:latest`
- `opensource-project-manager-ai:latest`

### Environment-Specific Behavior

#### 🏠 **Local Development & Self-hosted Runners**
- **Strategy**: Use local images (persistent)
- **Behavior**: 
  - If image exists locally → Use it directly
  - If image doesn't exist → Build locally
  - Automatic cleanup of dangling images
- **Benefits**: Fast execution, no network overhead

#### ☁️ **GitHub-hosted Runners**
- **Strategy**: Use pre-built images from registry
- **Behavior**:
  - Check if image exists in registry
  - If exists → Pull and use
  - If doesn't exist → Build and push to registry
- **Benefits**: Consistent environment, shared resources

### CLI Commands

#### Build AI Container
```bash
# Build container and execute vector indexing
git-board-flow build-ai

# Build container only (skip vector indexing)
git-board-flow build-ai --skip-vector

# Build with debug mode
git-board-flow build-ai --debug
```

#### Ask AI Questions
```bash
# Ask AI about specific issue
git-board-flow ask-ai --issue 123 --question "How does authentication work?"

# Ask AI about specific branch
git-board-flow ask-ai --branch feature/auth --question "What are the main components?"
```

### GitHub Actions Integration

The AI system automatically integrates with GitHub Actions workflows:

```yaml
name: AI Knowledge Update
on:
  push:
    branches: ['**']

jobs:
  update-ai:
    runs-on: [self-hosted, macOS, X64]
    steps:
      - uses: actions/checkout@v4
      - name: Update AI Knowledge
        uses: ./
        with:
          single-action: vector_action
          # ... other parameters
```

### Registry Management

#### Automatic Architecture Detection
- **macOS ARM64 (M1/M2)**: `{org}-manager-arm64-ai:latest`
- **macOS x64**: `{org}-manager-amd64-ai:latest`
- **Linux x64**: `{org}-manager-amd64-ai:latest`
- **Linux ARM64**: `{org}-manager-arm64-ai:latest`
- **Linux ARM32**: `{org}-manager-armv7-ai:latest`

#### Registry Options
- **GitHub Container Registry (GHCR)**: Recommended for GitHub projects
- **Docker Hub**: Universal compatibility
- **AWS ECR**: Enterprise-grade security
- **Azure ACR**: Microsoft ecosystem integration

### Performance Optimization

#### Space Management
- **Before**: ~46 GB (multiple duplicate images)
- **After**: ~13 GB (optimized image management)
- **Savings**: ~33 GB of disk space

#### Execution Speed
- **Local/Self-hosted**: Instant (uses cached images)
- **GitHub-hosted**: Fast pull (~2-3 minutes for 6.62 GB)
- **Build time**: ~10-15 minutes (only when needed)

### Troubleshooting

#### Common Issues

**Image not found in registry**
```bash
# Solution: Build and push image
git-board-flow build-ai --skip-vector
```

**Docker space issues**
```bash
# Solution: Clean up dangling images
docker system prune -f
```

**Permission denied**
```bash
# Solution: Login to registry
docker login ghcr.io
```

### Development Workflow

1. **Initial Setup**: Run `git-board-flow build-ai` to create initial container
2. **Code Changes**: AI automatically detects and indexes new code
3. **Registry Updates**: Push updated images when dependencies change
4. **Team Collaboration**: All team members use same pre-built images

---

Transform your GitHub workflow with **Git Board Flow**! 🚀

Experience seamless project management, automated branch handling, AI-powered code analysis, and enhanced team collaboration. Start optimizing your development process today and take your Git workflow to the next level! ✨
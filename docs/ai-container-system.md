# AI Container System - Quick Start Guide

## 🚀 Getting Started

### 1. Build AI Container

```bash
# Build AI container for current architecture
git-board-flow build-ai

# The system automatically:
# - Detects your architecture (amd64, arm64, armv7)
# - Checks if image exists in registry
# - Builds and pushes if needed
# - Executes vector indexing
```

### 2. Build Container Only (Skip Vector Indexing)

```bash
# Build container only, skip vector indexing
git-board-flow build-ai --skip-vector
```

### 3. Use in GitHub Actions

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
```

### 4. Use in CLI

```bash
# Build AI container and execute vector indexing
git-board-flow build-ai

# Build container only (skip vector indexing)
git-board-flow build-ai --skip-vector

# Build with debug mode
git-board-flow build-ai --debug
```

## 🏗️ Architecture

### Multi-Architecture Support

The AI container system supports multiple architectures:

| Architecture | Platform | Status | Use Case |
|--------------|----------|--------|----------|
| **linux/amd64** | Ubuntu x64, macOS x64 | ✅ Supported | GitHub-hosted runners, most servers |
| **linux/arm64** | macOS ARM64 (M1/M2), Linux ARM64 | ✅ Supported | Apple Silicon, ARM servers |
| **linux/arm/v7** | Raspberry Pi, ARM32 | ✅ Supported | IoT devices, embedded systems |

### Automatic Architecture Detection

The system automatically detects the current architecture and uses the appropriate image:

```bash
# Check current architecture
node -e "console.log(process.platform + '/' + process.arch)"

# Examples:
# darwin/arm64 → Uses git-board-flow-manager-arm64-ai:latest
# darwin/x64 → Uses git-board-flow-manager-amd64-ai:latest
# linux/x64 → Uses git-board-flow-manager-amd64-ai:latest
```

### Container Naming Convention
```
{organization_name}-manager-{arch_type}-ai:latest
```

**Architecture Types:**
- `amd64`: Linux x64, macOS x64, Windows x64
- `arm64`: macOS ARM64 (M1/M2), Linux ARM64
- `armv7`: Linux ARM32 (Raspberry Pi)

**Examples:**
- `git-board-flow-manager-amd64-ai:latest`
- `git-board-flow-manager-arm64-ai:latest`
- `git-board-flow-manager-armv7-ai:latest`

### Environment Behavior

| Environment | Strategy | Behavior |
|-------------|----------|----------|
| **Local Development** | Local Images | Use existing or build locally |
| **Self-hosted Runners** | Local Images | Use existing or build locally |
| **GitHub-hosted Runners** | Registry Images | Pull from registry or build and push |

### Registry Options

| Registry | URL Format | Use Case |
|----------|------------|----------|
| **GitHub Container Registry** | `ghcr.io/{org}/{org}-manager-ai:latest` | GitHub projects |
| **Docker Hub** | `{org}/{org}-manager-ai:latest` | Universal |
| **AWS ECR** | `{account}.dkr.ecr.{region}.amazonaws.com/{org}-manager-ai:latest` | Enterprise |
| **Azure ACR** | `{registry}.azurecr.io/{org}-manager-ai:latest` | Microsoft ecosystem |

## 🔧 Troubleshooting

### Common Issues

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

### Performance Metrics

- **Container Size**: ~6.62 GB (includes AI model)
- **Build Time**: ~10-15 minutes (first time)
- **Pull Time**: ~2-3 minutes (from registry)
- **Space Savings**: ~33 GB (vs old system)

## 📋 Use Cases

### Development Team
1. **Initial Setup**: Run `git-board-flow build-ai` once
2. **Code Changes**: AI automatically indexes new code
3. **Team Sync**: All members use same pre-built images

### CI/CD Pipeline
1. **Registry Check**: Verify image exists in registry
2. **Pull or Build**: Use existing or create new image
3. **Execute**: Run AI analysis on code changes

### Enterprise Deployment
1. **Private Registry**: Use internal container registry
2. **Security**: Control access to AI models
3. **Compliance**: Audit AI model usage

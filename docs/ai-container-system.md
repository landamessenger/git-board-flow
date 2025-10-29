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

### 5. Verify Multi-Architecture Support

```bash
# Check if Docker Buildx is available
docker buildx version

# If not available, install Docker Buildx
# On macOS with Homebrew:
brew install docker-buildx

# On Ubuntu/Debian:
sudo apt-get install docker-buildx-plugin

# Verify multi-architecture build capability
docker buildx ls
```

#### OrbStack Users

If you're using OrbStack and encounter the error "Multi-platform build is not supported for the docker driver", the system will automatically:

1. **Create a custom builder**: Automatically creates a `git-board-flow-multiarch` builder with `docker-container` driver
2. **Handle multi-platform builds**: Uses the custom builder for `linux/amd64` and `linux/arm64` platforms
3. **Clean up resources**: Removes the custom builder when stopping containers

**Manual setup (optional):**
```bash
# Create a multi-platform builder manually
docker buildx create --name git-board-flow-multiarch --driver docker-container --platform linux/amd64,linux/arm64

# Start the builder
docker buildx inspect --bootstrap git-board-flow-multiarch

# Use the builder
docker buildx use git-board-flow-multiarch
```

## 🏗️ Architecture

### Multi-Architecture Support

The AI container system automatically builds and supports multiple architectures using Docker Buildx:

| Architecture | Platform | Status | Use Case |
|--------------|----------|--------|----------|
| **linux/amd64** | Ubuntu x64, macOS x64 | ✅ Supported | GitHub-hosted runners, most servers |
| **linux/arm64** | macOS ARM64 (M1/M2), Linux ARM64 | ✅ Supported | Apple Silicon, ARM servers |
| **linux/arm/v7** | Raspberry Pi, ARM32 | ✅ Supported | IoT devices, embedded systems |

#### Automatic Multi-Architecture Builds

The system automatically detects if Docker Buildx is available and builds images for both `linux/amd64` and `linux/arm64` platforms simultaneously. This ensures:

- **Consistent image sizes**: Both architectures are built from the same Dockerfile
- **Optimized performance**: Each architecture gets its native optimized binaries
- **Single manifest**: Docker automatically creates a multi-architecture manifest
- **Fallback support**: If Buildx is not available, falls back to single-architecture builds

#### Benefits of Multi-Architecture Builds

- **Reduced size differences**: Eliminates the ~6.7GB difference between Intel and Apple Silicon builds
- **Native optimization**: Each architecture gets optimized PyTorch wheels and dependencies
- **Single command**: One build command creates images for both platforms
- **Registry efficiency**: Single manifest entry in GitHub Container Registry
- **Developer experience**: Works seamlessly across different development machines

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
{organization_name}-manager-ai:{version}
```

### Image Versioning Strategy

The system uses a sophisticated versioning strategy based on the context:

| Context | Version Format | Example | Description |
|---------|----------------|---------|-------------|
| **Release** | `v{version}` | `v1.2.3` | Semantic version from release |
| **Hotfix** | `v{version}` | `v1.2.4` | Semantic version from hotfix |
| **Development** | `{commit-sha}` | `a1b2c3d4` | First 8 chars of commit SHA |
| **Fallback** | `latest` | `latest` | When no specific version available |

### Multi-Tag Strategy

For release and hotfix builds, the system creates multiple tags:

```bash
# Example for release v1.2.3:
ghcr.io/org/org-manager-ai:v1.2.3        # Specific version
ghcr.io/org/org-manager-ai:latest        # Latest release
ghcr.io/org/org-manager-ai:v1.2.3-amd64  # Architecture-specific
ghcr.io/org/org-manager-ai:v1.2.3-arm64  # Architecture-specific
```

**Architecture Types:**
- `amd64`: Linux x64, macOS x64, Windows x64
- `arm64`: macOS ARM64 (M1/M2), Linux ARM64
- `armv7`: Linux ARM32 (Raspberry Pi)

**Examples:**
- `git-board-flow-manager-ai:v1.2.3` (release)
- `git-board-flow-manager-ai:latest` (latest release)
- `git-board-flow-manager-ai:a1b2c3d4` (development build)

### Versioning Benefits

- **🔍 Traceability**: Easy to track which code version is running
- **🔄 Rollback**: Quick rollback to previous stable versions
- **🏷️ Tagging**: Multiple tags for different use cases
- **📊 Monitoring**: Better monitoring and debugging capabilities
- **🔒 Stability**: Pin to specific versions in production
- **🚀 Development**: Use commit SHA for development builds

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

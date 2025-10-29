import Docker, { Container } from 'dockerode';
import path from 'path';
import axios from 'axios';
import { logDebugError, logDebugInfo, logError } from '../../utils/logger';
import { Execution } from '../model/execution';
import { execSync, spawn } from 'child_process';

interface EmbedRequest {
    instructions: string[];
    texts: string[];
}

interface EmbedResponse {
    embeddings: number[][];
}

interface HealthCheckResponse {
    status: 'ready' | 'error' | string;
    progress?: number;
    message?: string;
}

export class DockerRepository {
    private docker: Docker;
    private readonly dockerDir: string;

    constructor() {
        this.docker = new Docker();
        this.dockerDir = path.join(process.cwd(), 'docker');
    }

    private isGitHubActions(): boolean {
        return process.env.GITHUB_ACTIONS === 'true';
    }

    private isSelfHostedRunner(): boolean {
        return process.env.RUNNER_TEMP?.includes('actions-runner') ||
               process.env.GITHUB_RUN_ID === undefined ||
               process.env.GITHUB_HOSTED === 'false';
    }

    private shouldUsePrebuiltImage(): boolean {
        return this.isGitHubActions() && !this.isSelfHostedRunner();
    }

    private shouldUseLocalImage(): boolean {
        return !this.isGitHubActions() || this.isSelfHostedRunner();
    }

    getArchitectureType(): string {
        const platform = process.platform;
        const arch = process.arch;

        if (platform === 'darwin' && arch === 'arm64') return 'arm64';
        if (platform === 'darwin' && arch === 'x64') return 'amd64';
        if (platform === 'linux' && arch === 'x64') return 'amd64';
        if (platform === 'linux' && arch === 'arm64') return 'arm64';
        if (platform === 'linux' && arch === 'arm') return 'armv7';
        if (platform === 'win32' && arch === 'x64') return 'amd64';

        logDebugInfo(`🐳 🟡 Unknown architecture: ${platform}/${arch}, defaulting to amd64`);
        return 'amd64';
    }

    // ==============================
    // 🔧 Core Docker Lifecycle
    // ==============================

    prepareLocalVectorServer = async (param: Execution): Promise<void> => {
        logDebugInfo('🐳 🟡 Preparing local vector server...');
        
        const imageName = this.getImageNameWithTag(param);
        const registryImageName = `ghcr.io/${param.owner}/${imageName}`;
        
        try {
            // Authenticate with registry
            await this.authenticateWithRegistry(param.owner, param.tokens.classicToken);
            
            // Check if image already exists locally
            const localImageExists = await this.imageExists(param);
            if (localImageExists) {
                logDebugInfo(`🐳 🟢 Local image ${imageName} already exists, skipping pull`);
                return;
            }
            
            // Check if multi-architecture image exists in registry
            const registryImageExists = await this.checkMultiArchImageInRegistry(param);
            if (!registryImageExists) {
                throw new Error(`Multi-architecture image not found in registry: ${registryImageName}. Please build the image first using PrepareAIContainerUseCase.`);
            }
            
            // Pull the multi-architecture image from registry
            logDebugInfo(`🐳 🟡 Pulling multi-architecture image from registry: ${registryImageName}`);
            
            try {
                execSync(`docker pull ${registryImageName}`, { 
                    stdio: 'inherit',
                    env: { ...process.env, DOCKER_BUILDKIT: '1' }
                });
                logDebugInfo(`🐳 🟢 Successfully pulled multi-architecture image: ${registryImageName}`);
            } catch (error) {
                logError(`🐳 🔴 Failed to pull image: ${error}`);
                throw error;
            }
            
            // Tag the pulled image with local name for consistency
            execSync(`docker tag ${registryImageName} ${imageName}`, { stdio: 'pipe' });
            
            logDebugInfo(`🐳 🟢 Multi-architecture image pulled and tagged successfully: ${imageName}`);
        } catch (error) {
            logError(`🐳 🔴 Failed to prepare local vector server: ${error}`);
            throw error;
        }
    }

    private async checkMultiArchImageInRegistry(param: Execution): Promise<boolean> {
        const imageName = this.getImageNameWithTag(param);
        const registryImageName = `ghcr.io/${param.owner}/${imageName}`;
        
        try {
            logDebugInfo(`🐳 🟡 Checking multi-architecture image in registry: ${registryImageName}`);
            
            // Try to inspect the manifest to check if multi-arch image exists
            const output = execSync(`docker manifest inspect ${registryImageName}`, { 
                encoding: 'utf8',
                stdio: 'pipe'
            });

            logDebugInfo(`🐳 🟡 Manifest output: ${output.substring(0, 500)}...`);
            
            // Check if the manifest contains both architectures
            const hasAmd64 = output.includes('"architecture": "amd64"');
            const hasArm64 = output.includes('"architecture": "arm64"');
            
            logDebugInfo(`🐳 🟡 Registry image check - AMD64: ${hasAmd64}, ARM64: ${hasArm64}`);
            return hasAmd64 && hasArm64;
        } catch (error) {
            logDebugInfo(`🐳 🟡 Multi-architecture image not found in registry: ${registryImageName} - ${error}`);
            
            // If specific version not found, try latest tag as fallback
            if (!imageName.includes('latest')) {
                logDebugInfo(`🐳 🟡 Trying latest tag as fallback...`);
                const latestImageName = `${this.getImageName(param)}:latest`;
                const latestRegistryImageName = `ghcr.io/${param.owner}/${latestImageName}`;
                
                try {
                    const latestOutput = execSync(`docker manifest inspect ${latestRegistryImageName}`, { 
                        encoding: 'utf8',
                        stdio: 'pipe'
                    });
                    
                    const hasAmd64Latest = latestOutput.includes('"architecture": "amd64"');
                    const hasArm64Latest = latestOutput.includes('"architecture": "arm64"');
                    
                    if (hasAmd64Latest && hasArm64Latest) {
                        logDebugInfo(`🐳 🟢 Found latest multi-architecture image, will use that instead`);
                        return true;
                    }
                } catch {
                    logDebugInfo(`🐳 🟡 Latest image also not found in registry`);
                }
            }
            
            return false;
        }
    }

    checkVersionExistsInRegistry = async (param: Execution): Promise<boolean> => {
        const imageName = this.getImageNameWithTag(param);
        const registryImageName = `ghcr.io/${param.owner}/${imageName}`;
        
        try {
            logDebugInfo(`🐳 🟡 Checking if version already exists in registry: ${registryImageName}`);
            
            // Try to inspect the manifest to check if version exists
            const output = execSync(`docker manifest inspect ${registryImageName}`, { 
                encoding: 'utf8',
                stdio: 'pipe'
            });

            // Check if the manifest contains both architectures (multi-arch image)
            const hasAmd64 = output.includes('"architecture": "amd64"');
            const hasArm64 = output.includes('"architecture": "arm64"');
            
            const versionExists = hasAmd64 && hasArm64;
            logDebugInfo(`🐳 🟡 Version ${imageName} exists in registry: ${versionExists}`);
            
            return versionExists;
        } catch (error) {
            logDebugInfo(`🐳 🟡 Version ${imageName} not found in registry: ${error}`);
            return false;
        }
    }

    startContainer = async (param: Execution): Promise<void> => {
        logDebugInfo('🐳 🟡 Starting Docker container...');
        const isRunning = await this.isContainerRunning(param);
        if (isRunning) {
            logDebugInfo('🐳 🟢 Docker container is ready');
            return;
        }

        try {
            /*
            if (this.shouldUsePrebuiltImage()) {
                const imageExists = await this.imageExists(param);
                if (!imageExists) {
                    const pulled = await this.pullPrebuiltImage(param);
                    if (!pulled) throw new Error('Prebuilt image not available');
                }
            } else if (this.shouldUseLocalImage()) {
                const imageExists = await this.imageExists(param);
                if (!imageExists) await this.buildImage(param);
            }*/

            await this.runContainer(param);
            logDebugInfo('🐳 🟢 Container started successfully');
        } catch (error) {
            logError('Error starting container: ' + error);
            throw error;
        }
    }

    private runContainer = async (param: Execution): Promise<void> => {
        const container = await this.getContainer(param);
        const info = await container.inspect();
        if (info.State.Status !== 'running') await container.start();
        await this.waitForContainer(param);
    }

    imageExists = async (param: Execution): Promise<boolean> => {
        const images = await this.docker.listImages();
        return images.some(img =>
            img.RepoTags && img.RepoTags.includes(this.getImageNameWithTag(param))
        );
    }

    getImageName(param: Execution): string {
        return param.dockerConfig.getContainerName();
    }

    getImageNameWithTag(param: Execution): string {
        const version = this.generateImageVersion(param);
        return `${this.getImageName(param)}:${version}`;
    }

    private generateImageVersion(param: Execution): string {
        if (param.singleAction.version.length > 0) {
            return `v${param.singleAction.version}`;
        }

        // Fallback to latest
        return 'latest';
    }

    private generateImageTags(param: Execution): string[] {
        const baseImageName = this.getImageName(param);
        const tags: string[] = [];

        // Always include the specific version
        const version = this.generateImageVersion(param);
        tags.push(`${baseImageName}:${version}`);
        tags.push(`${baseImageName}:latest`);

        return tags;
    }

    private pullPrebuiltImage = async (param: Execution): Promise<boolean> => {
        try {
            const imageName = this.getImageNameWithTag(param);
            const registryImageName = `ghcr.io/${param.owner}/${imageName}`;
            const stream = await this.docker.pull(registryImageName);
            await new Promise((resolve, reject) => {
                this.docker.modem.followProgress(stream, (err: any) => {
                    if (err) reject(err); else resolve(true);
                });
            });
            return true;
        } catch {
            return false;
        }
    }

    // ==============================
    // 🧱 Build Image
    // ==============================

    buildImage = async (param: Execution): Promise<void> => {
        // const imageName = this.getImageNameWithTag(param);
        // const archType = this.getArchitectureType();

        // Check if Docker Buildx is available for multi-architecture builds
        const buildxAvailable = await this.checkDockerBuildxAvailable();
        
        if (buildxAvailable) {
            await this.buildMultiArchImage(param);
        } 
        
        /* else {
            logDebugInfo(`🐳 🟡 Building single-architecture Docker image: ${imageName} for architecture: ${archType}`);
            await this.buildSingleArchImage(param, imageName, archType);
        }*/

        logDebugInfo('🐳 🟢 Docker image built successfully');
    }

    private async checkDockerBuildxAvailable(): Promise<boolean> {
        try {
            // Check if Docker Buildx is installed
            execSync('docker buildx version', { stdio: 'pipe' });
            
            // Check if we can create a multi-platform builder
            try {
                const testBuilderName = 'test-multiarch-builder';
                execSync(`docker buildx create --name ${testBuilderName} --driver docker-container --platform linux/amd64,linux/arm64`, { stdio: 'pipe' });
                execSync(`docker buildx rm ${testBuilderName}`, { stdio: 'pipe' });
                logDebugInfo('🐳 🟢 Docker Buildx supports multi-platform builds');
                return true;
            } catch {
                logDebugInfo('🐳 🟡 Docker Buildx available but multi-platform not supported, will create custom builder');
                return true; // Still return true, we'll handle the builder creation in buildMultiArchImage
            }
        } catch {
            logDebugInfo('🐳 🟡 Docker Buildx not available, falling back to single-architecture build');
            return false;
        }
    }

    private async buildMultiArchImage(param: Execution): Promise<void> {
        const imageTags = this.generateImageTags(param);
        const registryImageTags = imageTags.map(tag => `ghcr.io/${param.owner}/${tag}`);
        
        logDebugInfo(`🐳 🟡 Building multi-architecture Docker image with tags: ${imageTags.join(', ')}`);
        logDebugInfo(`🐳 🟡 Registry tags: ${registryImageTags.join(', ')}`);

        // Authenticate with registry before building
        await this.authenticateWithRegistry(param.owner, param.tokens.classicToken);
        
        // Create or use a multi-platform builder
        const builderName = 'git-board-flow-multiarch';
        await this.ensureMultiPlatformBuilder(builderName);
        
        // Build and push multi-architecture image using Docker Buildx
        const buildCommand = [
            'docker', 'buildx', 'build',
            '--builder', builderName,
            '--platform', 'linux/amd64,linux/arm64',
            ...registryImageTags.flatMap(tag => ['--tag', tag]),
            '--push',
            '--file', path.join(this.dockerDir, 'Dockerfile'),
            this.dockerDir
        ];

        logDebugInfo(`🐳 🟡 Executing: ${buildCommand.join(' ')}`);
        
        try {
            execSync(buildCommand.join(' '), { 
                stdio: 'inherit',
                env: { ...process.env, DOCKER_BUILDKIT: '1' }
            });
            logDebugInfo(`🐳 🟢 Multi-architecture image built and pushed successfully with tags: ${imageTags.join(', ')}`);

            await this.cleanupDanglingImages();
            await this.cleanupBuildxBuilder();
        } catch (error) {
            logError(`🐳 🔴 Multi-architecture build failed: ${error}`);
            throw error;
        }
    }

    private async ensureMultiPlatformBuilder(builderName: string): Promise<void> {
        try {
            // Check if builder already exists
            const listCommand = ['docker', 'buildx', 'ls'];
            const output = execSync(listCommand.join(' '), { encoding: 'utf8', stdio: 'pipe' });
            
            if (output.includes(builderName)) {
                logDebugInfo(`🐳 🟢 Multi-platform builder '${builderName}' already exists`);
                return;
            }
            
            // Create new multi-platform builder
            logDebugInfo(`🐳 🟡 Creating multi-platform builder '${builderName}'...`);
            const createCommand = [
                'docker', 'buildx', 'create',
                '--name', builderName,
                '--driver', 'docker-container',
                '--platform', 'linux/amd64,linux/arm64'
            ];
            
            execSync(createCommand.join(' '), { stdio: 'inherit' });
            
            // Start the builder
            const startCommand = ['docker', 'buildx', 'inspect', '--bootstrap', builderName];
            execSync(startCommand.join(' '), { stdio: 'inherit' });
            
            logDebugInfo(`🐳 🟢 Multi-platform builder '${builderName}' created and started successfully`);
        } catch (error) {
            logError(`🐳 🔴 Failed to create multi-platform builder: ${error}`);
            throw error;
        }
    }

    /*private async buildSingleArchImage(param: Execution, imageName: string, archType: string): Promise<void> {
        const stream = await this.docker.buildImage({
            context: this.dockerDir,
            src: ['Dockerfile', 'requirements.txt', 'main.py'],
        }, {
            t: imageName,
            dockerfile: 'Dockerfile',
            buildargs: {},
            nocache: false,
            platform: `linux/${archType}`,
        });

        await new Promise((resolve, reject) => {
            this.docker.modem.followProgress(stream, (err: any, res: any) => {
                if (err) reject(err);
                else resolve(res);
            }, (event: any) => {
                if (event.stream) logDebugInfo(`🐳 🟡 ${event.stream.trim()}`);
            });
        });
    }*/

    // ==============================
    // 🧩 Manifest / Registry Handling
    // ==============================

    /*checkImageInRegistry = async (param: Execution): Promise<boolean> => {
        const imageName = this.getImageNameWithTag(param);
        const registryImageName = `ghcr.io/${param.owner}/${imageName}`;
        const archType = this.getArchitectureType();
        const dockerPlatform = `linux/${archType}`;

        try {
            await this.authenticateWithRegistry(param.owner, param.tokens.classicToken);
            const manifestProcess = spawn('docker', ['manifest', 'inspect', registryImageName]);

            const output = await new Promise<string>((resolve) => {
                let data = '';
                manifestProcess.stdout.on('data', (chunk) => data += chunk.toString());
                manifestProcess.on('close', () => resolve(data));
            });

            logDebugInfo(`🐳 🟡 Manifest output: ${output}`);

            if (output.includes(`"${archType}"`)) {
                logDebugInfo(`🐳 🟢 Image already has platform ${dockerPlatform}`);
                return true;
            } else if (output.includes('"architecture"')) {
                logDebugInfo(`🐳 🟡 Image exists but missing ${dockerPlatform}`);
                return false;
            }
            return false;
        } catch {
            logDebugInfo(`🐳 🟡 No manifest found for ${registryImageName}`);
            return false;
        }
    }*/

    /*
    pushImageToRegistry = async (param: Execution, imageName: string): Promise<void> => {
        const buildxAvailable = await this.checkDockerBuildxAvailable();
        
        if (buildxAvailable) {
            // For multi-architecture builds, the image is already pushed during build
            logDebugInfo('🐳 🟢 Multi-architecture image already pushed during build process');
            return;
        }

        // Fallback to single-architecture push for systems without Buildx
        const archType = this.getArchitectureType();
        const dockerPlatform = `linux/${archType}`;
        const registryImageName = `ghcr.io/${param.owner}/${imageName}:latest`;

        await this.authenticateWithRegistry(param.owner, param.tokens.classicToken);

        // Tag + Push architecture-specific image
        execSync(`docker tag ${imageName}:latest ${registryImageName}`, { stdio: 'inherit' });
        execSync(`docker push ${registryImageName}`, { stdio: 'inherit' });

        // Merge with existing manifest if necessary
        try {
            const manifestExists = await this.checkImageInRegistry(param);
            if (manifestExists) {
                logDebugInfo(`🐳 🟡 Amending existing manifest with ${dockerPlatform}...`);
                execSync(`docker manifest create ${registryImageName} --amend ${registryImageName}`, { stdio: 'inherit' });
            } else {
                logDebugInfo(`🐳 🟡 Creating new manifest list for ${dockerPlatform}...`);
                execSync(`docker manifest create ${registryImageName} ${registryImageName}`, { stdio: 'inherit' });
            }

            execSync(`docker manifest push ${registryImageName}`, { stdio: 'inherit' });
            logDebugInfo(`🐳 🟢 Multi-arch manifest updated successfully for ${dockerPlatform}`);
        } catch (err) {
            logError(`🐳 🔴 Manifest merge failed: ${err}`);
        }
    }*/

    private authenticateWithRegistry = async (organizationName: string, token: string): Promise<void> => {
        try {
            logDebugInfo(`🐳 🟡 Authenticating with GitHub Container Registry as ${organizationName}`);
            execSync(`echo ${token} | docker login ghcr.io -u ${organizationName} --password-stdin`, { stdio: 'pipe' });
            logDebugInfo(`🐳 🟢 Authenticated successfully`);
        } catch (error: any) {
            logError(`🐳 🔴 Docker login error: ${error.message}`);
            throw error;
        }
    }

    // ==============================
    // 🧼 Misc Helpers
    // ==============================

    private async getContainer(param: Execution): Promise<Container> {
        const containerId = await this.getContainerIdByName(param);
        const imageName = this.getImageNameWithTag(param);
        if (containerId) return this.docker.getContainer(containerId);
        return this.docker.createContainer({
            Image: imageName,
            ExposedPorts: { [`${param.dockerConfig.getPort()}/tcp`]: {} },
            HostConfig: {
                PortBindings: { [`${param.dockerConfig.getPort()}/tcp`]: [{ HostPort: param.dockerConfig.getPort().toString() }] },
            },
            name: this.getImageName(param),
        });
    }

    private async waitForContainer(param: Execution): Promise<void> {
        const maxAttempts = 30;
        const interval = 2000;
        for (let i = 0; i < maxAttempts; i++) {
            try {
                const res = await axios.get(`http://${param.dockerConfig.getDomain()}:${param.dockerConfig.getPort()}/health`);
                if (res.data.status === 'ready') return;
            } catch {}
            await new Promise(r => setTimeout(r, interval));
        }
        throw new Error('Container did not become ready');
    }

    private async getContainerIdByName(param: Execution): Promise<string> {
        const containers = await this.docker.listContainers({ all: true });
        const found = containers.find(c => c.Names.includes(`/${this.getImageName(param)}`));
        return found?.Id || '';
    }

    async isContainerRunning(param: Execution): Promise<boolean> {
        const containers = await this.docker.listContainers({ all: true });
        const container = containers.find(c => c.Names.includes(`/${this.getImageName(param)}`));
        return container?.State === 'running';
    }

    getEmbedding = async (param: Execution, textInstructionsPairs: [string, string][]): Promise<number[][]> => {
        try {
            const request: EmbedRequest = {
                instructions: textInstructionsPairs.map(pair => pair[0]),
                texts: textInstructionsPairs.map(pair => pair[1])
            };

            const response = await axios.post(`http://${param.dockerConfig.getDomain()}:${param.dockerConfig.getPort()}/embed`, request, {
                headers: {
                    'Content-Type': 'application/json',
                },
                family: 4
            });

            const data = response.data as EmbedResponse;
            return data.embeddings;
        } catch (error) {
            logError(`🐳 🔴 Error getting embedding: ${JSON.stringify(error, null, 2)}`);
            throw error;
        }
    }

    getSystemInfo = async (param: Execution): Promise<any> => {
        const response = await axios.get(`http://${param.dockerConfig.getDomain()}:${param.dockerConfig.getPort()}/system-info`, {
            family: 4
        });
        return response.data;
    }

    stopContainer = async (param: Execution): Promise<void> => {
        logDebugInfo('🐳 🟠 Stopping Docker container...');
        if (!this.isContainerRunning(param)) return;

        const containerId = await this.getContainerIdByName(param);
        if (!containerId) return;

        try {
            const container = this.docker.getContainer(containerId);
            await container.stop();
            await container.remove();
            logDebugInfo('🐳 ⚪ Docker container stopped');
            
            // Clean up dangling images after stopping (only on self-hosted runners)
            if (this.isSelfHostedRunner()) {
                await this.cleanupDanglingImages();
                await this.cleanupBuildxBuilder();
            }
        } catch (error) {
            logError('🐳 🔴 Error stopping container: ' + error);
        }
    }

    private cleanupDanglingImages = async (): Promise<void> => {
        try {
            const images = await this.docker.listImages({ filters: { dangling: ['true'] } });
            if (images.length > 0) {
                logDebugInfo(`🐳 🟡 Found ${images.length} dangling images, cleaning up...`);
                let removedCount = 0;
                for (const image of images) {
                    try {
                        // Force remove to handle different Docker managers (OrbStack, Colima, Docker Desktop)
                        await this.docker.getImage(image.Id).remove({ force: true });
                        removedCount++;
                        logDebugInfo(`🐳 🟡 Removed dangling image: ${image.Id.substring(0, 12)}`);
                    } catch (error) {
                        logDebugError(`Error removing dangling image ${image.Id}: ${error}`);
                    }
                }
                logDebugInfo(`🐳 🟢 Dangling images cleanup completed: ${removedCount}/${images.length} removed`);
            }
        } catch (error) {
            logDebugError('Error cleaning up dangling images: ' + error);
        }
    }

    private cleanupBuildxBuilder = async (): Promise<void> => {
        try {
            const builderName = 'git-board-flow-multiarch';
            const listCommand = ['docker', 'buildx', 'ls'];
            const output = execSync(listCommand.join(' '), { encoding: 'utf8', stdio: 'pipe' });
            
            if (output.includes(builderName)) {
                logDebugInfo(`🐳 🟡 Cleaning up Buildx builder '${builderName}'...`);
                execSync(`docker buildx rm ${builderName}`, { stdio: 'pipe' });
                logDebugInfo(`🐳 🟢 Buildx builder '${builderName}' removed successfully`);
            }
        } catch (error) {
            logDebugError(`Error cleaning up Buildx builder: ${error}`);
        }
    }
}

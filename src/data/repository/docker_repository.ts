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

    startContainer = async (param: Execution): Promise<void> => {
        logDebugInfo('🐳 🟡 Starting Docker container...');
        const isRunning = await this.isContainerRunning(param);
        if (isRunning) {
            logDebugInfo('🐳 🟢 Docker container is ready');
            return;
        }

        try {
            if (this.shouldUsePrebuiltImage()) {
                const imageExists = await this.imageExists(param);
                if (!imageExists) {
                    const pulled = await this.pullPrebuiltImage(param);
                    if (!pulled) throw new Error('Prebuilt image not available');
                }
            } else if (this.shouldUseLocalImage()) {
                const imageExists = await this.imageExists(param);
                if (!imageExists) await this.buildImage(param);
            }

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
        return `${this.getImageName(param)}:latest`;
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
        const imageName = this.getImageNameWithTag(param);
        const archType = this.getArchitectureType();

        logDebugInfo(`🐳 🟡 Building Docker image: ${imageName} for architecture: ${archType}`);

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

        logDebugInfo('🐳 🟢 Docker image built successfully');
    }

    // ==============================
    // 🧩 Manifest / Registry Handling
    // ==============================

    checkImageInRegistry = async (param: Execution): Promise<boolean> => {
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
    }

    pushImageToRegistry = async (param: Execution, imageName: string): Promise<void> => {
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
    }

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
}

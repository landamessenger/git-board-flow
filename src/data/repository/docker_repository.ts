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
        // Self-hosted runners typically have different environment variables
        // or run in persistent environments where Docker images persist
        return process.env.RUNNER_TEMP?.includes('actions-runner') || 
               process.env.GITHUB_RUN_ID === undefined ||
               process.env.GITHUB_HOSTED === 'false';
    }

    private shouldUsePrebuiltImage(): boolean {
        // Use prebuilt image on GitHub-hosted runners
        return this.isGitHubActions() && !this.isSelfHostedRunner();
    }

    private shouldUseLocalImage(): boolean {
        // Use local image on self-hosted runners or local development
        return !this.isGitHubActions() || this.isSelfHostedRunner();
    }

    getArchitectureType(): string {
        const platform = process.platform;
        const arch = process.arch;
        
        // Map Node.js architecture to Docker architecture
        if (platform === 'darwin' && arch === 'arm64') {
            return 'arm64'; // macOS ARM64 (M1/M2)
        } else if (platform === 'darwin' && arch === 'x64') {
            return 'amd64'; // macOS x64
        } else if (platform === 'linux' && arch === 'x64') {
            return 'amd64'; // Linux x64
        } else if (platform === 'linux' && arch === 'arm64') {
            return 'arm64'; // Linux ARM64
        } else if (platform === 'linux' && arch === 'arm') {
            return 'armv7'; // Linux ARM32 (Raspberry Pi)
        } else if (platform === 'win32' && arch === 'x64') {
            return 'amd64'; // Windows x64
        } else {
            // Default to amd64 for unknown architectures
            logDebugInfo(`🐳 🟡 Unknown architecture: ${platform}/${arch}, defaulting to amd64`);
            return 'amd64';
        }
    }

    startContainer = async (param: Execution): Promise<void> => {
        logDebugInfo('🐳 🟡 Starting Docker container...');
        logDebugInfo(`🐳 🟡 Docker directory: ${this.dockerDir}`);

        const isRunning = await this.isContainerRunning(param);
        if (isRunning) {
            logDebugInfo('🐳 🟢 Docker container is ready');
            return;
        }

        try {
            // Different strategies based on environment
            if (this.shouldUsePrebuiltImage()) {
                logDebugInfo('🐳 🟡 GitHub-hosted runner detected, using prebuilt image strategy...');
                
                // Try to pull prebuilt image first
                const imageExists = await this.imageExists(param);
                if (!imageExists) {
                    const pulled = await this.pullPrebuiltImage(param);
                    if (!pulled) {
                        logError('🐳 🔴 Failed to pull prebuilt image. Please ensure image is published to registry.');
                        throw new Error('Prebuilt image not available');
                    }
                } else {
                    logDebugInfo('🐳 🟢 Prebuilt image already exists locally');
                }
                
            } else if (this.shouldUseLocalImage()) {
                logDebugInfo('🐳 🟡 Self-hosted runner detected, using local image strategy...');
                
                // Use local image or build if needed
                const imageExists = await this.imageExists(param);
                if (!imageExists) {
                    logDebugInfo('🐳 🟡 Local image not found, building...');
                    await this.buildImage(param);
                } else {
                    logDebugInfo('🐳 🟢 Local image already exists, skipping build');
                }
            }

            await this.runContainer(param);
            
            // No cache operations needed with new strategy
            logDebugInfo('🐳 🟢 Container started successfully');
        } catch (error) {
            logError('Error starting container: ' + error);
            throw error;
        }
    }

    private runContainer = async (param: Execution): Promise<void> => {
        const container = await this.getContainer(param);
        const containerInfo = await container.inspect();
            
        // If container exists but is not running, start it
        if (containerInfo.State.Status !== 'running') {
            logDebugInfo('🐳 🟡 Starting restored container...');
            await container.start();
        }
        
        // Wait for the container to be ready
        logDebugInfo('🐳 🟡 Waiting for container to be ready...');
        await this.waitForContainer(param);
        logDebugInfo('🐳 🟢 Docker container is ready');
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
            logDebugInfo(`🐳 🟡 Pulling prebuilt image: ${registryImageName}`);
            
            // Try to pull from GitHub Container Registry
            const stream = await this.docker.pull(registryImageName);
            await new Promise((resolve, reject) => {
                this.docker.modem.followProgress(stream, (err: any, res: any) => {
                    if (err) {
                        logError(`🐳 🔴 Error pulling image: ${err}`);
                        reject(err);
                    } else {
                        logDebugInfo('🐳 🟢 Prebuilt image pulled successfully');
                        resolve(res);
                    }
                });
            });
            return true;
        } catch (error) {
            logError(`🐳 🔴 Error pulling prebuilt image: ${error}`);
            return false;
        }
    }

    buildImage = async (param: Execution): Promise<void> => {
        const imageName = this.getImageNameWithTag(param);
        const archType = this.getArchitectureType();
        logDebugInfo(`🐳 🟡 Building Docker image: ${imageName} for architecture: ${archType}`);
        
        // Build the image with explicit tagging and platform
        const stream = await this.docker.buildImage({
            context: this.dockerDir,
            src: ['Dockerfile', 'requirements.txt', 'main.py'],
        }, { 
            t: imageName,
            dockerfile: 'Dockerfile',
            buildargs: {},
            nocache: false, // Enable Docker's built-in cache
            platform: `linux/${archType}` // Specify target platform
        });

        await new Promise((resolve, reject) => {
            this.docker.modem.followProgress(stream, (err: any, res: any) => {
                if (err) {
                    logError('🐳 🔴 Error building image: ' + err);
                    reject(err);
                } else {
                    logDebugInfo('🐳 🟢 Docker image built successfully');
                    resolve(res);
                }
            }, (event: any) => {
                if (event.stream) {
                    logDebugInfo(`🐳 🟡 ${event.stream.trim()}`);
                }
            });
        });

        // Verify that the image exists and is properly tagged
        try {
            const images = await this.docker.listImages();
            const actionImage = images.find(img => 
                img.RepoTags && img.RepoTags.includes(imageName)
            );
            
            if (!actionImage) {
                logError(`🐳 🔴 Image ${imageName} not found after build`);
                throw new Error(`Image ${imageName} not found after build`);
            }
            
            logDebugInfo('🐳 🟢 Image exists and is properly tagged');
        } catch (error) {
            logError('🐳 🔴 Error verifying image: ' + error);
            throw error;
        }
    }

    private getContainer = async (param: Execution): Promise<Container> => {
        const containerId = await this.getContainerIdByName(param);
        const imageName = this.getImageNameWithTag(param);
        if (containerId) {
            logDebugInfo(`🐳 🟡 Container already exists... ${imageName}`);
            return this.docker.getContainer(containerId);
        }
        logDebugInfo(`🐳 🟡 Creating container... ${imageName}`);
        return this.docker.createContainer({
            Image: imageName,
            ExposedPorts: {
                [`${param.dockerConfig.getPort()}/tcp`]: {}
            },
            HostConfig: {
                PortBindings: {
                    [`${param.dockerConfig.getPort()}/tcp`]: [{ HostPort: param.dockerConfig.getPort().toString() }]
                }
            },
            name: this.getImageName(param)
        });
    }

    private waitForContainer = async (param: Execution): Promise<void> => {
        const maxAttempts = 30;
        const interval = 2000; // 2 seconds
        let attempts = 0;

        while (attempts < maxAttempts) {
            try {
                const response = await axios.get(`http://${param.dockerConfig.getDomain()}:${param.dockerConfig.getPort()}/health`, {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    timeout: 10000,
                    family: 4
                });
                
                const data = response.data as HealthCheckResponse;
                logDebugInfo(`🐳 🟡 Health check response: ${JSON.stringify(data)}`);
                
                if (data.status === 'ready') {
                    logDebugInfo('🐳 🟢 Container is ready and model is loaded');
                    return;
                } else if (data.status === 'error') {
                    logDebugInfo(`🐳 🔴 Model failed to load: ${data.message}`);
                    throw new Error(`Model failed to load: ${data.message}`);
                } else {
                    logDebugInfo(`🐳 🟡 Model status: ${data.status}, Progress: ${data.progress}%, Message: ${data.message}`);
                }
            } catch (error: any) {
                logDebugInfo(`🐳 🔴 Health check error: ${error?.message || String(error)}`);
            }
            logDebugInfo(`🐳 🟡 Waiting ${interval/1000} seconds before next attempt...`);
            await new Promise(resolve => setTimeout(resolve, interval));
            attempts++;
        }

        throw new Error(`🐳 🔴 Container did not become ready after ${maxAttempts} attempts (${(maxAttempts * interval)/1000} seconds)`);
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

    isContainerRunning = async (param: Execution): Promise<boolean> => {
        try {
            const containers = await this.docker.listContainers({ all: true });
            const container = containers.find(container => 
                container.Names.some(name => name === `/${this.getImageName(param)}`)
            );
            return container?.State === 'running' || false;
        } catch (error) {
            logDebugError('Error checking container status: ' + error);
            return false;
        }
    }

    getContainerIdByName = async (param: Execution): Promise<string> => {
        try {
            const containers = await this.docker.listContainers({ all: true });
            const container = containers.find(container => 
                container.Names.some(name => name === `/${this.getImageName(param)}`)
            );
            return container?.Id || '';
        } catch (error) {
            logDebugError('Error checking container status: ' + error);
            return '';
        }
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

    /**
     * Clean up manually all dangling images from the Docker system.
     * Useful to free space in different managers (OrbStack, Colima, Docker Desktop).
     */
    cleanupAllDanglingImages = async (): Promise<void> => {
        logDebugInfo('🐳 🟡 Starting manual cleanup of all dangling images...');
        await this.cleanupDanglingImages();
    }

    /**
     * Check if an image exists in the registry by attempting to pull it
     */
    checkImageInRegistry = async (param: Execution): Promise<boolean> => {
        try {
            const imageName = this.getImageNameWithTag(param);
            logDebugInfo(`🐳 🟡 Checking if image exists in registry: ${imageName}`);
            
            // Authenticate first before checking
            await this.authenticateWithRegistry(param.owner, param.tokens.classicToken);
            
            // Use direct docker pull command with real-time output
            const registryImageName = `ghcr.io/${param.owner}/${imageName}`;
            const pullCommand = `docker pull ${registryImageName}`;
            logDebugInfo(`🐳 🟡 Executing pull command: ${pullCommand}`);
            
            try {
                // Use spawn with platform-specific pull to check if image exists for current architecture
                const archType = this.getArchitectureType();
                const dockerPlatform = `linux/${archType}`;
                
                const pullProcess = spawn('docker', ['pull', '--platform', dockerPlatform, registryImageName], {
                    stdio: 'pipe' // Capture output to check for architecture errors
                });
                
                const exists = await new Promise<boolean>((resolve, reject) => {
                    let output = '';
                    let errorOutput = '';
                    
                    pullProcess.stdout?.on('data', (data) => {
                        output += data.toString();
                    });
                    
                    pullProcess.stderr?.on('data', (data) => {
                        errorOutput += data.toString();
                    });
                    
                    pullProcess.on('close', (code: number) => {
                        if (code === 0) {
                            logDebugInfo(`🐳 🟢 Image found in registry for ${dockerPlatform}: ${registryImageName}`);
                            resolve(true);
                        } else {
                            // Check if it's an architecture mismatch error
                            if (errorOutput.includes('no matching manifest') || errorOutput.includes('not found')) {
                                logDebugInfo(`🐳 🟡 Image not found in registry for ${dockerPlatform}: ${registryImageName}`);
                                resolve(false);
                            } else {
                                logDebugInfo(`🐳 🟡 Image pull failed (exit code: ${code}): ${errorOutput}`);
                                resolve(false);
                            }
                        }
                    });
                    
                    pullProcess.on('error', (error: Error) => {
                        logDebugInfo(`🐳 🟡 Image not found in registry: ${error.message}`);
                        resolve(false);
                    });
                });
                
                return exists;
            } catch (error: any) {
                logDebugInfo(`🐳 🟡 Image not found in registry: ${error.message}`);
                return false;
            }
        } catch (error) {
            logDebugInfo(`🐳 🟡 Image not found in registry: ${error}`);
            return false;
        }
    }

    cleanupIncompleteLayers = async (imageName: string): Promise<void> => {
        try {
            logDebugInfo(`🐳 🟡 Cleaning up incomplete layers for: ${imageName}`);
            
            // Remove the local image to force a clean rebuild
            /*
            try {
                const image = this.docker.getImage(imageName);
                await image.remove({ force: true });
                logDebugInfo(`🐳 🟡 Removed local image: ${imageName}`);
            } catch (error) {
                logDebugInfo(`🐳 🟡 Local image not found or already removed: ${imageName}`);
            }
            
            // Also try to remove the image without ghcr.io prefix
            const registryImageName = `ghcr.io/${imageName}`;
            try {
                const localImage = this.docker.getImage(registryImageName);
                await localImage.remove({ force: true });
                logDebugInfo(`🐳 🟡 Removed local image: ${registryImageName}`);
            } catch (error) {
                logDebugInfo(`🐳 🟡 Local image not found or already removed: ${registryImageName}`);
            }*/
            
            // Clean up any dangling images
            await this.cleanupDanglingImages();
            
        } catch (error) {
            logDebugInfo(`🐳 🟡 Error cleaning up incomplete layers: ${error}`);
        }
    }

    /**
     * Authenticate with GitHub Container Registry
     */
    private authenticateWithRegistry = async (organizationName: string, token: string): Promise<void> => {
        try {
            logDebugInfo(`🐳 🟡 Authenticating with GitHub Container Registry as ${organizationName}`);
            
            // Execute docker login command and capture output
            const loginCommand = `echo ${token} | docker login ghcr.io -u ${organizationName} --password-stdin`;
            try {
                const output = execSync(loginCommand, { 
                    stdio: 'pipe',
                    encoding: 'utf8'
                });
                logDebugInfo(`🐳 🟡 Docker login output: ${output}`);
                logDebugInfo(`🐳 🟢 Successfully authenticated with GitHub Container Registry`);
            } catch (error: any) {
                logError(`🐳 🔴 Docker login error: ${error.message}`);
                if (error.stderr) {
                    logError(`🐳 🔴 Docker login stderr: ${error.stderr}`);
                }
                if (error.stdout) {
                    logDebugInfo(`🐳 🟡 Docker login stdout: ${error.stdout}`);
                }
                throw error;
            }
        } catch (error) {
            logError(`🐳 🔴 Error authenticating with registry: ${error}`);
            throw error;
        }
    }

    /**
     * Push an image to the registry
     */
    pushImageToRegistry = async (param: Execution, imageName: string): Promise<void> => {
        try {
            logDebugInfo(`🐳 🟡 Pushing image to registry: ${imageName}`);
            
            // Authenticate with registry first
            await this.authenticateWithRegistry(param.owner, param.tokens.classicToken);
            
            // Tag the image with the full registry name
            const registryImageName = `ghcr.io/${param.owner}/${imageName}`;
            const image = this.docker.getImage(imageName);
            await image.tag({ repo: registryImageName, tag: 'latest' });
            
            logDebugInfo(`🐳 🟡 Tagged image as: ${registryImageName}`);
            
            // Push to registry using direct command with real-time progress and retry
            const pushCommand = `docker push ${registryImageName}`;
            logDebugInfo(`🐳 🟡 Executing push command: ${pushCommand}`);
            
            const { spawn } = require('child_process');
            const pushProcess = spawn('docker', [
                'push',
                '--disable-content-trust',
                registryImageName,
            ], {
                stdio: 'inherit',
                env: {
                    ...process.env,
                    DOCKER_BUILDKIT: '0',
                    DOCKER_CLI_EXPERIMENTAL: 'enabled',
                }
            });
            
            const timeoutId = setTimeout(() => {
                pushProcess.kill('SIGTERM');
                logError(`🐳 🔴 Push timeout after 120 minutes`);
            }, 7200000); // 120 minutes
            
            await new Promise((resolve, reject) => {
                pushProcess.on('close', (code: number) => {
                    clearTimeout(timeoutId);
                    if (code === 0) {
                        logDebugInfo(`🐳 🟢 Image pushed successfully: ${registryImageName}`);
                        resolve(code);
                    } else {
                        logError(`🐳 🔴 Docker push failed with exit code ${code}`);
                        reject(new Error(`Docker push failed with exit code ${code}`));
                    }
                });
                
                pushProcess.on('error', (error: Error) => {
                    clearTimeout(timeoutId);
                    reject(error);
                });
            });
        } catch (error) {
            logError(`🐳 🔴 Error pushing image to registry: ${error}`);
            throw error;
        }
    }
}
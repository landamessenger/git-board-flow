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

    private imageExists = async (param: Execution): Promise<boolean> => {
        const images = await this.docker.listImages();
        return images.some(img => 
            img.RepoTags && img.RepoTags.includes(`${param.dockerConfig.getContainerName()}:latest`)
        );
    }

    private pullPrebuiltImage = async (param: Execution): Promise<boolean> => {
        try {
            const imageName = `${param.dockerConfig.getContainerName()}:latest`;
            logDebugInfo(`🐳 🟡 Pulling prebuilt image: ${imageName}`);
            
            // Try to pull from Docker Hub or GitHub Container Registry
            const stream = await this.docker.pull(imageName);
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

    buildImage = async (param: Execution, imageName?: string): Promise<void> => {
        const finalImageName = imageName || `${param.dockerConfig.getContainerName()}:latest`;
        const archType = this.getArchitectureType();
        logDebugInfo(`🐳 🟡 Building Docker image: ${finalImageName} for architecture: ${archType}`);
        
        // Build the image with explicit tagging and platform
        const stream = await this.docker.buildImage({
            context: this.dockerDir,
            src: ['Dockerfile', 'requirements.txt', 'main.py'],
        }, { 
            t: finalImageName,
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
                img.RepoTags && img.RepoTags.includes(finalImageName)
            );
            
            if (!actionImage) {
                logError(`🐳 🔴 Image ${finalImageName} not found after build`);
                throw new Error(`Image ${finalImageName} not found after build`);
            }
            
            logDebugInfo('🐳 🟢 Image exists and is properly tagged');
        } catch (error) {
            logError('🐳 🔴 Error verifying image: ' + error);
            throw error;
        }
    }

    private getContainer = async (param: Execution): Promise<Container> => {
        const containerId = await this.getContainerIdByName(param);
        if (containerId) {
            logDebugInfo(`🐳 🟡 Container already exists... ${param.dockerConfig.getContainerName()}:${param.dockerConfig.getPort()}`);
            return this.docker.getContainer(containerId);
        }
        logDebugInfo(`🐳 🟡 Creating container... ${param.dockerConfig.getContainerName()}:${param.dockerConfig.getPort()}`);
        return this.docker.createContainer({
            Image: `${param.dockerConfig.getContainerName()}:latest`,
            ExposedPorts: {
                [`${param.dockerConfig.getPort()}/tcp`]: {}
            },
            HostConfig: {
                PortBindings: {
                    [`${param.dockerConfig.getPort()}/tcp`]: [{ HostPort: param.dockerConfig.getPort().toString() }]
                }
            },
            name: param.dockerConfig.getContainerName()
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
                container.Names.some(name => name === `/${param.dockerConfig.getContainerName()}`)
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
                container.Names.some(name => name === `/${param.dockerConfig.getContainerName()}`)
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
    checkImageInRegistry = async (organizationName: string, imageName: string, token: string): Promise<boolean> => {
        try {
            logDebugInfo(`🐳 🟡 Checking if image exists in registry: ${imageName}`);
            
            // Authenticate first before checking
            await this.authenticateWithRegistry(organizationName, token);
            
            // Use direct docker pull command with real-time output
            const registryImageName = `ghcr.io/${imageName}`;
            const pullCommand = `docker pull ${registryImageName}`;
            logDebugInfo(`🐳 🟡 Executing pull command: ${pullCommand}`);
            
            try {
                // Use spawn instead of execSync for real-time output
                const pullProcess = spawn('docker', ['pull', registryImageName], {
                    stdio: 'inherit' // This will show real-time output
                });
                
                const exists = await new Promise<boolean>((resolve, reject) => {
                    pullProcess.on('close', (code: number) => {
                        if (code === 0) {
                            logDebugInfo(`🐳 🟢 Image found in registry: ${registryImageName}`);
                            resolve(true);
                        } else {
                            logDebugInfo(`🐳 🟡 Image not found in registry (exit code: ${code})`);
                            resolve(false);
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
            const registryImageName = `ghcr.io/${imageName}`;
            const image = this.docker.getImage(imageName);
            await image.tag({ repo: registryImageName, tag: 'latest' });
            
            logDebugInfo(`🐳 🟡 Tagged image as: ${registryImageName}`);
            
            // Push to registry using direct command with real-time progress and retry
            const pushCommand = `docker push ${registryImageName}`;
            logDebugInfo(`🐳 🟡 Executing push command: ${pushCommand}`);
            
            const maxRetries = 10;
            let retryCount = 0;
            
            while (retryCount < maxRetries) {
                try {
                    // Use spawn instead of execSync for real-time output with longer timeout
                    const { spawn } = require('child_process');
                    const pushProcess = spawn('docker', ['push', registryImageName], {
                        stdio: 'inherit' // This will show real-time output
                    });
                    
                    // Set a longer timeout for large images
                    const timeoutId = setTimeout(() => {
                        pushProcess.kill('SIGTERM');
                        logError(`🐳 🔴 Push timeout after 100 minutes`);
                    }, 1800000); // 30 minutes
                    
                    await new Promise((resolve, reject) => {
                        pushProcess.on('close', (code: number) => {
                            clearTimeout(timeoutId);
                            if (code === 0) {
                                logDebugInfo(`🐳 🟢 Image pushed successfully: ${registryImageName}`);
                                resolve(code);
                            } else {
                                reject(new Error(`Docker push failed with exit code ${code}`));
                            }
                        });
                        
                        pushProcess.on('error', (error: Error) => {
                            clearTimeout(timeoutId);
                            reject(error);
                        });
                    });
                    
                    // If we get here, push was successful
                    break;
                    
                } catch (error: any) {
                    retryCount++;
                    logError(`🐳 🔴 Docker push attempt ${retryCount} failed: ${error.message}`);
                    
                    if (retryCount < maxRetries) {
                        const waitTime = retryCount * 30; // 30, 60, 90 seconds
                        logDebugInfo(`🐳 🟡 Retrying push in ${waitTime} seconds... (attempt ${retryCount + 1}/${maxRetries})`);
                        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
                        
                        // Re-authenticate before retry
                        logDebugInfo(`🐳 🟡 Re-authenticating before retry...`);
                        await this.authenticateWithRegistry(param.owner, param.tokens.classicToken);
                    } else {
                        logError(`🐳 🔴 Docker push failed after ${maxRetries} attempts`);
                        throw error;
                    }
                }
            }
        } catch (error) {
            logError(`🐳 🔴 Error pushing image to registry: ${error}`);
            throw error;
        }
    }
}
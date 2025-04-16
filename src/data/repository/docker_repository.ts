import Docker from 'dockerode';
import path from 'path';
import axios from 'axios';
import { logDebugError, logDebugInfo, logError } from '../../utils/logger';
import { Execution } from '../model/execution';

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

    startContainer = async (param: Execution): Promise<void> => {
        logDebugInfo('🐳 🟡 Starting Docker container...');

        const isRunning = await this.isContainerRunning(param);
        if (isRunning) {
            logDebugInfo('🐳 🟢 Docker container is ready');
            return;
        }

        try {
            // Check if image exists
            const images = await this.docker.listImages();
            const imageExists = images.some(img => 
                img.RepoTags && img.RepoTags.includes(`${param.dockerConfig.getContainerName()}:latest`)
            );

            if (!imageExists) {
                logDebugInfo('🐳 🟡 Building Docker image...');
                // Build the image with explicit tagging
                const stream = await this.docker.buildImage({
                    context: this.dockerDir,
                    src: ['Dockerfile', 'requirements.txt', 'main.py'],
                }, { 
                    t: `${param.dockerConfig.getContainerName()}:latest`,
                    dockerfile: 'Dockerfile',
                    buildargs: {},
                    nocache: true
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

                // logDebugInfo('🐳 🟡 Image build result: ' + JSON.stringify(result, null, 2));

                // Verify that the image exists and is properly tagged
                try {
                    const images = await this.docker.listImages();
                    logDebugInfo('🐳 🟡 Images: ' + JSON.stringify(images, null, 2));
                    const actionImage = images.find(img => 
                        img.RepoTags && img.RepoTags.includes(`${param.dockerConfig.getContainerName()}:latest`)
                    );
                    
                    if (!actionImage) {
                        logError(`🐳 🔴 Image ${param.dockerConfig.getContainerName()}:latest not found after build`);
                        throw new Error(`Image ${param.dockerConfig.getContainerName()}:latest not found after build`);
                    }
                    
                    logDebugInfo('🐳 🟢 Image exists and is properly tagged');
                } catch (error) {
                    logError('🐳 🔴 Error verifying image: ' + error);
                    throw error;
                }
            } else {
                logDebugInfo('🐳 🟢 Image already exists, skipping build');
            }

            logDebugInfo(`🐳 🟡 Creating container... ${param.dockerConfig.getContainerName()}:${param.dockerConfig.getPort()}`);
            // Create and start the container
            const container = await this.docker.createContainer({
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

            logDebugInfo('🐳 🟡 Starting container...');
            await container.start();
            logDebugInfo('🐳 🟡 Container started successfully');

            // Wait for the container to be ready
            logDebugInfo('🐳 🟡 Waiting for container to be ready...');
            await this.waitForContainer(param);
            logDebugInfo('🐳 🟢 Docker container is ready');
        } catch (error) {
            logError('Error starting container: ' + error);
            throw error;
        }
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
        } catch (error) {
            logError('🐳 🔴 Error stopping container: ' + error);
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
                container.Names.some(name => name === param.dockerConfig.getContainerName())
            );
            return container?.Id || '';
        } catch (error) {
            logDebugError('Error checking container status: ' + error);
            return '';
        }
    }

    getEmbedding = async (param: Execution, textInstructionsPairs: [string, string][]): Promise<number[][]> => {
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
    }

    getSystemInfo = async (param: Execution): Promise<any> => {
        const response = await axios.get(`http://${param.dockerConfig.getDomain()}:${param.dockerConfig.getPort()}/system-info`, {
            family: 4
        });
        return response.data;
    }
}
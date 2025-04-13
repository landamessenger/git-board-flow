import Docker from 'dockerode';
import path from 'path';
import { logDebugError, logDebugInfo, logError } from '../../utils/logger';

interface EmbedRequest {
    instructions: string[];
    texts: string[];
}

interface EmbedResponse {
    embeddings: number[][];
}

export class DockerRepository {
    private static instance: DockerRepository | null = null;
    private static containerId: string | null = null;
    private docker: Docker;
    private readonly dockerDir: string;

    private constructor() {
        // const dockerHost = process.env.DOCKER_HOST;
        // if (dockerHost) {
           // this.docker = new Docker({ socketPath: dockerHost.replace('unix://', '') });
        // } else {
            this.docker = new Docker();
        // }
        this.dockerDir = path.join(process.cwd(), 'docker');
    }

    public static getInstance(): DockerRepository {
        if (!DockerRepository.instance) {
            DockerRepository.instance = new DockerRepository();
        }
        return DockerRepository.instance;
    }

    startContainer = async (): Promise<void> => {
        logDebugInfo('🐳 🟡 Starting Docker container...');

        if (DockerRepository.containerId) {
            const isRunning = await this.isContainerRunning();
            if (isRunning) {
                logDebugInfo('🐳 🟢 Docker container is ready');
                return;
            }
        }

        try {
            logDebugInfo('🐳 🟡 Building Docker image...');
            // Build the image with explicit tagging
            const stream = await this.docker.buildImage({
                context: this.dockerDir,
                src: ['Dockerfile', 'requirements.txt', 'main.py'],
            }, { 
                t: 'fastapi-app:latest',
                cpusetcpus: 4,
                memory: 16384,
                memswap: 16384,
                dockerfile: 'Dockerfile',
                buildargs: {},
                nocache: true
            });

            const result = await new Promise((resolve, reject) => {
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

            logDebugInfo('🐳 🟡 Image build result: ' + JSON.stringify(result, null, 2));

            // Verify that the image exists and is properly tagged
            try {
                const images = await this.docker.listImages();
                logDebugInfo('🐳 🟡 Images: ' + JSON.stringify(images, null, 2));
                const fastapiImage = images.find(img => 
                    img.RepoTags && img.RepoTags.includes('fastapi-app:latest')
                );
                
                if (!fastapiImage) {
                    logError('🐳 🔴 Image fastapi-app:latest not found after build');
                    throw new Error('Image fastapi-app:latest not found after build');
                }
                
                logDebugInfo('🐳 🟢 Image exists and is properly tagged');
            } catch (error) {
                logError('🐳 🔴 Error verifying image: ' + error);
                throw error;
            }

            logDebugInfo('🐳 🟡 Creating container...');
            // Create and start the container
            const container = await this.docker.createContainer({
                Image: 'fastapi-app:latest',
                ExposedPorts: {
                    '8000/tcp': {}
                },
                HostConfig: {
                    PortBindings: {
                        '8000/tcp': [{ HostPort: '8000' }]
                    }
                },
                name: 'fastapi-app'
            });

            logDebugInfo('🐳 🟡 Starting container...');
            await container.start();
            DockerRepository.containerId = container.id;
            logDebugInfo('🐳 🟡 Container started successfully');

            // Wait for the container to be ready
            logDebugInfo('🐳 🟡 Waiting for container to be ready...');
            await this.waitForContainer();
            logDebugInfo('🐳 🟢 Docker container is ready');
        } catch (error) {
            logError('Error starting container: ' + error);
            throw error;
        }
    }

    private waitForContainer = async (): Promise<void> => {
        const maxAttempts = 200;
        const delay = 5000;

        for (let i = 0; i < maxAttempts; i++) {
            try {
                logDebugInfo(`Health check attempt ${i + 1}/${maxAttempts}`);
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 10000);
                
                const response = await fetch('http://localhost:8000/health', {
                    signal: controller.signal
                });
                clearTimeout(timeout);
                
                if (response.ok) {
                    const data = await response.json();
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
                } else {
                    logDebugInfo(`🐳 🔴 Health check failed with status: ${response.status}`);
                }
            } catch (error: any) {
                logDebugInfo(`🐳 🔴 Health check error: ${error?.message || String(error)}`);
                if (error?.code === 'ECONNREFUSED') {
                    logDebugInfo('🐳 🔴 Connection refused - container might still be starting up');
                }
            }
            logDebugInfo(`🐳 🟡 Waiting ${delay/1000} seconds before next attempt...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        throw new Error(`🐳 🔴 Container did not become ready after ${maxAttempts} attempts (${(maxAttempts * delay)/1000} seconds)`);
    }

    stopContainer = async (): Promise<void> => {
        logDebugInfo('🐳 🟠 Stopping Docker container...');
        if (!DockerRepository.containerId) return;

        try {
            const container = this.docker.getContainer(DockerRepository.containerId);
            await container.stop();
            await container.remove();
            DockerRepository.containerId = null;
            logDebugInfo('🐳 ⚪ Docker container stopped');
        } catch (error) {
            logError('🐳 🔴 Error stopping container: ' + error);
        }
    }

    isContainerRunning = async (): Promise<boolean> => {
        if (!DockerRepository.containerId) return false;

        try {
            const container = this.docker.getContainer(DockerRepository.containerId);
            const info = await container.inspect();
            return info.State.Running;
        } catch (error) {
            return false;
        }
    }

    getEmbedding = async (textInstructionsPairs: [string, string][]): Promise<number[][]> => {
        try {
            const request: EmbedRequest = {
                instructions: textInstructionsPairs.map(pair => pair[0]),
                texts: textInstructionsPairs.map(pair => pair[1])
            };

            const response = await fetch('http://localhost:8000/embed', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data: EmbedResponse = await response.json();
            logDebugInfo(`🐳 🟡 Embedding: ${JSON.stringify(data)}`);
            return data.embeddings;
        } catch (error) {
            logError('Error getting embedding: ' + error);
            throw error;
        }
    }

    // Example 1: Embedding for semantic search
    // const vector1 = await getEmbedding(
    //     "Represent the following text for semantic search",
    //     "Implement a new feature for user authentication"
    // );

    // Example 2: Embedding for classification
    // const vector2 = await getEmbedding(
    //     "Classify the following text into a category",
    //     "Fix the login button not working on mobile devices"
    // );
}
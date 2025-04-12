import Docker from 'dockerode';
import path from 'path';
import { logDebugInfo, logError, logInfo } from '../../utils/logger';

interface EmbedRequest {
    instruction: string;
    text: string;
}

interface EmbedResponse {
    vector: number[];
}

export class DockerRepository {
    private static instance: DockerRepository | null = null;
    private static containerId: string | null = null;
    private docker: Docker;
    private readonly dockerDir: string;

    private constructor() {
        this.docker = new Docker();
        this.dockerDir = path.join(process.cwd(), 'docker');
    }

    public static getInstance(): DockerRepository {
        if (!DockerRepository.instance) {
            DockerRepository.instance = new DockerRepository();
        }
        return DockerRepository.instance;
    }

    startContainer = async (): Promise<void> => {
        if (DockerRepository.containerId) {
            const isRunning = await this.isContainerRunning();
            if (isRunning) {
                logDebugInfo('Container is already running');
                return;
            }
        }

        try {
            logDebugInfo('Building Docker image...');
            // Build the image
            const stream = await this.docker.buildImage({
                context: this.dockerDir,
                src: ['Dockerfile', 'requirements.txt', 'main.py']
            }, { t: 'fastapi-app' });

            await new Promise((resolve, reject) => {
                this.docker.modem.followProgress(stream, (err: any, res: any) => {
                    if (err) {
                        logError('Error building image: ' + err);
                        reject(err);
                    } else {
                        logDebugInfo('Docker image built successfully');
                        resolve(res);
                    }
                }, (event: any) => {
                    if (event.stream) {
                        logDebugInfo(event.stream.trim());
                    }
                });
            });

            logDebugInfo('Creating container...');
            // Create and start the container
            const container = await this.docker.createContainer({
                Image: 'fastapi-app',
                ExposedPorts: {
                    '8000/tcp': {}
                },
                HostConfig: {
                    PortBindings: {
                        '8000/tcp': [{ HostPort: '8000' }]
                    }
                }
            });

            logDebugInfo('Starting container...');
            await container.start();
            DockerRepository.containerId = container.id;
            logDebugInfo('Container started successfully');

            // Wait for the container to be ready
            logDebugInfo('Waiting for container to be ready...');
            await this.waitForContainer();
            logDebugInfo('Container is ready');
        } catch (error) {
            logError('Error starting container: ' + error);
            throw error;
        }
    }

    private waitForContainer = async (): Promise<void> => {
        const maxAttempts = 100;
        const delay = 3000; // 3 seconds

        for (let i = 0; i < maxAttempts; i++) {
            try {
                const response = await fetch('http://localhost:8000/health');
                logDebugInfo(`Health check response: ${response}`);
                if (response.ok) {
                    return;
                }
            } catch (error) {
                // Ignore connection errors
            }
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        throw new Error('Container did not become ready in time');
    }

    stopContainer = async (): Promise<void> => {
        if (!DockerRepository.containerId) return;

        try {
            const container = this.docker.getContainer(DockerRepository.containerId);
            await container.stop();
            await container.remove();
            DockerRepository.containerId = null;
        } catch (error) {
            logError('Error stopping container: ' + error);
            throw error;
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

    getEmbedding = async (instruction: string, text: string): Promise<number[]> => {
        try {
            const request: EmbedRequest = {
                instruction,
                text
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
            return data.vector;
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
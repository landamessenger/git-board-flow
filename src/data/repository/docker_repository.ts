import Docker from 'dockerode';
import path from 'path';
import { logDebugInfo, logError } from '../../utils/logger';

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

    async startContainer(): Promise<void> {
        if (DockerRepository.containerId) {
            const isRunning = await this.isContainerRunning();
            if (isRunning) {
                logDebugInfo('Container is already running');
                return;
            }
        }

        try {
            // Build the image
            const stream = await this.docker.buildImage({
                context: this.dockerDir,
                src: ['Dockerfile', 'requirements.txt', 'main.py']
            }, { t: 'fastapi-app' });

            await new Promise((resolve, reject) => {
                this.docker.modem.followProgress(stream, (err: any, res: any) => {
                    if (err) reject(err);
                    else resolve(res);
                });
            });

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

            await container.start();
            DockerRepository.containerId = container.id;

            // Wait for the container to be ready
            await this.waitForContainer();
        } catch (error) {
            logError('Error starting container: ' + error);
            throw error;
        }
    }

    private async waitForContainer(): Promise<void> {
        const maxAttempts = 10;
        const delay = 2000; // 2 seconds

        for (let i = 0; i < maxAttempts; i++) {
            try {
                const response = await fetch('http://localhost:8000/health');
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

    async stopContainer(): Promise<void> {
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

    async isContainerRunning(): Promise<boolean> {
        if (!DockerRepository.containerId) return false;

        try {
            const container = this.docker.getContainer(DockerRepository.containerId);
            const info = await container.inspect();
            return info.State.Running;
        } catch (error) {
            return false;
        }
    }
}
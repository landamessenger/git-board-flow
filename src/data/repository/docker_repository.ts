import Docker, { Container } from 'dockerode';
import path from 'path';
import axios from 'axios';
import { logDebugError, logDebugInfo, logError } from '../../utils/logger';
import { Execution } from '../model/execution';
import { CACHE_KEYS } from '../../utils/constants';
import { CacheRepository } from './cache_repository';
import fs from 'fs';
import * as os from 'os';

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
    private cacheRepository = new CacheRepository();

    constructor() {
        this.docker = new Docker();
        this.dockerDir = path.join(process.cwd(), 'docker');
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
            // Try to restore from cache first
            const restored = await this.restoreContainerState(param);
            if (restored) {
                return;
            }

            // If no cache or restore failed, build and start new container
            const imageExists = await this.imageExists(param);
            if (!imageExists) {
                await this.buildImage(param);
            } else {
                logDebugInfo('🐳 🟢 Image already exists, skipping build');
            }

            await this.runContainer(param);
            await this.saveContainerState(param);
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

    private buildImage = async (param: Execution): Promise<void> => {
        logDebugInfo('🐳 🟡 Building Docker image...');
        // Build the image with explicit tagging
        const stream = await this.docker.buildImage({
            context: this.dockerDir,
            src: ['Dockerfile', 'requirements.txt', 'main.py'],
        }, { 
            t: `${param.dockerConfig.getContainerName()}:latest`,
            dockerfile: 'Dockerfile',
            buildargs: {},
            nocache: false // Enable Docker's built-in cache
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
            // Save container state before stopping
            await this.saveContainerState(param);
            
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

    private commitContainer = async (containerId: string, param: Execution): Promise<void> => {
        try {
            const container = this.docker.getContainer(containerId);
            await container.commit({
                repo: param.dockerConfig.getContainerName(),
                tag: 'cached'
            });
            logDebugInfo('🐳 🟢 Container state committed successfully');
        } catch (error) {
            logError('Error committing container: ' + error);
            throw error;
        }
    }

    private saveContainerState = async (param: Execution): Promise<void> => {
        try {
            const containerId = await this.getContainerIdByName(param);
            if (!containerId) {
                logDebugInfo('🐳 🟡 No container to save');
                return;
            }

            // Save the container state as an image
            await this.commitContainer(containerId, param);

            // Save the Docker images to cache
            const images = await this.docker.listImages();
            const image = images.find(img => 
                img.RepoTags && img.RepoTags.includes(`${param.dockerConfig.getContainerName()}:cached`)
            );

            
            if (!image) {
                logDebugInfo('🐳 🟡 No image to save');
                return;
            }

            // Save the image to a tar file
            const imageStream = await this.docker.getImage(`${param.dockerConfig.getContainerName()}:cached`).get();
            const tarPath = path.join(this.dockerDir, 'cached_image.tar');
            const writeStream = fs.createWriteStream(tarPath);
            
            await new Promise<void>((resolve, reject) => {
                imageStream.pipe(writeStream);
                writeStream.on('finish', () => resolve());
                writeStream.on('error', reject);
            });

            // Save the tar file to cache
            const cachedContainer = await this.cacheRepository.saveCache(CACHE_KEYS.DOCKER_VECTOR, [tarPath]);
            if (cachedContainer) {
                logDebugInfo('🐳 🟢 Container state saved to cache');
            }

            // Clean up the tar file
            fs.unlinkSync(tarPath);
        } catch (error) {
            logError('Error saving container state: ' + error);
        }
    }

    private restoreContainerState = async (param: Execution): Promise<boolean> => {
        try {
            const tarPath = path.join(this.dockerDir, 'cached_image.tar');
            const cachedContainer = await this.cacheRepository.restoreCache(CACHE_KEYS.DOCKER_VECTOR, [tarPath]);
            if (!cachedContainer) {
                logDebugInfo('🐳 🟡 No cached container state found');
                return false;
            }

            if (!fs.existsSync(tarPath)) {
                logDebugInfo('🐳 🟡 No cached image tar file found');
                return false;
            }

            // Load the image from the tar file
            const readStream = fs.createReadStream(tarPath);
            await this.docker.loadImage(readStream);
            logDebugInfo('🐳 🟢 Cached image loaded successfully');

            // Clean up the tar file
            fs.unlinkSync(tarPath);

            // Create and start container from cached image
            const container = await this.docker.createContainer({
                Image: `${param.dockerConfig.getContainerName()}:cached`,
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

            await container.start();
            logDebugInfo('🐳 🟢 Container restored from cache');
            return true;
        } catch (error) {
            logError('Error restoring container state: ' + error);
            return false;
        }
    }

    /**
     * Valida si el sistema operativo y arquitectura actuales coinciden
     * con los esperados. Devuelve un string formateado si coinciden, o undefined si no.
     *
     * @param expectedOs Ejemplo: "ubuntu-latest", "macos-latest", "windows-latest"
     * @param expectedArch Ejemplo: "amd64", "arm64"
     * @returns string (clave para la caché) o undefined si no coincide
     */
    private machineCachable = (param: Execution): string | undefined => {
        const platformMap: Record<string, string> = {
            'ubuntu': 'linux',
            'macos': 'darwin',
            'windows': 'win32',
        };

        const archMap: Record<string, string> = {
            'amd64': 'x64',
            'arm64': 'arm64',
            'arm/v7': 'arm',
            '386': 'ia32',
            's390x': 's390x',
            'ppc64le': 'ppc64',
        };

        const expectedNodePlatform = Object.entries(platformMap).find(([prefix]) => 
            param.dockerConfig.getCacheOs().includes(prefix)
        )?.[1];
        const expectedNodeArch = archMap[param.dockerConfig.getCacheArch()];

        if (!expectedNodePlatform || !expectedNodeArch) {
            return undefined; // no es una combinación reconocida
        }

        const currentPlatform = os.platform(); // ej: 'linux', 'darwin', 'win32'
        const currentArch = os.arch();         // ej: 'x64', 'arm64', 'arm'

        const matches =
            currentPlatform === expectedNodePlatform &&
            currentArch === expectedNodeArch;

        return matches ? `${param.dockerConfig.getCacheOs()}-${param.dockerConfig.getCacheArch()}` : undefined;
    }
}
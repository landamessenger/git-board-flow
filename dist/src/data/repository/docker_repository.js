"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DockerRepository = void 0;
const dockerode_1 = __importDefault(require("dockerode"));
const path_1 = __importDefault(require("path"));
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../../utils/logger");
class DockerRepository {
    constructor() {
        this.startContainer = async (param) => {
            (0, logger_1.logDebugInfo)('🐳 🟡 Starting Docker container...');
            const isRunning = await this.isContainerRunning(param);
            if (isRunning) {
                (0, logger_1.logDebugInfo)('🐳 🟢 Docker container is ready');
                return;
            }
            try {
                // Check if image exists
                const images = await this.docker.listImages();
                const imageExists = images.some(img => img.RepoTags && img.RepoTags.includes(`${param.dockerConfig.getContainerName()}:latest`));
                if (!imageExists) {
                    (0, logger_1.logDebugInfo)('🐳 🟡 Building Docker image...');
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
                        this.docker.modem.followProgress(stream, (err, res) => {
                            if (err) {
                                (0, logger_1.logError)('🐳 🔴 Error building image: ' + err);
                                reject(err);
                            }
                            else {
                                (0, logger_1.logDebugInfo)('🐳 🟢 Docker image built successfully');
                                resolve(res);
                            }
                        }, (event) => {
                            if (event.stream) {
                                (0, logger_1.logDebugInfo)(`🐳 🟡 ${event.stream.trim()}`);
                            }
                        });
                    });
                    // logDebugInfo('🐳 🟡 Image build result: ' + JSON.stringify(result, null, 2));
                    // Verify that the image exists and is properly tagged
                    try {
                        const images = await this.docker.listImages();
                        (0, logger_1.logDebugInfo)('🐳 🟡 Images: ' + JSON.stringify(images, null, 2));
                        const actionImage = images.find(img => img.RepoTags && img.RepoTags.includes(`${param.dockerConfig.getContainerName()}:latest`));
                        if (!actionImage) {
                            (0, logger_1.logError)(`🐳 🔴 Image ${param.dockerConfig.getContainerName()}:latest not found after build`);
                            throw new Error(`Image ${param.dockerConfig.getContainerName()}:latest not found after build`);
                        }
                        (0, logger_1.logDebugInfo)('🐳 🟢 Image exists and is properly tagged');
                    }
                    catch (error) {
                        (0, logger_1.logError)('🐳 🔴 Error verifying image: ' + error);
                        throw error;
                    }
                }
                else {
                    (0, logger_1.logDebugInfo)('🐳 🟢 Image already exists, skipping build');
                }
                (0, logger_1.logDebugInfo)(`🐳 🟡 Creating container... ${param.dockerConfig.getContainerName()}:${param.dockerConfig.getPort()}`);
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
                (0, logger_1.logDebugInfo)('🐳 🟡 Starting container...');
                await container.start();
                (0, logger_1.logDebugInfo)('🐳 🟡 Container started successfully');
                // Wait for the container to be ready
                (0, logger_1.logDebugInfo)('🐳 🟡 Waiting for container to be ready...');
                await this.waitForContainer(param);
                (0, logger_1.logDebugInfo)('🐳 🟢 Docker container is ready');
            }
            catch (error) {
                (0, logger_1.logError)('Error starting container: ' + error);
                throw error;
            }
        };
        this.waitForContainer = async (param) => {
            const maxAttempts = 30;
            const interval = 2000; // 2 seconds
            let attempts = 0;
            while (attempts < maxAttempts) {
                try {
                    const response = await axios_1.default.get(`http://${param.dockerConfig.getDomain()}:${param.dockerConfig.getPort()}/health`, {
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        timeout: 10000,
                        family: 4
                    });
                    const data = response.data;
                    (0, logger_1.logDebugInfo)(`🐳 🟡 Health check response: ${JSON.stringify(data)}`);
                    if (data.status === 'ready') {
                        (0, logger_1.logDebugInfo)('🐳 🟢 Container is ready and model is loaded');
                        return;
                    }
                    else if (data.status === 'error') {
                        (0, logger_1.logDebugInfo)(`🐳 🔴 Model failed to load: ${data.message}`);
                        throw new Error(`Model failed to load: ${data.message}`);
                    }
                    else {
                        (0, logger_1.logDebugInfo)(`🐳 🟡 Model status: ${data.status}, Progress: ${data.progress}%, Message: ${data.message}`);
                    }
                }
                catch (error) {
                    (0, logger_1.logDebugInfo)(`🐳 🔴 Health check error: ${error?.message || String(error)}`);
                }
                (0, logger_1.logDebugInfo)(`🐳 🟡 Waiting ${interval / 1000} seconds before next attempt...`);
                await new Promise(resolve => setTimeout(resolve, interval));
                attempts++;
            }
            throw new Error(`🐳 🔴 Container did not become ready after ${maxAttempts} attempts (${(maxAttempts * interval) / 1000} seconds)`);
        };
        this.stopContainer = async (param) => {
            (0, logger_1.logDebugInfo)('🐳 🟠 Stopping Docker container...');
            if (!this.isContainerRunning(param))
                return;
            const containerId = await this.getContainerIdByName(param);
            if (!containerId)
                return;
            try {
                const container = this.docker.getContainer(containerId);
                await container.stop();
                await container.remove();
                (0, logger_1.logDebugInfo)('🐳 ⚪ Docker container stopped');
            }
            catch (error) {
                (0, logger_1.logError)('🐳 🔴 Error stopping container: ' + error);
            }
        };
        this.isContainerRunning = async (param) => {
            try {
                const containers = await this.docker.listContainers({ all: true });
                const container = containers.find(container => container.Names.some(name => name === `/${param.dockerConfig.getContainerName()}`));
                return container?.State === 'running' || false;
            }
            catch (error) {
                (0, logger_1.logDebugError)('Error checking container status: ' + error);
                return false;
            }
        };
        this.getContainerIdByName = async (param) => {
            try {
                const containers = await this.docker.listContainers({ all: true });
                const container = containers.find(container => container.Names.some(name => name === param.dockerConfig.getContainerName()));
                return container?.Id || '';
            }
            catch (error) {
                (0, logger_1.logDebugError)('Error checking container status: ' + error);
                return '';
            }
        };
        this.getEmbedding = async (param, textInstructionsPairs) => {
            try {
                const request = {
                    instructions: textInstructionsPairs.map(pair => pair[0]),
                    texts: textInstructionsPairs.map(pair => pair[1])
                };
                const response = await axios_1.default.post(`http://${param.dockerConfig.getDomain()}:${param.dockerConfig.getPort()}/embed`, request, {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    family: 4
                });
                const data = response.data;
                return data.embeddings;
            }
            catch (error) {
                (0, logger_1.logError)(`🐳 🔴 Error getting embedding: ${JSON.stringify(error, null, 2)}`);
                throw error;
            }
        };
        this.getSystemInfo = async (param) => {
            const response = await axios_1.default.get(`http://${param.dockerConfig.getDomain()}:${param.dockerConfig.getPort()}/system-info`, {
                family: 4
            });
            return response.data;
        };
        this.docker = new dockerode_1.default();
        this.dockerDir = path_1.default.join(process.cwd(), 'docker');
    }
}
exports.DockerRepository = DockerRepository;

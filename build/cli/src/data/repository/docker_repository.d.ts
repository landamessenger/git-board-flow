import { Execution } from '../model/execution';
export declare class DockerRepository {
    private docker;
    private readonly dockerDir;
    constructor();
    private isGitHubActions;
    private isSelfHostedRunner;
    private shouldUsePrebuiltImage;
    private shouldUseLocalImage;
    getArchitectureType(): string;
    startContainer: (param: Execution) => Promise<void>;
    private runContainer;
    imageExists: (param: Execution) => Promise<boolean>;
    getImageName(param: Execution): string;
    getImageNameWithTag(param: Execution): string;
    private pullPrebuiltImage;
    buildImage: (param: Execution) => Promise<void>;
    private getContainer;
    private waitForContainer;
    stopContainer: (param: Execution) => Promise<void>;
    private cleanupDanglingImages;
    isContainerRunning: (param: Execution) => Promise<boolean>;
    getContainerIdByName: (param: Execution) => Promise<string>;
    getEmbedding: (param: Execution, textInstructionsPairs: [string, string][]) => Promise<number[][]>;
    getSystemInfo: (param: Execution) => Promise<any>;
    /**
     * Clean up manually all dangling images from the Docker system.
     * Useful to free space in different managers (OrbStack, Colima, Docker Desktop).
     */
    cleanupAllDanglingImages: () => Promise<void>;
    /**
     * Check if an image exists in the registry by attempting to pull it
     */
    checkImageInRegistry: (param: Execution) => Promise<boolean>;
    cleanupIncompleteLayers: (imageName: string) => Promise<void>;
    /**
     * Authenticate with GitHub Container Registry
     */
    private authenticateWithRegistry;
    /**
     * Push an image to the registry
     */
    pushImageToRegistry: (param: Execution, imageName: string) => Promise<void>;
}

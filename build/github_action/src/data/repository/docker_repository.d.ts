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
    checkImageInRegistry: (param: Execution) => Promise<boolean>;
    pushImageToRegistry: (param: Execution, imageName: string) => Promise<void>;
    private authenticateWithRegistry;
    private getContainer;
    private waitForContainer;
    private getContainerIdByName;
    isContainerRunning(param: Execution): Promise<boolean>;
    getEmbedding: (param: Execution, textInstructionsPairs: [string, string][]) => Promise<number[][]>;
    getSystemInfo: (param: Execution) => Promise<any>;
    stopContainer: (param: Execution) => Promise<void>;
    private cleanupDanglingImages;
}

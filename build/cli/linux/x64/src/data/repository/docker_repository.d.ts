import { Execution } from '../model/execution';
export declare class DockerRepository {
    private docker;
    private readonly dockerDir;
    private cacheRepository;
    constructor();
    startContainer: (param: Execution) => Promise<void>;
    private imageExists;
    private buildImage;
    private createContainer;
    private waitForContainer;
    stopContainer: (param: Execution) => Promise<void>;
    isContainerRunning: (param: Execution) => Promise<boolean>;
    getContainerIdByName: (param: Execution) => Promise<string>;
    getEmbedding: (param: Execution, textInstructionsPairs: [string, string][]) => Promise<number[][]>;
    getSystemInfo: (param: Execution) => Promise<any>;
}

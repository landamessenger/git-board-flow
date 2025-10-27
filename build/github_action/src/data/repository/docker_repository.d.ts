import { Execution } from '../model/execution';
export declare class DockerRepository {
    private docker;
    private readonly dockerDir;
    private cacheRepository;
    constructor();
    startContainer: (param: Execution) => Promise<void>;
    private runContainer;
    private imageExists;
    private buildImage;
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
    private commitContainer;
    private removeCachedImage;
    private saveContainerState;
    private restoreContainerState;
    /**
     * Validate if the current operating system and architecture match the expected ones.
     * Return a formatted string if they match, or undefined if they don't.
     *
     * @param expectedOs Ejemplo: "ubuntu-latest", "macos-latest", "windows-latest"
     * @param expectedArch Ejemplo: "amd64", "arm64"
     * @returns string (clave para la caché) o undefined si no coincide
     */
    private machineCachable;
}

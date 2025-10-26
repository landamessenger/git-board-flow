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
    isContainerRunning: (param: Execution) => Promise<boolean>;
    getContainerIdByName: (param: Execution) => Promise<string>;
    getEmbedding: (param: Execution, textInstructionsPairs: [string, string][]) => Promise<number[][]>;
    getSystemInfo: (param: Execution) => Promise<any>;
    private commitContainer;
    private saveContainerState;
    private restoreContainerState;
    /**
     * Valida si el sistema operativo y arquitectura actuales coinciden
     * con los esperados. Devuelve un string formateado si coinciden, o undefined si no.
     *
     * @param expectedOs Ejemplo: "ubuntu-latest", "macos-latest", "windows-latest"
     * @param expectedArch Ejemplo: "amd64", "arm64"
     * @returns string (clave para la caché) o undefined si no coincide
     */
    private machineCachable;
}

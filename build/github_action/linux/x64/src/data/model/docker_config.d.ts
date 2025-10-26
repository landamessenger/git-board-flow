export declare class DockerConfig {
    private containerName;
    private domain;
    private port;
    private cacheOs;
    private cacheArch;
    constructor(containerName: string, domain: string, port: number, cacheOs: string, cacheArch: string);
    getContainerName(): string;
    getDomain(): string;
    getPort(): number;
    getCacheOs(): string;
    getCacheArch(): string;
}

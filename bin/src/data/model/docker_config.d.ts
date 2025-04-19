export declare class DockerConfig {
    private containerName;
    private domain;
    private port;
    constructor(containerName: string, domain: string, port: number);
    getContainerName(): string;
    getDomain(): string;
    getPort(): number;
}

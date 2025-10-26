export class DockerConfig {
    private containerName: string;
    private domain: string;
    private port: number;
    private cacheOs: string;
    private cacheArch: string;

    constructor(containerName: string, domain: string, port: number, cacheOs: string, cacheArch: string) {
        this.containerName = containerName;
        this.domain = domain;
        this.port = port;
        this.cacheOs = cacheOs;
        this.cacheArch = cacheArch;
    }

    public getContainerName(): string {
        return this.containerName;
    }

    public getDomain(): string {
        return this.domain;
    }

    public getPort(): number {
        return this.port;
    }

    public getCacheOs(): string {
        return this.cacheOs;
    }

    public getCacheArch(): string {
        return this.cacheArch;
    }
}


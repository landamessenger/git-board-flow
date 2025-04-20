export class DockerConfig {
    private containerName: string;
    private domain: string;
    private port: number;

    constructor(containerName: string, domain: string, port: number) {
        this.containerName = containerName;
        this.domain = domain;
        this.port = port;
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
}


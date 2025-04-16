"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DockerConfig = void 0;
class DockerConfig {
    constructor(containerName, domain, port) {
        this.containerName = containerName;
        this.domain = domain;
        this.port = port;
    }
    getContainerName() {
        return this.containerName;
    }
    getDomain() {
        return this.domain;
    }
    getPort() {
        return this.port;
    }
}
exports.DockerConfig = DockerConfig;

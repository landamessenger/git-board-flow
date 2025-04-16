"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChunkedFileChunk = void 0;
class ChunkedFileChunk {
    constructor(owner, repository, branch, path, type, index, chunkIndex, chunk, shasum, vector) {
        this.shasum = '';
        this.vector = [];
        this.owner = owner;
        this.repository = repository;
        this.branch = branch;
        this.path = path;
        this.type = type;
        this.index = index;
        this.chunkIndex = chunkIndex;
        this.chunk = chunk;
        this.shasum = shasum;
        this.vector = vector;
    }
}
exports.ChunkedFileChunk = ChunkedFileChunk;

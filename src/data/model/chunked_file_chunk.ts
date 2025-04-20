import { createHash } from 'crypto';

export class ChunkedFileChunk {
    owner: string;
    repository: string;
    branch: string;
    path: string;
    type: 'line' | 'block';
    index: number;
    chunkIndex: number;
    chunk: string;
    shasum: string = '';
    vector: number[] = [];

    constructor(
        owner: string,
        repository: string,
        branch: string,
        path: string,
        type: 'line' | 'block',
        index: number,
        chunkIndex: number,
        chunk: string,
        shasum: string,
        vector: number[]
    ) {
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


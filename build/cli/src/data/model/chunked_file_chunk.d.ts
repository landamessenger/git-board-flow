export declare class ChunkedFileChunk {
    owner: string;
    repository: string;
    branch: string;
    path: string;
    type: 'line' | 'block';
    index: number;
    chunkIndex: number;
    chunk: string;
    shasum: string;
    vector: number[];
    constructor(owner: string, repository: string, branch: string, path: string, type: 'line' | 'block', index: number, chunkIndex: number, chunk: string, shasum: string, vector: number[]);
}

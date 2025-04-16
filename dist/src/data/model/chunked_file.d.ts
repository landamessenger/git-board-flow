export declare class ChunkedFile {
    path: string;
    index: number;
    type: 'line' | 'block';
    content: string;
    chunks: string[];
    shasum: string;
    vector: number[][];
    constructor(path: string, index: number, type: 'line' | 'block', content: string, shasum: string, chunks: string[]);
}

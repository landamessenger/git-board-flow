import { createHash } from 'crypto';

export class ChunkedFile {
    id: string;
    path: string;
    index: number;
    content: string;
    chunks: string[];
    shasum: string = '';
    vector: number[][] = [];

    constructor(id: string, path: string, index: number, content: string, chunks: string[]) {
        this.id = id;
        this.path = path;
        this.index = index;
        this.content = content;
        this.chunks = chunks;
        this.shasum = this.calculateShasum(content);
    }

    private calculateShasum(content: string): string {
        return createHash('sha256').update(content).digest('hex');
    }
}


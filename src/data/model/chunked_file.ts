import { createHash } from 'crypto';

export class ChunkedFile {
    path: string;
    index: number;
    type: 'line' | 'block';
    content: string;
    chunks: string[];
    shasum: string = '';
    vector: number[][] = [];

    constructor(path: string, index: number, type: 'line' | 'block', content: string, chunks: string[]) {
        this.path = path;
        this.index = index;
        this.content = content;
        this.chunks = chunks;
        this.shasum = this.calculateShasum(content);
        this.type = type;
    }

    private calculateShasum(content: string): string {
        return createHash('sha256').update(content).digest('hex');
    }
}


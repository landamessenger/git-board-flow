
export class ChunkedFile {
    path: string;
    index: number;
    type: 'line' | 'block';
    content: string;
    chunks: string[];
    shasum: string = '';
    vector: number[][] = [];

    constructor(path: string, index: number, type: 'line' | 'block', content: string, shasum: string, chunks: string[]) {
        this.path = path;
        this.index = index;
        this.content = content;
        this.chunks = chunks;
        this.shasum = shasum;
        this.type = type;
    }
}

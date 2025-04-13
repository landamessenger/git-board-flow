export class ChunkedFile {
    id: string;
    path: string;
    index: number;
    content: string;
    chunks: string[];
    vector: number[][] = [];

    constructor(id: string, path: string, index: number, content: string, chunks: string[]) {
        this.id = id;
        this.path = path;
        this.index = index;
        this.content = content;
        this.chunks = chunks;
    }
}


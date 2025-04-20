"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChunkedFile = void 0;
class ChunkedFile {
    constructor(path, index, type, content, shasum, chunks) {
        this.shasum = '';
        this.vector = [];
        this.path = path;
        this.index = index;
        this.content = content;
        this.chunks = chunks;
        this.shasum = shasum;
        this.type = type;
    }
}
exports.ChunkedFile = ChunkedFile;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChunkedFile = void 0;
const crypto_1 = require("crypto");
class ChunkedFile {
    constructor(path, index, type, content, chunks) {
        this.shasum = '';
        this.vector = [];
        this.path = path;
        this.index = index;
        this.content = content;
        this.chunks = chunks;
        this.shasum = this.calculateShasum(content);
        this.type = type;
    }
    calculateShasum(content) {
        return (0, crypto_1.createHash)('sha256').update(content).digest('hex');
    }
}
exports.ChunkedFile = ChunkedFile;

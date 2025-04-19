"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabaseConfig = void 0;
class SupabaseConfig {
    constructor(url, key) {
        this.url = url;
        this.key = key;
    }
    getUrl() {
        return this.url;
    }
    getKey() {
        return this.key;
    }
}
exports.SupabaseConfig = SupabaseConfig;

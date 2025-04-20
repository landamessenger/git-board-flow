export class SupabaseConfig {
    private url: string;
    private key: string;

    constructor(url: string, key: string) {
        this.url = url;
        this.key = key;
    }

    getUrl(): string {
        return this.url;
    }

    getKey(): string {
        return this.key;
    }
} 
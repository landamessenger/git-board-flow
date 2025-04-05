export class Tokens {
    token: string;

    constructor(
        token: string,
    ) {
        this.token = token;
    }

    get githubToken(): string {
        const token = process.env.GITHUB_TOKEN;
        if (!token) {
            throw new Error('GITHUB_TOKEN environment variable is not set');
        }
        return token;
    }
}
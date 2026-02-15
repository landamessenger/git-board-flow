export class ProjectDetail {
    id: string;
    title: string;
    type: string;
    owner: string;
    url: string;
    number: number;

    /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- project detail from API */
    constructor(data: any) {
        this.id = data[`id`] ?? '';
        this.title = data[`title`] ?? '';
        this.type = data[`type`] ?? '';
        this.owner = data[`owner`] ?? '';
        this.url = data[`url`] ?? '';
        this.number = data[`number`] ?? -1;
    }

    /**
     * Returns the full public URL to the project (board).
     * Uses the URL from the API when present and valid; otherwise builds it from owner, type and number.
     * Returns empty string when project number is invalid (e.g. missing from API).
     */
    get publicUrl(): string {
        if (this.url && typeof this.url === 'string' && this.url.startsWith('https://')) {
            return this.url;
        }
        if (typeof this.number !== 'number' || this.number <= 0) {
            return '';
        }
        const path = this.type === 'organization' ? 'orgs' : 'users';
        return `https://github.com/${path}/${this.owner}/projects/${this.number}`;
    }
}
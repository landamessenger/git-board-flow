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
}
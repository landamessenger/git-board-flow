export class BranchConfiguration {
    name: string;
    oid: string;
    children: BranchConfiguration[];

    constructor(data: any) {
        this.name = data['name'] ?? '';
        this.oid = data['oid'] ?? '';
        this.children = [];
        if (data['children'] !== undefined && data['children'].length > 0) {
            for (const child of data['children']) {
                this.children.push(new BranchConfiguration(child));
            }
        }
    }
}
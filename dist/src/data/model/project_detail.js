"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectDetail = void 0;
class ProjectDetail {
    constructor(data) {
        this.id = data[`id`] ?? '';
        this.title = data[`title`] ?? '';
        this.type = data[`type`] ?? '';
        this.owner = data[`owner`] ?? '';
        this.url = data[`url`] ?? '';
        this.number = data[`number`] ?? -1;
    }
}
exports.ProjectDetail = ProjectDetail;

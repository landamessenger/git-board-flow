import * as core from "@actions/core";

export abstract class ContentInterface {
    abstract get id(): string

    private get _id(): string {
        return `git-board-flow-${this._id}`
    }

    abstract get visibleContent(): boolean

    private get startPattern(): string {
        if (this.visibleContent) {
            return `<!-- ${this._id}-start -->`
        }
        return `<!-- ${this._id}-start`
    }

    private get endPattern(): string {
        if (this.visibleContent) {
            return `<!-- ${this._id}-end -->`
        }
        return `${this._id}-end -->`
    }

    getContent = (description: string | undefined): string | undefined => {
        try {
            if (description === undefined) {
                return undefined;
            }
            if (description.indexOf(this.startPattern) === -1 || description.indexOf(this.endPattern) === -1) {
                return undefined;
            }

            return description.split(this.startPattern)[1].split(this.endPattern)[0]
        } catch (error) {
            core.error(`Error reading issue configuration: ${error}`);
            throw error;
        }
    }

    private _addContent = (description: string, content: string) => {
        if (description.indexOf(this.startPattern) === -1 && description.indexOf(this.endPattern) === -1) {
            const newContent = `${this.startPattern}\n${content}\n${this.endPattern}`;
            return `${description}\n\n${newContent}`;
        } else {
            return undefined;
        }
    }

    private _updateContent = (description: string, content: string) => {
        if (description.indexOf(this.startPattern) === -1 || description.indexOf(this.endPattern) === -1) {
            core.error(`The content has a problem with open-close tags: ${this.startPattern} / ${this.endPattern}`);
            return undefined;
        }

        const start = description.split(this.startPattern)[0]
        const mid = `${this.startPattern}\n${content}\n${this.endPattern}`;
        const end = description.split(this.endPattern)[1]

        return `${start}${mid}${end}`;
    }

    updateContent = (description: string | undefined, content: string | undefined) => {
        try {
            if (description === undefined || content === undefined) {
                return undefined;
            }

            const addedContent = this._addContent(description, content);

            if (addedContent !== undefined) {
                return addedContent;
            }

            return this._updateContent(description, content);
        } catch (error) {
            console.error(`Error updating issue description: ${error}`);
            return undefined;
        }
    }
}

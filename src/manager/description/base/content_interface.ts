import { logError } from "../../../utils/logger";

export abstract class ContentInterface {
    abstract get id(): string

    private get _id(): string {
        return `copilot-${this.id}`
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

    private getBlockIndices(description: string): { startIndex: number; contentStart: number; endIndex: number } | undefined {
        const startIndex = description.indexOf(this.startPattern);
        if (startIndex === -1) {
            return undefined;
        }

        const contentStart = startIndex + this.startPattern.length;
        const endIndex = description.indexOf(this.endPattern, contentStart);
        if (endIndex === -1) {
            return undefined;
        }

        return { startIndex, contentStart, endIndex };
    }

    getContent = (description: string | undefined): string | undefined => {
        try {
            if (description === undefined) {
                return undefined;
            }

            const indices = this.getBlockIndices(description);
            if (!indices) {
                return undefined;
            }

            return description.substring(indices.contentStart, indices.endIndex);
        } catch (error) {
            logError(`Error reading issue configuration: ${error}`);
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
        const indices = this.getBlockIndices(description);
        if (!indices) {
            logError(`The content has a problem with open-close tags: ${this.startPattern} / ${this.endPattern}`);
            return undefined;
        }

        const start = description.substring(0, indices.startIndex);
        const mid = `${this.startPattern}\n${content}\n${this.endPattern}`;
        const end = description.substring(indices.endIndex + this.endPattern.length);

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
            logError(`Error updating issue description: ${error}`);
            return undefined;
        }
    }
}

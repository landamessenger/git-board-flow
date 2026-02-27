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

    private findExactMatch(description: string, pattern: string): number {
        let index = 0;
        while ((index = description.indexOf(pattern, index)) !== -1) {
            const nextChar = description[index + pattern.length];
            // If the next character is alphanumeric or a hyphen, it's a partial match (e.g., "-starts-here")
            // So we skip it. Otherwise, it's an exact match.
            if (!nextChar || !/[a-zA-Z0-9-]/.test(nextChar)) {
                return index;
            }
            index += pattern.length;
        }
        return -1;
    }

    getContent = (description: string | undefined): string | undefined => {
        try {
            if (description === undefined) {
                return undefined;
            }
            const startIndex = this.findExactMatch(description, this.startPattern);
            const endIndex = this.findExactMatch(description, this.endPattern);
            if (startIndex === -1 || endIndex === -1) {
                return undefined;
            }

            return description.substring(startIndex + this.startPattern.length, endIndex);
        } catch (error) {
            logError(`Error reading issue configuration: ${error}`);
            throw error;
        }
    }

    private _addContent = (description: string, content: string) => {
        if (this.findExactMatch(description, this.startPattern) === -1 && this.findExactMatch(description, this.endPattern) === -1) {
            const newContent = `${this.startPattern}\n${content}\n${this.endPattern}`;
            return `${description}\n\n${newContent}`;
        } else {
            return undefined;
        }
    }

    private _updateContent = (description: string, content: string) => {
        const startIndex = this.findExactMatch(description, this.startPattern);
        const endIndex = this.findExactMatch(description, this.endPattern);
        if (startIndex === -1 || endIndex === -1) {
            logError(`The content has a problem with open-close tags: ${this.startPattern} / ${this.endPattern}`);
            return undefined;
        }

        const start = description.substring(0, startIndex);
        const mid = `${this.startPattern}\n${content}\n${this.endPattern}`;
        const end = description.substring(endIndex + this.endPattern.length);

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

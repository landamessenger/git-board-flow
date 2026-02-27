export declare abstract class ContentInterface {
    abstract get id(): string;
    private get _id();
    abstract get visibleContent(): boolean;
    private get startPattern();
    private get endPattern();
    private getBlockIndices;
    getContent: (description: string | undefined) => string | undefined;
    private _addContent;
    private _updateContent;
    updateContent: (description: string | undefined, content: string | undefined) => string | undefined;
}

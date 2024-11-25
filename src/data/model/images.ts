export class Images {
    cleanUpGifs: string[];
    featureGifs: string[];
    bugfixGifs: string[];
    hotfixGifs: string[];
    prLinkGifs: string[];

    constructor(
        cleanUpGifs: string[],
        featureGifs: string[],
        bugfixGifs: string[],
        hotfixGifs: string[],
        prLinkGifs: string[],
    ) {
        this.cleanUpGifs = cleanUpGifs;
        this.featureGifs = featureGifs;
        this.bugfixGifs = bugfixGifs;
        this.hotfixGifs = hotfixGifs;
        this.prLinkGifs = prLinkGifs;
    }
}
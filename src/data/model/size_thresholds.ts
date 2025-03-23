import { SizeThreshold } from "./size_threshold";

export class SizeThresholds {
    xxl: SizeThreshold;
    xl: SizeThreshold;
    l: SizeThreshold;
    m: SizeThreshold;
    s: SizeThreshold;
    xs: SizeThreshold;

    constructor(xxl: SizeThreshold, xl: SizeThreshold, l: SizeThreshold, m: SizeThreshold, s: SizeThreshold, xs: SizeThreshold) {
        this.xxl = xxl;
        this.xl = xl;
        this.l = l;
        this.m = m;
        this.s = s;
        this.xs = xs;
    }
}

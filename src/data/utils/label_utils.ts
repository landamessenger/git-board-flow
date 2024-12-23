import {Execution} from "../model/execution";

export const branchesForManagement = (
    params: Execution,
    labels: string[],
    bugfixLabel: string,
    hotfixLabel: string,
    releaseLabel: string,
): string => {
    if (labels.includes(hotfixLabel)) return params.branches.bugfixTree;
    if (labels.includes(bugfixLabel)) return params.branches.bugfixTree;
    if (labels.includes(releaseLabel)) return params.branches.releaseTree;
    return params.branches.featureTree;
}

export const typesForIssue = (
    params: Execution,
    labels: string[],
    bugfixLabel: string,
    hotfixLabel: string,
    releaseLabel: string,
): string => {
    if (labels.includes(hotfixLabel)) return params.branches.hotfixTree;
    if (labels.includes(bugfixLabel)) return params.branches.bugfixTree;
    if (labels.includes(releaseLabel)) return params.branches.releaseTree;
    return params.branches.featureTree;
}
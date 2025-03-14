import {Execution} from "../model/execution";

export const branchesForManagement = (
    params: Execution,
    labels: string[],
    bugfixLabel: string,
    hotfixLabel: string,
    releaseLabel: string,
    docsLabel: string,
    choreLabel: string,
): string => {
    if (labels.includes(hotfixLabel)) return params.branches.bugfixTree;
    if (labels.includes(bugfixLabel)) return params.branches.bugfixTree;
    if (labels.includes(releaseLabel)) return params.branches.releaseTree;
    if (labels.includes(docsLabel)) return params.branches.docsTree;
    if (labels.includes(choreLabel)) return params.branches.choreTree;
    return params.branches.featureTree;
}

export const typesForIssue = (
    params: Execution,
    labels: string[],
    bugfixLabel: string,
    hotfixLabel: string,
    releaseLabel: string,
    docsLabel: string,
    choreLabel: string,
): string => {
    if (labels.includes(hotfixLabel)) return params.branches.hotfixTree;
    if (labels.includes(bugfixLabel)) return params.branches.bugfixTree;
    if (labels.includes(releaseLabel)) return params.branches.releaseTree;
    if (labels.includes(docsLabel)) return params.branches.docsTree;
    if (labels.includes(choreLabel)) return params.branches.choreTree;
    return params.branches.featureTree;
}
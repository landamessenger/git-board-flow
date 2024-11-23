export const branchesForIssue = (
    labels: string[],
    bugfixLabel: string,
    hotfixLabel: string,
): string => {
    if (labels.includes(bugfixLabel)) return 'bugfix';
    if (labels.includes(hotfixLabel)) return 'bugfix';
    return 'feature';
}
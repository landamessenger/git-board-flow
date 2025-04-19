"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.typesForIssue = exports.branchesForManagement = void 0;
const branchesForManagement = (params, labels, featureLabel, enhancementLabel, bugfixLabel, bugLabel, hotfixLabel, releaseLabel, docsLabel, documentationLabel, choreLabel, maintenanceLabel) => {
    if (labels.includes(hotfixLabel))
        return params.branches.bugfixTree;
    if (labels.includes(bugfixLabel) || labels.includes(bugLabel))
        return params.branches.bugfixTree;
    if (labels.includes(releaseLabel))
        return params.branches.releaseTree;
    if (labels.includes(docsLabel) || labels.includes(documentationLabel))
        return params.branches.docsTree;
    if (labels.includes(choreLabel) || labels.includes(maintenanceLabel))
        return params.branches.choreTree;
    if (labels.includes(featureLabel) || labels.includes(enhancementLabel))
        return params.branches.featureTree;
    return params.branches.featureTree;
};
exports.branchesForManagement = branchesForManagement;
const typesForIssue = (params, labels, featureLabel, enhancementLabel, bugfixLabel, bugLabel, hotfixLabel, releaseLabel, docsLabel, documentationLabel, choreLabel, maintenanceLabel) => {
    if (labels.includes(hotfixLabel))
        return params.branches.hotfixTree;
    if (labels.includes(bugfixLabel) || labels.includes(bugLabel))
        return params.branches.bugfixTree;
    if (labels.includes(releaseLabel))
        return params.branches.releaseTree;
    if (labels.includes(docsLabel) || labels.includes(documentationLabel))
        return params.branches.docsTree;
    if (labels.includes(choreLabel) || labels.includes(maintenanceLabel))
        return params.branches.choreTree;
    if (labels.includes(featureLabel) || labels.includes(enhancementLabel))
        return params.branches.featureTree;
    return params.branches.featureTree;
};
exports.typesForIssue = typesForIssue;

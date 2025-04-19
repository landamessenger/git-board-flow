"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Issue = void 0;
const github = __importStar(require("@actions/github"));
class Issue {
    get title() {
        return this.inputs?.issue?.title ?? github.context.payload.issue?.title ?? '';
    }
    get number() {
        return this.inputs?.issue?.number ?? github.context.payload.issue?.number ?? -1;
    }
    get creator() {
        return this.inputs?.issue?.user?.login ?? github.context.payload.issue?.user.login ?? '';
    }
    get url() {
        return this.inputs?.issue?.html_url ?? github.context.payload.issue?.html_url ?? '';
    }
    get body() {
        return this.inputs?.issue?.body ?? github.context.payload.issue?.body ?? '';
    }
    get opened() {
        return ['opened', 'reopened'].includes(this.inputs?.action ?? github.context.payload.action ?? '');
    }
    get labeled() {
        return (this.inputs?.action ?? github.context.payload.action) === 'labeled';
    }
    get labelAdded() {
        return this.inputs?.label?.name ?? github.context.payload.label?.name ?? '';
    }
    get isIssue() {
        return (this.inputs?.eventName ?? github.context.eventName) === 'issues';
    }
    get isIssueComment() {
        return (this.inputs?.eventName ?? github.context.eventName) === 'issue_comment';
    }
    get commentId() {
        return this.inputs?.comment?.id ?? github.context.payload.comment?.id ?? -1;
    }
    get commentBody() {
        return this.inputs?.comment?.body ?? github.context.payload.comment?.body ?? '';
    }
    get commentAuthor() {
        return this.inputs?.comment?.user?.login ?? github.context.payload.comment?.user.login ?? '';
    }
    get commentUrl() {
        return this.inputs?.comment?.html_url ?? github.context.payload.comment?.html_url ?? '';
    }
    constructor(branchManagementAlways, reopenOnPush, desiredAssigneesCount, inputs = undefined) {
        this.inputs = undefined;
        this.branchManagementAlways = branchManagementAlways;
        this.reopenOnPush = reopenOnPush;
        this.desiredAssigneesCount = desiredAssigneesCount;
        this.inputs = inputs;
    }
}
exports.Issue = Issue;

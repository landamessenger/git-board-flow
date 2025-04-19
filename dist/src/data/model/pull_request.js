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
exports.PullRequest = void 0;
const github = __importStar(require("@actions/github"));
class PullRequest {
    get action() {
        return this.inputs?.action ?? github.context.payload.action ?? '';
    }
    get id() {
        return this.inputs?.pull_request?.node_id ?? github.context.payload.pull_request?.node_id ?? '';
    }
    get title() {
        return this.inputs?.pull_request?.title ?? github.context.payload.pull_request?.title ?? '';
    }
    get creator() {
        return this.inputs?.pull_request?.user?.login ?? github.context.payload.pull_request?.user.login ?? '';
    }
    get number() {
        return this.inputs?.pull_request?.number ?? github.context.payload.pull_request?.number ?? -1;
    }
    get url() {
        return this.inputs?.pull_request?.html_url ?? github.context.payload.pull_request?.html_url ?? '';
    }
    get body() {
        return this.inputs?.pull_request?.body ?? github.context.payload.pull_request?.body ?? '';
    }
    get head() {
        return this.inputs?.pull_request?.head?.ref ?? github.context.payload.pull_request?.head.ref ?? '';
    }
    get base() {
        return this.inputs?.pull_request?.base?.ref ?? github.context.payload.pull_request?.base.ref ?? '';
    }
    get isMerged() {
        return this.inputs?.pull_request?.merged ?? github.context.payload.pull_request?.merged ?? false;
    }
    get opened() {
        return ['opened', 'reopened'].includes(this.inputs?.action ?? github.context.payload.action ?? '');
    }
    get isOpened() {
        return (this.inputs?.pull_request?.state ?? github.context.payload.pull_request?.state) === 'open'
            && this.action !== 'closed';
    }
    get isClosed() {
        return (this.inputs?.pull_request?.state ?? github.context.payload.pull_request?.state) === 'closed'
            || this.action === 'closed';
    }
    get isSynchronize() {
        return this.action === 'synchronize';
    }
    get isPullRequest() {
        return (this.inputs?.eventName ?? github.context.eventName) === 'pull_request';
    }
    get isPullRequestReviewComment() {
        return (this.inputs?.eventName ?? github.context.eventName) === 'pull_request_review_comment';
    }
    get commentId() {
        return this.inputs?.pull_request_review_comment?.id ?? github.context.payload.pull_request_review_comment?.id ?? -1;
    }
    get commentBody() {
        return this.inputs?.pull_request_review_comment?.body ?? github.context.payload.pull_request_review_comment?.body ?? '';
    }
    get commentAuthor() {
        return this.inputs?.pull_request_review_comment?.user?.login ?? github.context.payload.pull_request_review_comment?.user.login ?? '';
    }
    get commentUrl() {
        return this.inputs?.pull_request_review_comment?.html_url ?? github.context.payload.pull_request_review_comment?.html_url ?? '';
    }
    constructor(desiredAssigneesCount, desiredReviewersCount, mergeTimeout, inputs = undefined) {
        this.inputs = undefined;
        this.desiredAssigneesCount = desiredAssigneesCount;
        this.desiredReviewersCount = desiredReviewersCount;
        this.mergeTimeout = mergeTimeout;
        this.inputs = inputs;
    }
}
exports.PullRequest = PullRequest;

#!/usr/bin/env node
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
const child_process_1 = require("child_process");
const commander_1 = require("commander");
const dotenv = __importStar(require("dotenv"));
const local_action_1 = require("./actions/local_action");
const issue_repository_1 = require("./data/repository/issue_repository");
const constants_1 = require("./utils/constants");
// Load environment variables from .env file
dotenv.config();
const program = new commander_1.Command();
// Function to get git repository info
function getGitInfo() {
    try {
        const remoteUrl = (0, child_process_1.execSync)('git config --get remote.origin.url').toString().trim();
        const match = remoteUrl.match(/github\.com[/:]([^/]+)\/([^/]+)(?:\.git)?$/);
        if (!match) {
            return { error: constants_1.ERRORS.GIT_REPOSITORY_NOT_FOUND };
        }
        return {
            owner: match[1],
            repo: match[2].replace('.git', '')
        };
    }
    catch (error) {
        return { error: constants_1.ERRORS.GIT_REPOSITORY_NOT_FOUND };
    }
}
program
    .name(constants_1.COMMAND)
    .description(`CLI tool for ${constants_1.TITLE}`)
    .version('1.0.0');
program
    .command('build-ai')
    .description('Build AI')
    .option('-i, --issue <number>', 'Issue number to process', '1')
    .option('-b, --branch <name>', 'Branch name', 'master')
    .option('-d, --debug', 'Debug mode', false)
    .option('-t, --token <token>', 'Personal access token', process.env.PERSONAL_ACCESS_TOKEN)
    .action((options) => {
    const gitInfo = getGitInfo();
    if ('error' in gitInfo) {
        console.log(gitInfo.error);
        return;
    }
    const params = {
        [constants_1.INPUT_KEYS.DEBUG]: options.debug.toString(),
        [constants_1.INPUT_KEYS.SINGLE_ACTION]: constants_1.ACTIONS.VECTOR,
        [constants_1.INPUT_KEYS.SINGLE_ACTION_ISSUE]: options.issue,
        [constants_1.INPUT_KEYS.SUPABASE_URL]: process.env.SUPABASE_URL,
        [constants_1.INPUT_KEYS.SUPABASE_KEY]: process.env.SUPABASE_KEY,
        [constants_1.INPUT_KEYS.TOKEN]: process.env.PERSONAL_ACCESS_TOKEN,
        [constants_1.INPUT_KEYS.AI_IGNORE_FILES]: 'build/*',
        repo: {
            owner: gitInfo.owner,
            repo: gitInfo.repo,
        },
        commits: {
            ref: `refs/heads/${options.branch}`,
        },
        issue: {
            number: parseInt(options.issue),
        },
    };
    params[constants_1.INPUT_KEYS.WELCOME_TITLE] = '🚀 Vectorization started';
    params[constants_1.INPUT_KEYS.WELCOME_MESSAGES] = [
        `Processing code blocks on ${gitInfo.owner}/${gitInfo.repo}/${options.branch}...`,
    ];
    (0, local_action_1.runLocalAction)(params);
});
/**
 * Run the asking AI scenario on issues or pull requests.
 *
 * For the action of asking the AI to be executed, the bot user managing the repository must be mentioned.
 */
program
    .command('ask-ai')
    .description('Ask AI')
    .option('-i, --issue <number>', 'Issue number to process', '1')
    .option('-b, --branch <name>', 'Branch name', 'master')
    .option('-d, --debug', 'Debug mode', false)
    .option('-t, --token <token>', 'Personal access token', process.env.PERSONAL_ACCESS_TOKEN)
    .option('--question <question>', 'Question', '')
    .option('--openrouter-api-key <key>', 'OpenRouter API key', '')
    .option('--openrouter-model <model>', 'OpenRouter model', '')
    .option('--openrouter-provider-order <provider>', 'OpenRouter provider', '')
    .option('--openrouter-provider-allow-fallbacks <fallback>', 'OpenRouter fallback', '')
    .option('--openrouter-provider-require-parameters <require>', 'OpenRouter require', '')
    .option('--openrouter-provider-data-collection <collection>', 'OpenRouter collection', '')
    .option('--openrouter-provider-ignore <ignore>', 'OpenRouter ignore', '')
    .option('--openrouter-provider-quantizations <quantizations>', 'OpenRouter quantizations', '')
    .option('--openrouter-provider-sort <sort>', 'OpenRouter sort', '')
    .option('--ai-ignore-files <ai-ignore-files>', 'AI ignore files', 'node_modules/*,build/*')
    .option('--include-reasoning <include-reasoning>', 'Include reasoning', 'false')
    .action(async (options) => {
    const gitInfo = getGitInfo();
    if ('error' in gitInfo) {
        console.log(gitInfo.error);
        return;
    }
    const commentBody = options.question;
    const params = {
        [constants_1.INPUT_KEYS.DEBUG]: options.debug.toString(),
        [constants_1.INPUT_KEYS.SUPABASE_URL]: options?.supabaseUrl?.length > 0 ? options.supabaseUrl : process.env.SUPABASE_URL,
        [constants_1.INPUT_KEYS.SUPABASE_KEY]: options?.supabaseKey?.length > 0 ? options.supabaseKey : process.env.SUPABASE_KEY,
        [constants_1.INPUT_KEYS.TOKEN]: options?.token?.length > 0 ? options.token : process.env.PERSONAL_ACCESS_TOKEN,
        [constants_1.INPUT_KEYS.OPENROUTER_API_KEY]: options?.openrouterApiKey?.length > 0 ? options.openrouterApiKey : process.env.OPENROUTER_API_KEY,
        [constants_1.INPUT_KEYS.OPENROUTER_MODEL]: options?.openrouterModel?.length > 0 ? options.openrouterModel : process.env.OPENROUTER_MODEL,
        [constants_1.INPUT_KEYS.OPENROUTER_PROVIDER_ORDER]: options?.openrouterProviderOrder?.length > 0 ? options.openrouterProviderOrder : process.env.OPENROUTER_PROVIDER_ORDER,
        [constants_1.INPUT_KEYS.OPENROUTER_PROVIDER_ALLOW_FALLBACKS]: options?.openrouterProviderAllowFallbacks?.length > 0 ? options.openrouterProviderAllowFallbacks : process.env.OPENROUTER_PROVIDER_ALLOW_FALLBACKS,
        [constants_1.INPUT_KEYS.OPENROUTER_PROVIDER_REQUIRE_PARAMETERS]: options?.openrouterProviderRequireParameters?.length > 0 ? options.openrouterProviderRequireParameters : process.env.OPENROUTER_PROVIDER_REQUIRE_PARAMETERS,
        [constants_1.INPUT_KEYS.OPENROUTER_PROVIDER_DATA_COLLECTION]: options?.openrouterProviderDataCollection?.length > 0 ? options.openrouterProviderDataCollection : process.env.OPENROUTER_PROVIDER_DATA_COLLECTION,
        [constants_1.INPUT_KEYS.OPENROUTER_PROVIDER_IGNORE]: options?.openrouterProviderIgnore?.length > 0 ? options.openrouterProviderIgnore : process.env.OPENROUTER_PROVIDER_IGNORE,
        [constants_1.INPUT_KEYS.OPENROUTER_PROVIDER_QUANTIZATIONS]: options?.openrouterProviderQuantizations?.length > 0 ? options.openrouterProviderQuantizations : process.env.OPENROUTER_PROVIDER_QUANTIZATIONS,
        [constants_1.INPUT_KEYS.OPENROUTER_PROVIDER_SORT]: options?.openrouterProviderSort?.length > 0 ? options.openrouterProviderSort : process.env.OPENROUTER_PROVIDER_SORT,
        [constants_1.INPUT_KEYS.AI_IGNORE_FILES]: options?.aiIgnoreFiles?.length > 0 ? options.aiIgnoreFiles : process.env.AI_IGNORE_FILES,
        [constants_1.INPUT_KEYS.AI_INCLUDE_REASONING]: options?.includeReasoning?.length > 0 ? options.includeReasoning : process.env.AI_INCLUDE_REASONING,
        repo: {
            owner: gitInfo.owner,
            repo: gitInfo.repo,
        },
        commits: {
            ref: `refs/heads/${options.branch}`,
        },
    };
    const issueRepository = new issue_repository_1.IssueRepository();
    const isIssue = await issueRepository.isIssue(gitInfo.owner, gitInfo.repo, parseInt(options.issue), params[constants_1.INPUT_KEYS.TOKEN] ?? '');
    const isPullRequest = await issueRepository.isPullRequest(gitInfo.owner, gitInfo.repo, parseInt(options.issue), params[constants_1.INPUT_KEYS.TOKEN] ?? '');
    if (isIssue) {
        params.eventName = 'issue_comment';
        params.issue = {
            number: parseInt(options.issue),
        };
        params.comment = {
            body: commentBody,
        };
    }
    else if (isPullRequest) {
        params.eventName = 'pull_request_review_comment';
        params.pull_request = {
            number: parseInt(options.issue),
        };
        params.pull_request_review_comment = {
            body: commentBody,
        };
    }
    params[constants_1.INPUT_KEYS.WELCOME_TITLE] = '🚀 Asking AI started';
    params[constants_1.INPUT_KEYS.WELCOME_MESSAGES] = [
        `Asking AI on ${gitInfo.owner}/${gitInfo.repo}/${options.branch}...`,
    ];
    (0, local_action_1.runLocalAction)(params);
});
program.parse(process.argv);

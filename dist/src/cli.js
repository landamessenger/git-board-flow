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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const constants_1 = require("./utils/constants");
const local_action_1 = require("./actions/local_action");
const dotenv = __importStar(require("dotenv"));
const child_process_1 = require("child_process");
const boxen_1 = __importDefault(require("boxen"));
const chalk_1 = __importDefault(require("chalk"));
const logger_1 = require("./utils/logger");
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
    .name('git-board-flow')
    .description('CLI tool for Git Board Flow')
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
        [constants_1.INPUT_KEYS.SINGLE_ACTION]: 'vector_action',
        [constants_1.INPUT_KEYS.SINGLE_ACTION_ISSUE]: options.issue,
        [constants_1.INPUT_KEYS.SUPABASE_URL]: process.env.SUPABASE_URL,
        [constants_1.INPUT_KEYS.SUPABASE_KEY]: process.env.SUPABASE_KEY,
        [constants_1.INPUT_KEYS.TOKEN]: process.env.PERSONAL_ACCESS_TOKEN,
        [constants_1.INPUT_KEYS.AI_IGNORE_FILES]: 'dist/*,bin/*',
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
    (0, logger_1.logInfo)((0, boxen_1.default)(chalk_1.default.cyan('🚀 Vectorization started\n') +
        chalk_1.default.gray(`Processing code blocks on ${gitInfo.owner}/${gitInfo.repo}/${options.branch}...`), {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan',
        title: 'Git Board Flow',
        titleAlignment: 'center'
    }));
    (0, local_action_1.runLocalAction)(params);
});
program.parse(process.argv);

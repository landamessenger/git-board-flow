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
const commander_1 = require("commander");
const constants_1 = require("./utils/constants");
const local_action_1 = require("./actions/local_action");
const dotenv = __importStar(require("dotenv"));
// Load environment variables from .env file
dotenv.config();
const program = new commander_1.Command();
program
    .name('git-board-flow')
    .description('CLI tool for Git Board Flow')
    .version('1.0.0');
program
    .command('build-ai')
    .description('Build AI')
    .action(() => {
    const params = {
        [constants_1.INPUT_KEYS.DEBUG]: 'true',
        [constants_1.INPUT_KEYS.SINGLE_ACTION]: 'vector_action',
        [constants_1.INPUT_KEYS.SINGLE_ACTION_ISSUE]: '1',
        [constants_1.INPUT_KEYS.SUPABASE_URL]: process.env.SUPABASE_URL,
        [constants_1.INPUT_KEYS.SUPABASE_KEY]: process.env.SUPABASE_KEY,
        [constants_1.INPUT_KEYS.TOKEN]: process.env.PERSONAL_ACCESS_TOKEN,
        [constants_1.INPUT_KEYS.AI_IGNORE_FILES]: 'dist/*,bin/*',
        repo: {
            owner: 'landamessenger',
            repo: 'git-board-flow',
        },
        commits: {
            ref: 'refs/heads/master',
        },
        issue: {
            number: 1,
        },
    };
    (0, local_action_1.runLocalAction)(params);
});
program.parse(process.argv);

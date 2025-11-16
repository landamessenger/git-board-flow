/**
 * TEC (TypeScript Error Checker) Tester Commands
 * CLI commands for testing error detection system
 */

import * as dotenv from 'dotenv';
import * as github from '@actions/github';
import { Command } from 'commander';
import { ErrorDetector, ErrorDetectionOptions } from './agent/reasoning/error_detector/index';
import { logInfo, logError, logWarn } from './utils/logger';
import { execSync } from 'child_process';

// Load environment variables from .env file
dotenv.config();

// Function to get git repository info (same as in cli.ts)
function getGitInfo() {
  try {
    const remoteUrl = execSync('git config --get remote.origin.url').toString().trim();
    const match = remoteUrl.match(/github\.com[/:]([^/]+)\/([^/]+)(?:\.git)?$/);
    if (!match) {
      return null;
    }
    return {
      owner: match[1],
      repo: match[2].replace('.git', '')
    };
  } catch (error) {
    return null;
  }
}

// Function to get default branch from GitHub
async function getDefaultBranch(owner: string, repo: string, token: string): Promise<string> {
  try {
    const octokit = github.getOctokit(token);
    const { data } = await octokit.rest.repos.get({
      owner,
      repo
    });
    return data.default_branch || 'master';
  } catch (error) {
    logWarn(`⚠️ Could not fetch default branch, using 'master' as fallback: ${error}`);
    return 'master';
  }
}

export function registerTECTestCommands(program: Command) {
  /**
   * Detect errors in the codebase
   */
  program
    .command('tec:detect-errors')
    .description('Detect potential errors in the codebase using Agent SDK')
    .option('-p, --prompt <prompt>', 'Optional: Custom detection prompt (system prompt already has all instructions)')
    .option('-m, --model <model>', 'OpenRouter model', process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini')
    .option('-k, --api-key <key>', 'OpenRouter API key', process.env.OPENROUTER_API_KEY)
    .option('--max-turns <number>', 'Maximum turns', '30')
    .option('--focus <areas...>', 'Focus on specific areas (e.g., src/agent src/utils)', [])
    .option('--error-types <types...>', 'Types of errors to look for', [])
    .option('--owner <owner>', 'GitHub repository owner (auto-detected if not provided)')
    .option('--repo <repo>', 'GitHub repository name (auto-detected if not provided)')
    .option('--target-file <file>', 'Specific file to analyze along with its consumers (files that import/use it)')
    .option('--include-dependencies', 'Also analyze files that the target file depends on', false)
    .option('--output <format>', 'Output format (text|json)', 'text')
    .action(async (options) => {
      if (!options.apiKey) {
        logError('❌ API key required. Set OPENROUTER_API_KEY or use -k flag');
        process.exit(1);
      }

      try {
        logInfo('🔍 Starting error detection...');

        // Get repository info
        const gitInfo = getGitInfo();
        const owner = options.owner || gitInfo?.owner;
        const repo = options.repo || gitInfo?.repo;

        if (!owner || !repo) {
          logInfo('⚠️ Repository info not found. Using local file system only.');
        } else {
          logInfo(`📂 Repository: ${owner}/${repo}`);
        }

        // Create error detector
        const detectorOptions: ErrorDetectionOptions = {
          model: options.model,
          apiKey: options.apiKey,
          maxTurns: parseInt(options.maxTurns),
          repositoryOwner: owner,
          repositoryName: repo,
          focusAreas: options.focus.length > 0 ? options.focus : undefined,
          errorTypes: options.errorTypes.length > 0 ? options.errorTypes : undefined,
          useSubAgents: true, // Enable subagents by default for parallel processing
          maxConcurrentSubAgents: 5,
          targetFile: options.targetFile,
          includeDependencies: options.includeDependencies || false
        };

        const detector = new ErrorDetector(detectorOptions);

        // Detect errors
        // Prompt is optional - systemPrompt already has all instructions
        // Use prompt only for specific customization (e.g., "focus on security issues")
        const result = await detector.detectErrors(options.prompt || undefined);

        // Output results
        const { errors, summary, agentResult } = result;
        
        if (options.output === 'json') {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        // Text output (default)
        const severityEmojis = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' } as const;
        const severityOrder: Array<keyof typeof severityEmojis> = ['critical', 'high', 'medium', 'low'];

        // Summary section
        console.log('\n' + '='.repeat(80));
        console.log('📊 ERROR DETECTION SUMMARY');
        console.log('='.repeat(80));
        console.log(`\nTotal errors found: ${summary.total}`);
        console.log(`\nBy Severity:`);
        severityOrder.forEach(severity => {
          console.log(`  ${severityEmojis[severity]} ${severity.charAt(0).toUpperCase() + severity.slice(1)}: ${summary.bySeverity[severity]}`);
        });
        
        if (Object.keys(summary.byType).length > 0) {
          console.log(`\nBy Type:`);
          Object.entries(summary.byType).forEach(([type, count]) => {
            console.log(`  ${type}: ${count}`);
          });
        }

        // Errors section
        if (errors.length > 0) {
          console.log(`\n${'='.repeat(80)}`);
          console.log('📋 DETECTED ERRORS');
          console.log('='.repeat(80));

          severityOrder.forEach(severity => {
            const severityErrors = errors.filter(e => e.severity === severity);
            if (severityErrors.length > 0) {
              console.log(`\n${severityEmojis[severity]} ${severity.toUpperCase()} (${severityErrors.length})`);
              console.log('-'.repeat(80));
              severityErrors.forEach(error => {
                console.log(`\nFile: ${error.file}${error.line ? `:${error.line}` : ''}`);
                console.log(`Type: ${error.type}`);
                console.log(`Description: ${error.description}`);
                if (error.suggestion) {
                  console.log(`Suggestion: ${error.suggestion}`);
                }
              });
            }
          });
        } else {
          console.log('\n✅ No errors detected!');
        }

        // Agent stats section
        console.log(`\n${'='.repeat(80)}`);
        console.log(`📈 Agent Stats:`);
        console.log(`  Turns: ${agentResult.turns.length}`);
        console.log(`  Tool Calls: ${agentResult.toolCalls.length}`);
        if (agentResult.metrics) {
          const { totalTokens, totalDuration } = agentResult.metrics;
          console.log(`  Tokens: ${totalTokens.input + totalTokens.output}`);
          console.log(`  Duration: ${totalDuration}ms`);
        }

        logInfo('✅ Error detection completed');
        process.exit(0);
      } catch (error: any) {
        logError(`❌ Error detection failed: ${error.message}`);
        console.error(error);
        process.exit(1);
      }
    });

  /**
   * Quick error check (faster, fewer turns)
   */
  program
    .command('tec:quick-check')
    .description('Quick error check (faster, fewer turns)')
    .option('-m, --model <model>', 'OpenRouter model', process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini')
    .option('-k, --api-key <key>', 'OpenRouter API key', process.env.OPENROUTER_API_KEY)
    .option('--focus <areas...>', 'Focus on specific areas', [])
    .action(async (options) => {
      if (!options.apiKey) {
        logError('❌ API key required. Set OPENROUTER_API_KEY or use -k flag');
        process.exit(1);
      }

      try {
        logInfo('⚡ Quick error check...');

        const gitInfo = getGitInfo();
            const detector = new ErrorDetector({
              model: options.model,
              apiKey: options.apiKey,
              maxTurns: 10, // Fewer turns for quick check
              repositoryOwner: gitInfo?.owner,
              repositoryName: gitInfo?.repo,
              focusAreas: options.focus.length > 0 ? options.focus : undefined,
              useSubAgents: true, // Enable subagents for parallel processing
              maxConcurrentSubAgents: 3 // Fewer subagents for quick check
            });

        // Quick check: no custom prompt needed, systemPrompt already has instructions
        // Focus on critical/high severity errors is handled by errorTypes option
        const result = await detector.detectErrors();

        console.log(`\n⚡ Quick Check Results:`);
        console.log(`  Critical: ${result.summary.bySeverity.critical}`);
        console.log(`  High: ${result.summary.bySeverity.high}`);
        console.log(`  Medium: ${result.summary.bySeverity.medium}`);
        console.log(`  Low: ${result.summary.bySeverity.low}`);

        if (result.summary.bySeverity.critical > 0 || result.summary.bySeverity.high > 0) {
          console.log(`\n⚠️ Found ${result.summary.bySeverity.critical + result.summary.bySeverity.high} critical/high severity errors!`);
          process.exit(1);
        } else {
          console.log(`\n✅ No critical or high severity errors found.`);
          process.exit(0);
        }
      } catch (error: any) {
        logError(`❌ Quick check failed: ${error.message}`);
        process.exit(1);
      }
    });
}


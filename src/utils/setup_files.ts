import * as fs from 'fs';
import * as path from 'path';
import { logInfo } from './logger';

/**
 * Ensure .github, .github/workflows and .github/ISSUE_TEMPLATE exist; create them if missing.
 * @param cwd - Directory (repo root)
 */
export function ensureGitHubDirs(cwd: string): void {
  const githubDir = path.join(cwd, '.github');
  const workflowsDir = path.join(cwd, '.github', 'workflows');
  const issueTemplateDir = path.join(cwd, '.github', 'ISSUE_TEMPLATE');
  if (!fs.existsSync(githubDir)) {
    logInfo('📁 Creating .github/...');
    fs.mkdirSync(githubDir, { recursive: true });
  }
  if (!fs.existsSync(workflowsDir)) {
    logInfo('📁 Creating .github/workflows/...');
    fs.mkdirSync(workflowsDir, { recursive: true });
  }
  if (!fs.existsSync(issueTemplateDir)) {
    logInfo('📁 Creating .github/ISSUE_TEMPLATE/...');
    fs.mkdirSync(issueTemplateDir, { recursive: true });
  }
}

/**
 * Copy setup files from setup/ to repo (.github/ workflows, ISSUE_TEMPLATE, pull_request_template.md, .env at root).
 * Skips files that already exist at destination (no overwrite).
 * Logs each file copied or skipped. No-op if setup/ does not exist.
 * @param cwd - Repo root
 * @returns { copied, skipped }
 */
export function copySetupFiles(cwd: string): { copied: number; skipped: number } {
  const setupDir = path.join(cwd, 'setup');
  if (!fs.existsSync(setupDir)) return { copied: 0, skipped: 0 };

  let copied = 0;
  let skipped = 0;
  const workflowsSrc = path.join(setupDir, 'workflows');
  const workflowsDst = path.join(cwd, '.github', 'workflows');
  if (fs.existsSync(workflowsSrc)) {
    const files = fs.readdirSync(workflowsSrc).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
    for (const f of files) {
      const src = path.join(workflowsSrc, f);
      const dst = path.join(workflowsDst, f);
      if (fs.statSync(src).isFile()) {
        if (fs.existsSync(dst)) {
          logInfo(`  ⏭️  .github/workflows/${f} already exists; skipping.`);
          skipped += 1;
        } else {
          fs.copyFileSync(src, dst);
          logInfo(`  ✅ Copied setup/workflows/${f} → .github/workflows/${f}`);
          copied += 1;
        }
      }
    }
  }
  const issueTemplateSrc = path.join(setupDir, 'ISSUE_TEMPLATE');
  const issueTemplateDst = path.join(cwd, '.github', 'ISSUE_TEMPLATE');
  if (fs.existsSync(issueTemplateSrc)) {
    const files = fs.readdirSync(issueTemplateSrc).filter((f) => fs.statSync(path.join(issueTemplateSrc, f)).isFile());
    for (const f of files) {
      const src = path.join(issueTemplateSrc, f);
      const dst = path.join(issueTemplateDst, f);
      if (fs.existsSync(dst)) {
        logInfo(`  ⏭️  .github/ISSUE_TEMPLATE/${f} already exists; skipping.`);
        skipped += 1;
      } else {
        fs.copyFileSync(src, dst);
        logInfo(`  ✅ Copied setup/ISSUE_TEMPLATE/${f} → .github/ISSUE_TEMPLATE/${f}`);
        copied += 1;
      }
    }
  }
  const prTemplateSrc = path.join(setupDir, 'pull_request_template.md');
  const prTemplateDst = path.join(cwd, '.github', 'pull_request_template.md');
  if (fs.existsSync(prTemplateSrc)) {
    if (fs.existsSync(prTemplateDst)) {
      logInfo('  ⏭️  .github/pull_request_template.md already exists; skipping.');
      skipped += 1;
    } else {
      fs.copyFileSync(prTemplateSrc, prTemplateDst);
      logInfo('  ✅ Copied setup/pull_request_template.md → .github/pull_request_template.md');
      copied += 1;
    }
  }
  const envSrc = path.join(setupDir, '.env');
  const envDst = path.join(cwd, '.env');
  if (fs.existsSync(envSrc) && fs.statSync(envSrc).isFile()) {
    if (fs.existsSync(envDst)) {
      logInfo('  ⏭️  .env already exists; skipping.');
      skipped += 1;
    } else {
      fs.copyFileSync(envSrc, envDst);
      logInfo('  ✅ Copied setup/.env → .env');
      copied += 1;
    }
  }
  return { copied, skipped };
}

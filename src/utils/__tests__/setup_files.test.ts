import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ensureGitHubDirs, copySetupFiles } from '../setup_files';

jest.mock('../logger', () => ({
  logInfo: jest.fn(),
}));

describe('setup_files', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'setup_files_test_'));
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe('ensureGitHubDirs', () => {
    it('creates .github, .github/workflows and .github/ISSUE_TEMPLATE when they do not exist', () => {
      ensureGitHubDirs(tmpDir);
      expect(fs.existsSync(path.join(tmpDir, '.github'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, '.github', 'workflows'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, '.github', 'ISSUE_TEMPLATE'))).toBe(true);
    });

    it('does not fail when directories already exist', () => {
      fs.mkdirSync(path.join(tmpDir, '.github'), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, '.github', 'workflows'), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, '.github', 'ISSUE_TEMPLATE'), { recursive: true });
      expect(() => ensureGitHubDirs(tmpDir)).not.toThrow();
      expect(fs.existsSync(path.join(tmpDir, '.github', 'workflows'))).toBe(true);
    });
  });

  describe('copySetupFiles', () => {
    it('returns { copied: 0, skipped: 0 } when setup/ does not exist', () => {
      const result = copySetupFiles(tmpDir);
      expect(result).toEqual({ copied: 0, skipped: 0 });
    });

    it('copies workflow yml files from setup/workflows to .github/workflows', () => {
      fs.mkdirSync(path.join(tmpDir, 'setup', 'workflows'), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, '.github', 'workflows'), { recursive: true });
      const workflowContent = 'name: test';
      fs.writeFileSync(path.join(tmpDir, 'setup', 'workflows', 'ci.yml'), workflowContent);
      const result = copySetupFiles(tmpDir);
      expect(result.copied).toBe(1);
      expect(fs.readFileSync(path.join(tmpDir, '.github', 'workflows', 'ci.yml'), 'utf8')).toBe(workflowContent);
    });

    it('skips workflow file when destination already exists', () => {
      fs.mkdirSync(path.join(tmpDir, 'setup', 'workflows'), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, '.github', 'workflows'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'setup', 'workflows', 'ci.yml'), 'from-setup');
      fs.writeFileSync(path.join(tmpDir, '.github', 'workflows', 'ci.yml'), 'existing');
      const result = copySetupFiles(tmpDir);
      expect(result.skipped).toBe(1);
      expect(result.copied).toBe(0);
      expect(fs.readFileSync(path.join(tmpDir, '.github', 'workflows', 'ci.yml'), 'utf8')).toBe('existing');
    });

    it('copies ISSUE_TEMPLATE files when setup/ISSUE_TEMPLATE exists', () => {
      fs.mkdirSync(path.join(tmpDir, 'setup', 'ISSUE_TEMPLATE'), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, '.github', 'ISSUE_TEMPLATE'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'setup', 'ISSUE_TEMPLATE', 'bug_report.yml'), 'title: Bug');
      const result = copySetupFiles(tmpDir);
      expect(result.copied).toBe(1);
      expect(fs.readFileSync(path.join(tmpDir, '.github', 'ISSUE_TEMPLATE', 'bug_report.yml'), 'utf8')).toBe('title: Bug');
    });

    it('copies pull_request_template.md when it exists in setup/', () => {
      fs.mkdirSync(path.join(tmpDir, 'setup'), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, '.github'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'setup', 'pull_request_template.md'), '# PR template');
      const result = copySetupFiles(tmpDir);
      expect(result.copied).toBe(1);
      expect(fs.readFileSync(path.join(tmpDir, '.github', 'pull_request_template.md'), 'utf8')).toBe('# PR template');
    });

    it('copies .env when it exists in setup/ and is a file', () => {
      fs.mkdirSync(path.join(tmpDir, 'setup'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'setup', '.env'), 'SECRET=xxx');
      const result = copySetupFiles(tmpDir);
      expect(result.copied).toBe(1);
      expect(fs.readFileSync(path.join(tmpDir, '.env'), 'utf8')).toBe('SECRET=xxx');
    });

    it('skips .env when destination .env already exists', () => {
      fs.mkdirSync(path.join(tmpDir, 'setup'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'setup', '.env'), 'from-setup');
      fs.writeFileSync(path.join(tmpDir, '.env'), 'existing');
      const result = copySetupFiles(tmpDir);
      expect(result.skipped).toBe(1);
      expect(fs.readFileSync(path.join(tmpDir, '.env'), 'utf8')).toBe('existing');
    });
  });
});

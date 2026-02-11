/**
 * Pre-commit hook: run build, test, and lint before allowing a commit.
 * Cross-platform (Windows, macOS, Linux). Invoked by the pre-commit shell launcher.
 * On Windows, Git for Windows runs the launcher with Bash, which then runs this script with Node.
 */

const { spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const opts = { cwd: root, stdio: 'inherit', shell: true }; // shell: true so "npm" works on Windows (npm.cmd)

function run(name, args) {
  const r = spawnSync(name, args, opts);
  if (r.status !== 0) {
    process.exit(r.status);
  }
}

run('npm', ['run', 'build']);
run('npm', ['test']);
run('npm', ['run', 'lint']);

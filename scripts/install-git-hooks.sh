#!/bin/sh
# Installs git hooks from scripts/git-hooks/ into .git/hooks/.
# Run automatically on npm install, or manually: ./scripts/install-git-hooks.sh

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOKS_SRC="$ROOT/scripts/git-hooks"
HOOKS_DST="$ROOT/.git/hooks"

[ -d "$ROOT/.git" ] || exit 0
[ -d "$HOOKS_SRC" ] || exit 0
[ -d "$HOOKS_DST" ] || exit 0

for hook in "$HOOKS_SRC"/*; do
  [ -f "$hook" ] || continue
  name=$(basename "$hook")
  cp "$hook" "$HOOKS_DST/$name"
  chmod +x "$HOOKS_DST/$name"
  echo "Installed hook: $name"
done

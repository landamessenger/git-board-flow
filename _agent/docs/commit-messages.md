---
name: CommitMessages
description: Specific nomenclature and branch-prefix requirements for commits.
---

# Commit messages

The commit message must use the **current branch name as prefix**, with any `/` replaced by `-`.

## Format

```
<normalized-branch>: <short description>

[optional body]
```

- **Prefix**: current branch name, replacing `/` with `-`. Example: branch `feature/292-github-action-rename` → prefix `feature-292-github-action-rename`.
- **Description**: imperative, lowercase, no trailing period. You may optionally include conventional type (`feat`, `fix`, `docs`, etc.) in the description.

## Examples

Branch `feature-292-github-action-rename`:

- `feature-292-github-action-rename: add concurrency and permissions to ci_check`
- `feature-292-github-action-rename: fix docs callouts (Info instead of Note/Tip)`

Branch `fix/123-docs-anchor` (normalized to `fix-123-docs-anchor`):

- `fix-123-docs-anchor: remove invalid MDX heading anchors`

When suggesting or writing a commit message, use the current branch with `/` replaced by `-` as the prefix. If you don't know the branch, tell the user to use their branch name as the prefix.

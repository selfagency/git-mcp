---
name: jj-workflow
description: Use this skill when a repository may be managed by Jujutsu (`jj`). Detect jj availability and management with git_jj_check, then prefer the `jj` CLI for all version control operations in jj-managed repositories. git-mcp tools operate on the underlying .git and will not reflect jj's change model (working-copy commit, bookmarks, operation log).
---

# Jujutsu (jj) Workflow

Jujutsu is a distinct VCS with its own change model — a working-copy commit, bookmarks instead of branches, and an operation log for undo/redo — layered over a `.git` repository. git-mcp's plain-Git tools operate on the underlying `.git` and will not reflect jj's model, so agents should prefer the `jj` CLI directly in jj-managed repositories.

## When to use this skill

- The repository is jj-managed (has a `.jj/` directory).
- You need to edit history, manage bookmarks, or work with jj's change model.
- You are about to use git-mcp tools on a repo that may be jj-managed.

## Detect first

Call `git_jj_check` before any Git operation. It reports whether `jj` is installed and whether the repo is jj-managed.

- jj-managed → **prefer the `jj` CLI** for all version control operations.
- jj-managed but `jj` not installed → install Jujutsu (https://jj-vcs.dev) before making VCS changes.
- Not jj-managed → use git-mcp tools normally.

## Git-to-jj map

| git                      | jj                                                             |
| ------------------------ | -------------------------------------------------------------- |
| `git status`             | `jj status`                                                    |
| `git commit`             | `jj commit` (or `jj describe` to edit the working-copy commit) |
| `git branch`             | `jj bookmark`                                                  |
| `git rebase -i`          | `jj rebase`, `jj squash`, `jj split`, `jj parallelize`         |
| `git stash`              | jj working-copy model (no stash needed)                        |
| `git reflog`             | `jj operation log`                                             |
| `git reset`              | `jj restore` / `jj abandon`                                    |
| `git cherry-pick`        | `jj duplicate` / `jj rebase -r`                                |
| `git push`               | `jj git push`                                                  |
| `git fetch` / `git pull` | `jj git fetch`                                                 |
| `git undo`               | `jj undo` / `jj redo`                                          |

## Key command patterns

- Commit the working copy: `jj commit -m "message"`.
- Create a new change: `jj new` (edit it in the working copy).
- Edit history: `jj rebase -r <rev> -d <dest>`, `jj squash`, `jj split`.
- Manage bookmarks: `jj bookmark create <name>`, `jj bookmark move`, `jj bookmark list`.
- Push to remote: `jj git push`.
- Recovery: `jj operation log` to inspect, `jj undo` / `jj redo` to revert.

## Colocation caveat

In a colocated repo (`jj git colocation status`), git-mcp writes are visible to jj, but jj's working-copy commit model still diverges from plain Git. Prefer `jj` for history edits and commit management; use git-mcp only for operations jj does not cover.

## Safety

- Never run `git commit`, `git rebase`, `git reset`, `git stash`, or `git cherry-pick` on a jj-managed repo — translate to `jj`.
- Read-only git inspection is allowed, but prefer `jj log` / `jj show` for jj-managed repos.

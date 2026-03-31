---
name: git-mcp-workflow
description: 'Use for repositories managed through the git-mcp server when an agent needs to inspect repository state, create commits, manage branches and remotes, rebase, cherry-pick, stash, bisect, work with worktrees, handle Git Flow, manage tags, recover from mistakes, or explain Git concepts using MCP tools instead of raw git CLI commands. Especially relevant for prompts about git_status, git_commit, git_push, git_rebase, git_cherry_pick, git_worktree, git_stash, git_reflog, git_flow, git_lfs, submodules, PR preparation, release tagging, and Git recovery.'
---

# Git MCP Workflow

An MCP-first workflow skill for repositories exposed through `git-mcp`.

This skill adapts common Git guidance for a world where the preferred interface is the server's tool catalog, not ad-hoc shell commands. It covers both everyday Git work and the spicier recovery and history-editing cases.

## When to Use This Skill

Use this skill when you need to:

- Inspect repository state before making changes
- Stage, commit, branch, fetch, pull, and push via MCP tools
- Rebase, cherry-pick, stash, bisect, tag, or use worktrees
- Recover from resets, detached HEAD, or other Git mishaps
- Choose between GitHub Flow, Git Flow, trunk-based, or release workflows
- Prepare a branch for review or release while preserving safety
- Explain Git concepts in terms of the `git-mcp` tool surface

## Core Operating Rules

### 1. Start with context, not vibes

For any non-trivial task, begin with:

1. `git_context_summary`
2. `git_status`
3. Any targeted inspect call you need next, usually `git_log`, `git_diff`, `git_show`, or `git_list_branches`

Treat `git_context_summary` as the default entry point. It reports branch, upstream, pending changes, and in-progress operations like rebase, cherry-pick, merge, or bisect.

### 2. Inspect before mutate

Prefer read-only tools first:

- `git_context_summary`
- `git_status`
- `git_log`
- `git_show`
- `git_diff`
- `git_blame`
- `git_reflog`
- `git_list_branches`
- `git_list_remotes`
- `git_search`
- `git_docs`

Only mutate after you understand:

- current branch
- tracking branch and ahead/behind state
- whether the tree is clean or dirty
- whether a merge, rebase, cherry-pick, or bisect is already in progress

### 3. Prefer the safest reversible operation

Safety order for undo and recovery:

1. `git_restore` for uncommitted file changes
2. `git_stash` when switching context without losing work
3. `git_revert` for undoing published commits
4. `git_reset` only for local unpublished history
5. `git_reset` with `mode: "hard"` only with explicit user intent and `confirm: true`

Before any history-rewriting step, capture context with `git_reflog` and usually `git_log`.

### 4. Treat published history as radioactive

Rewriting history is allowed only when the user clearly wants it and the branch is safe to rewrite.

Use these rules:

- Rebase only on unpublished or explicitly approved branches
- After rebasing, prefer `git_push` with `force_with_lease: true`
- Avoid unconditional force pushes unless the user explicitly requests them and server config allows them
- Prefer `git_revert` over `git_reset` for shared branches

### 5. Respect hooks and CI

Do not bypass hooks casually.

- `git_commit.no_verify` and `git_push.no_verify` should stay `false` unless the user explicitly requests a bypass and the server is configured to allow it
- If hooks fail, fix the root cause rather than reaching for the eject button
- In this repository specifically, `.husky/pre-commit` runs `pnpm exec lint-staged` and `pnpm typecheck`

### 6. Use adjacent tooling only where git-mcp stops

`git-mcp` covers repository operations, not every GitHub action.

Use adjacent tooling when necessary:

- Use GitHub repository or PR tooling for pull requests, review threads, approvals, and GitHub Releases
- Use general workspace file tools for checking `.gitignore`, worktree directories, and project files
- Use the shell only as a last resort for capabilities not exposed by `git-mcp` or companion GitHub tooling

Typical gaps where CLI may still be necessary:

- interactive patch staging like `git add -p`
- interactive rebase editing for squash/reword/reorder/drop flows
- `git filter-repo`-style deep history surgery
- repo-local hook installation commands when a project requires explicit setup

## Recommended Workflow

### Everyday feature work

1. Orient with `git_context_summary`
2. Inspect details with `git_status`, `git_diff`, and `git_log`
3. Create or switch branches with `git_create_branch` or `git_checkout`
4. Stage with `git_add`
5. Commit with `git_commit` using Conventional Commit messages
6. Sync with `git_fetch`, `git_pull`, and `git_push`
7. Prepare reviewable history with `git_rebase` only if safe and explicitly appropriate

### Advanced work

Reach for these tools deliberately:

- `git_stash` for temporary context switches
- `git_rebase` for safe branch cleanup or branch rebasing
- `git_cherry_pick` for backports and targeted fixes
- `git_bisect` for regression hunting
- `git_worktree` for parallel branch work without stashing
- `git_tag` for release tags
- `git_submodule` for embedded repositories
- `git_lfs` for large binary assets
- `git_flow` for scheduled release workflows

## Tool Selection

Read `references/tooling-map.md` for the MCP-first command mapping.

## Playbooks

Read `references/workflow-playbooks.md` for:

- simple feature branch flow
- review-fix and safe rebase flow
- recovery after a bad reset or rebase
- worktree setup guidance
- backport and release tagging playbooks
- hooks and CI guidance

## Git Concepts to Explain Clearly

When the user needs explanation rather than action, anchor your answer in these concepts:

- working tree, index, and committed history
- branches as movable refs
- `HEAD` as the current pointer
- fast-forward versus merge commit history
- local-only history rewriting versus shared history preservation
- reflog as the recovery ledger

Explain the concept using the MCP tool that reveals it:

- status and staging area: `git_status`, `git_diff`, `git_add`, `git_restore`
- refs and branch movement: `git_log`, `git_show`, `git_list_branches`, `git_reflog`
- merge and rebase state: `git_context_summary`, `git_rebase`, `git_cherry_pick`

## Repository-Specific Notes for `git-mcp`

When contributing to this repository itself:

- Use Conventional Commits
- Prefer the documented tool groups in `docs/tools/`
- Run the full gate before declaring work done:
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm format:check`
  - `pnpm test`
- Remember that the project uses `simple-git`, Zod schemas, and safety-first defaults

## References

- `references/tooling-map.md`
- `references/workflow-playbooks.md`
- `docs/tools/index.md`
- `docs/guide/safety.md`
- `docs/development/contributing.md`

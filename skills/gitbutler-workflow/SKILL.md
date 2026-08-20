---
name: gitbutler-workflow
description: Use this skill when a repository may be managed by GitButler. Detect GitButler availability with git_but_check, then prefer the `but` CLI or `but mcp` server for version control in GitButler-managed repositories. Run `but teardown` before using git-mcp tools on a GitButler-managed repo so plain-Git writes do not conflict with GitButler virtual branches.
---

# GitButler Workflow

GitButler is a Git-based workspace model that keeps one working directory while organizing changes into separate virtual branches and commits. Its `but` CLI and `but mcp` server are the preferred interface for GitButler-managed repositories.

## When to use this skill

- The repository is managed by GitButler (or you are unsure).
- You need to commit selected files/hunks, stack branches, or edit history in a GitButler workspace.
- You are about to use git-mcp tools on a repo that may be GitButler-managed.

## Detect first

Call `git_but_check` before any Git operation. It reports whether `but` is installed and returns guidance.

- `but` available → **prefer `but mcp` / `but` commands** for version control.
- `but` available but you must use git-mcp tools → **run `but teardown` first** so plain-Git writes do not fight GitButler's virtual branches.
- `but` absent → use git-mcp tools normally.

## Git-to-But map

| git                                      | but                                                                                                  |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `git status`                             | `but status` (overview) / `but status -fv` (file/hunk details) / `but diff` (selected dirty changes) |
| `git add` + `git commit`                 | `but commit -b <branch> -m "<msg>" <ids>`                                                            |
| `git checkout -b` + commit               | `but commit -b <new-branch> -m ... <ids>`                                                            |
| `git push`                               | `but push <branch-name>`                                                                             |
| `git rebase -i`                          | `but move`, `but squash`, `but reword`                                                               |
| `git rebase --onto`                      | `but move <branch> --above <new-base>`                                                               |
| `git checkout -- <file>` / `git restore` | `but discard <id>`                                                                                   |
| `git cherry-pick`                        | `but pick`                                                                                           |
| `gh pr create`                           | `but pr new <branch-name> -m "Title..."`                                                             |

## Key command patterns

- Commit selected files/hunks: `but diff` to get IDs, then `but commit -b <branch> -m "<msg>" <id> <id>`. `-b` creates the branch if it does not exist.
- Commit everything uncommitted: `but commit -b <branch> -m "<msg>"` (omit IDs).
- Stack branches: `but move <child-branch> --above <parent-branch>` (full branch names).
- Update workspace from target: `but pull` (one command; `but undo` reverts it).
- Create PR: `but pr new <branch-name> [-m "Title..."]` — auto-pushes first; do not run `but push` before it.
- Recovery: `but oplog` to inspect, `but undo` to revert.

## Connecting `but mcp`

The GitButler MCP server exposes GitButler actions to MCP clients. Start it with `but mcp` (or `but mcp --internal` for the internal tool surface).

- Cursor: add `{ "mcpServers": { "gitbutler": { "command": "but", "args": ["mcp"] } } }` to `~/.cursor/mcp.json`.
- VS Code: MCP: List Servers → Add Server → stdio → command `but`, args `["mcp"]`.
- Claude Code: `claude mcp add gitbutler but mcp`.

## Safety

- Never run `git add`, `git commit`, `git push`, `git checkout`, `git merge`, `git rebase`, `git stash`, or `git cherry-pick` on a GitButler-managed repo — translate to `but`.
- Read-only git inspection (`git log`, `git blame`, `git show --stat`) is allowed.
- If `but` prints an `AGENT ACTION REQUIRED` skill warning, run the suggested command once, then reload the GitButler skill.

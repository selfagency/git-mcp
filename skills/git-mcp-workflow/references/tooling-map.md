# git-mcp Tooling Map

This reference translates common Git intentions into the preferred `git-mcp` tool calls.

## First call by default

For almost every workflow, start with:

- `git_context_summary`

Then add targeted inspection as needed.

## Read-only inspection

- See branch, upstream, dirty state, and in-progress operations: `git_context_summary`
  - Best starting point
- See working tree details: `git_status`
  - Good after context summary
- View history: `git_log`
  - Supports filtering and pagination
- Inspect one commit or ref: `git_show`
  - Good before revert or cherry-pick
- Compare changes: `git_diff`
  - Works for unstaged, staged, and ref-to-ref diffs
- Find who changed a line: `git_blame`
  - Useful for targeted archaeology
- Recover movement history: `git_reflog`
  - Safety net before rewriting
- Search history or content: `git_search`
  - Useful for bug origin and archaeology
- Read official Git docs: `git_docs`
  - Use `search` or `man`

## Staging and committing

- Stage files: `git_add`
  - Stages whole files or directories
- Unstage or discard: `git_restore`
  - Use `staged: true` and `worktree: false` to unstage only
- Commit staged changes: `git_commit`
  - Use Conventional Commits
- Amend the last commit: `git_commit` with `amend: true`
  - Set `no_edit: true` to keep the existing message
- Undo the last local commit safely: `git_reset` with `mode: "soft"` or `"mixed"`
  - Prefer `soft` when you want changes to remain staged
- Undo a published commit: `git_revert`
  - Safer than reset for shared history

## Branches and remotes

- List branches: `git_list_branches`
  - Use `all: true` to include remote-tracking refs
- Create a branch: `git_create_branch`
  - Can create from `main`, a tag, or a SHA
- Switch branches: `git_checkout`
  - Also works for tags and commits
- Rename a branch: `git_rename_branch`
  - Local branch only
- Delete a branch: `git_delete_branch`
  - Use `force: true` only when intentional
- Set a tracking branch: `git_set_upstream`
  - Useful after the first push or manual remote setup
- List remotes: `git_list_remotes`
  - Inspect before push or pull
- Add or update a remote: `git_remote`
  - Supports `add`, `remove`, and `set-url`
- Fetch: `git_fetch`
  - Prefer before pull, rebase, or push decisions
- Pull: `git_pull`
  - Use `rebase: true` when linear history is desired
- Push: `git_push`
  - Prefer `force_with_lease: true` over `force: true`

## Advanced operations

- Save temporary work: `git_stash`
  - Use `include_untracked: true` when needed
- Reapply saved work: `git_stash` with `apply` or `pop`
  - `pop` removes the stash after applying it
- Rebase a feature branch: `git_rebase`
  - Supports start, continue, abort, and skip
- Backport a fix: `git_cherry_pick`
  - Use `action: "start"` with `ref` set to the source commit or ref to backport
- Find a regression commit: `git_bisect`
  - Supports manual and command-driven bisect flows
- Create, list, or delete tags: `git_tag`
  - Use annotated tags for releases
- Create a parallel working directory: `git_worktree`
  - Great for hotfix and feature work in parallel
- Manage submodules: `git_submodule`
  - Supports add, list, update, and sync
- Manage large assets: `git_lfs`
  - Includes tracking, transfer, and migration actions
- Run classic or git-flow-next-style workflows: `git_flow`
  - Use `action: "overview"` or `"config-list"` before mutating flow-heavy repos
  - Prefer `operation: "config" | "topic" | "control"` for new integrations
  - Use `topic_action` for start, finish, publish, list, update, delete, rename, checkout, and track on configured topic types
  - Use `control_action: "continue" | "abort"` when a finish flow pauses on conflicts
  - Supports feature, release, hotfix, and support workflows

## Recovery mapping

- Unstaged file changes need discard: `git_restore`
  - Surgical and non-history-rewriting
- A staged change should be unstaged: `git_restore` with `staged: true`, `worktree: false`
  - Keeps working tree edits
- Need to pause changes: `git_stash`
  - Avoids panic-commits
- A local reset or rebase went badly: `git_reflog`, then `git_reset` or `git_cherry_pick`
  - Reflog helps you find the lost commit
- Need to undo a shared commit: `git_revert`
  - Preserves public history
- Detached HEAD but work should be kept: `git_create_branch` from the current ref or `git_checkout` with `create: true`
  - Re-attaches work to a branch

## Release and review mapping

- Prepare a clean review branch: `git_fetch`, `git_rebase`, and `git_push` with `force_with_lease: true`
  - Only on safe-to-rewrite branches
- Create a release tag: `git_tag`
  - Use annotated or signed tags as needed
- Create a GitHub Release: use GitHub tooling, not `git-mcp`
  - The server manages Git tags, not GitHub release objects
- Open or manage a PR: use GitHub tooling, not `git-mcp`
  - Keep Git history preparation in `git-mcp`

## MCP-first safety defaults

- Always inspect before mutating
- Always prefer `git_revert` over `git_reset` for published history
- Always capture `git_reflog` before risky history changes
- Prefer `force_with_lease` over `force`
- Do not use `no_verify` unless the user explicitly requests it and policy allows it

## Capabilities not fully covered by git-mcp

These usually need adjacent tooling or, if unavoidable, the shell:

- interactive patch staging (`git add -p`)
- interactive rebase editing for squash, fixup, reword, reorder, or drop
- `git filter-repo` or equivalent large-scale history rewriting
- GitHub release creation and PR lifecycle management
- hook installation commands specific to local toolchains

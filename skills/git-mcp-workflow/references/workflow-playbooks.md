# MCP-First Workflow Playbooks

These playbooks adapt common Git workflows to `git-mcp`.

## 1. Simple feature branch flow

Use for standard GitHub Flow work.

1. Orient:
   - `git_context_summary`
   - `git_status`
   - `git_log`
2. Sync your base:
   - `git_fetch`
   - `git_checkout` to `main`
   - `git_pull`
3. Create the branch:
   - `git_create_branch` with `from_ref: "main"` and `checkout: true`
4. Inspect edits as you work:
   - `git_diff` for unstaged
   - `git_diff` with `mode: "staged"` after staging
5. Stage and commit:
   - `git_add`
   - `git_commit`
6. Publish:
   - `git_push` with `set_upstream: true`

Guidance:

- Keep commits atomic and reviewable
- Use Conventional Commit messages
- Keep PRs small when possible

## 2. Review-fix cleanup flow

Use when a PR gets feedback and the branch needs cleanup.

1. Inspect branch state:
   - `git_context_summary`
   - `git_status`
   - `git_log`
2. Apply requested fixes and commit them normally
3. If the branch is still private and the user wants a cleaned-up history:
   - `git_fetch`
   - `git_rebase` with `action: "start"` and `onto: "origin/main"` or `main`
4. Resolve conflicts if any, then:
   - `git_add`
   - `git_rebase` with `action: "continue"`
5. Publish rewritten history safely:
   - `git_push` with `force_with_lease: true`

Do not use this on shared/public branches unless the user clearly approves history rewriting.

## 3. Safe recovery after reset, rebase, or detached HEAD

### Bad reset or rebase

1. Capture recovery state:
   - `git_reflog`
   - `git_log`
2. Identify the lost commit or prior `HEAD`
3. Recover with one of:
   - `git_reset` for a local branch state restore
   - `git_cherry_pick` to replay the lost commit onto the current branch
4. Verify with:
   - `git_status`
   - `git_log`

Prefer `git_cherry_pick` when you want a conservative recovery that does not move the branch backward.

### Detached HEAD

1. Confirm state with `git_context_summary` and `git_log`
2. If the work should be preserved, create a branch from the current commit:
   - `git_create_branch` with `from_ref` set to the detached commit and `checkout: true`
3. Continue normal work from the new branch

## 4. Backport or selective fix flow

Use for hotfixes and maintenance branches.

1. Inspect the source commit:
   - `git_show`
   - `git_log`
2. Switch to the target branch:
   - `git_checkout`
3. Apply the fix:
   - `git_cherry_pick` with `action: "start"`
4. If conflicts happen:
   - inspect with `git_status`
   - resolve files
   - `git_add`
   - `git_cherry_pick` with `action: "continue"`
5. Validate and push:
   - `git_log`
   - `git_push`

This is the MCP equivalent of a classic cherry-pick backport workflow.

## 5. Worktree isolation flow

Adapted from worktree best practices, but MCP-first.

### Directory strategy

Prefer this order when choosing a worktree directory:

1. existing `.worktrees/`
2. existing `worktrees/`
3. a documented project preference
4. ask the user

### Safety checks

Before creating a project-local worktree:

- inspect whether the directory already exists using workspace file tools
- inspect `.gitignore` to confirm the directory is ignored
- if it is not ignored, fix that first before creating the worktree

### Creation flow

1. Inspect current repo state:
   - `git_context_summary`
2. Choose location and branch name
3. Create the worktree:
   - `git_worktree` with `action: "add"`, explicit `path`, and `branch`
4. Run project setup and baseline validation using project-appropriate tooling
5. Report the worktree path and whether the baseline is clean

Red flags:

- never create a project-local worktree without checking ignore rules
- never assume a directory convention when the repo already documents one
- never start implementation from a worktree whose baseline is already failing without telling the user

## 6. Stash-driven context switch flow

Use when work is not ready to commit.

1. Inspect what would be stashed:
   - `git_status`
   - `git_diff`
2. Save it:
   - `git_stash` with `action: "save"`
   - set `include_untracked: true` if needed
3. Switch branches or pull changes
4. Restore later with:
   - `git_stash` and `action: "apply"` or `"pop"`
5. Validate re-applied changes with `git_status` and `git_diff`

## 7. Regression hunt with bisect

Use when you know a good state and a bad state.

1. Start with:
   - `git_context_summary`
   - `git_log`
2. Begin bisect:
   - `git_bisect` with `action: "start"`, `good_ref`, and `bad_ref`
3. At each step, test the checked-out revision
4. Mark each step with:
   - `git_bisect` and `action: "good"` or `"bad"`
5. When done, record the culprit commit with `git_show`
6. End the session:
   - `git_bisect` with `action: "reset"`

If the repository supports a reliable command-based test, `git_bisect` with `action: "run"` can automate the search.

## 8. Release tagging and GitHub release flow

### Tagging in git-mcp

1. Confirm release readiness:
   - `git_context_summary`
   - `git_status`
   - `git_log`
2. Verify version files via workspace file reads or project tests
3. Create the tag:
   - `git_tag` with `action: "create"`
   - use `message` for annotated tags
   - use `sign: true` when signatures are required
4. Push the tag:
   - `git_push` with `tags: true`

### GitHub release guidance

GitHub Releases are outside `git-mcp`, so use GitHub tooling for the release object.

Rules to preserve from modern release guidance:

- never delete a published GitHub release to retry it
- if a release is wrong or publish fails, fix forward with the next version
- for maintenance-branch releases, ensure the GitHub release is not marked as latest unless that is intended
- create releases only after the correct commit and version files are verified

## 9. Branching strategy guidance

### GitHub Flow

Prefer for continuous delivery and short-lived branches.

Typical MCP flow:

- `git_fetch`
- `git_checkout` main
- `git_pull`
- `git_create_branch`
- work, `git_add`, `git_commit`, `git_push`
- PR management via GitHub tooling

### Git Flow

Prefer for scheduled releases and release branches.

Use:

- `git_flow` `init`
- `git_flow` `feature-start`
- `git_flow` `feature-finish`
- `git_flow` `release-start`
- `git_flow` `release-finish`
- `git_flow` `hotfix-start`
- `git_flow` `hotfix-finish`

### Trunk-based development

Keep branches extremely short-lived.

Use the same MCP tools as GitHub Flow, but merge much sooner and avoid long-running branches.

## 10. Hooks, CI, and commit discipline

Adapted guidance:

- Do not bypass hooks by default
- If hooks fail, fix the underlying issue
- Use Conventional Commit messages
- Keep commits atomic
- Prefer small PRs with clear summaries and test notes

For this repository specifically:

- pre-commit runs `pnpm exec lint-staged` and `pnpm typecheck`
- before finishing work, run:
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm format:check`
  - `pnpm test`

## 11. When CLI is absolutely necessary

Use the shell only when a required capability is not exposed by `git-mcp` or companion GitHub tooling, for example:

- interactive rebase editing with manual squash/reword/drop choreography
- patch-mode staging
- repository-wide history rewriting such as `git filter-repo`
- project-specific hook installation commands

Even then:

- capture `git_reflog` first
- explain the risk
- prefer the least destructive option

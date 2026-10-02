---
title: Git Worktree Tool
---

`git_worktree` has two backends. Pick by how you want to name the target.

## Path-addressed (plain git)

Needs nothing beyond `git` itself. Identifies worktrees by filesystem path.

| Action | Arguments | Notes |
|---|---|---|
| `list` | — | Porcelain output, stable for parsing. |
| `add` | `path`, plus `branch` or `detached: true` | Refuses to guess: a branch or `detached` is required. |
| `remove` | `path`, optional `force` | |
| `lock` / `unlock` | `path`, optional `lock_reason` | |
| `prune` | optional `expire` | Drops admin entries for directories that are gone. |
| `repair` | optional `paths` | |

```jsonc
{ "action": "add", "path": "../feature-auth", "branch": "feature/auth" }
{ "action": "list" }
```

## Branch-addressed (`git flow worktree`)

Requires [git-flow-next](https://git-flow.sh) on `PATH`. Identifies worktrees by branch name,
computes the path from the `gitflow.worktreePath` template, and records which ones it created.

| Action | Arguments | Notes |
|---|---|---|
| `flow_path` | `branch` | Prints the computed path. Creates nothing. |
| `flow_add` | `branch`, optional `path` | The branch must already exist. `path` overrides the computed one. |
| `flow_remove` | `branch`, optional `force` | **Keeps the branch.** Refuses uncommitted work without `force`. |
| `flow_list` | — | Tags provenance and detached HEADs. |

```jsonc
{ "action": "flow_path",  "branch": "feature/user-auth" }
{ "action": "flow_add",   "branch": "feature/user-auth" }
{ "action": "flow_list" }
```

## Path templates

Set `gitflow.worktreePath` to control where worktrees land. The default is a sibling of the
repository, so worktrees stay out of your file watcher and search results:

```
../<repo>-worktrees/<branch>
```

Variables: `{{ repo }}`, `{{ branch }}`, `{{ topicType }}`.

```bash
# One directory per topic type, under your home directory
git config gitflow.worktreePath '~/worktrees/{{ topicType }}/{{ branch }}'

# A global default for every repository
git config --global gitflow.worktreePath '~/worktrees/{{ repo }}/{{ branch }}'
```

Per-call `path` beats the template without changing it.

## Why provenance matters

git-flow records the worktrees it creates instead of inferring it from disk. That is what makes
cleanup safe: when a branch is finished or deleted, a worktree git-flow created is removed, while
one you made by hand with `git worktree add` is kept and its HEAD detached — so the directory and
every uncommitted change in it survive.

`git_flow` inherits this for `topic_action: "finish"` and `"delete"`. Use `keep_worktree` to route a
git-flow-created worktree through the detach path, or `force_worktree` to remove one that has
uncommitted changes. Both refuse up front if a merge, rebase, bisect, cherry-pick, or revert is in
progress in that worktree.

`flow_remove` names its target explicitly, so it removes the worktree whatever its origin — it does
not try to infer provenance. It never removes the main worktree.

## Differences from plain git

- `lock_reason` is rejected on `flow_add`: `git flow worktree add` has no lock flags.
- `flow_remove` keeps the branch. Plain `git worktree remove` also does, but has no `--force`
  semantics for uncommitted work beyond git's own refusal.
- There is no `flow_lock`, `flow_unlock`, or `flow_repair`. Use the path-addressed actions for those.
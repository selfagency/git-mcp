---
title: Tool Reference
---

git-mcp provides grouped root tools with action-based subtools. Every tool accepts a `repo_path` parameter (the absolute path to the Git repository) unless noted otherwise. When `GIT_REPO_PATH` is configured server-side, `repo_path` is optional.

All tools accept a `response_format` parameter: `"markdown"` (default, human-readable) or `"json"` (machine-friendly structured data).

## Tool Groups

- [Status](/tools/status) — `git_status` with actions `status`, `diff`, `diff_main`.
- [History](/tools/history) — `git_history` with actions `log`, `show`, `blame`, `reflog`, `lg`, `who`.
- [Commits](/tools/commits) — `git_commits` with actions `add`, `restore`, `commit`, `reset`, `revert`, `undo`, `nuke`, `wip`, `unstage`, `amend`.
- [Branches](/tools/branches) — `git_branches` with actions `list`, `create`, `delete`, `rename`, `checkout`, `set_upstream`, `recent`.
- [Remotes](/tools/remotes) — `git_remotes` with actions `list`, `manage`, `fetch`, `pull`, `push`.
- [Workspace](/tools/workspace) — `git_workspace` with actions `stash`, `stash_all`, `rebase`, `cherry_pick`, `bisect`, `tag`, `worktree`, `submodule`.
- [Context](/tools/context) — `git_context` with actions `summary`, `search`, `get_config`, `set_config`, `aliases`.
- [LFS](/tools/lfs) — `git_lfs`: Git Large File Storage.
- [Git Flow](/tools/flow) — `git_flow`: canonical git-flow-next-style operations plus classic aliases.
- [Docs](/tools/docs) — `git_docs`: Git documentation search.

## Common Parameters

These parameters are shared across most tools:

| Parameter         | Type                   | Description                                                                  |
| ----------------- | ---------------------- | ---------------------------------------------------------------------------- |
| `repo_path`       | `string`               | Absolute path to the Git repository. Required unless `GIT_REPO_PATH` is set. |
| `response_format` | `"markdown" \| "json"` | Output format. Defaults to `"markdown"`.                                     |

## Quick Reference

### Status

```text
git_status    repo_path  [action=status|diff|diff_main] [mode] [from_ref] [to_ref] [filtered] [base_branch]
```

### History

```text
git_history   repo_path  [action=log|show|blame|reflog|lg|who] [limit] [offset] [author] [grep] [since] [until] [file_path] [ref]
```

### Commits

```text
git_commits   repo_path  [action=add|restore|commit|reset|revert|undo|nuke|wip|unstage|amend] [all] [paths] [message] [mode] [target] [confirm] [ref]
```

### Branches

```text
git_branches  repo_path  [action=list|create|delete|rename|checkout|set_upstream|recent] [name] [old_name] [new_name] [ref] [from_ref] [branch] [upstream] [count]
```

### Remotes

```text
git_remotes   repo_path  [action=list|manage|fetch|pull|push] [remote_action] [name] [url] [remote] [branch] [prune] [rebase] [set_upstream] [force_with_lease] [force] [no_verify] [tags]
```

### Workspace

```text
git_workspace repo_path [action=stash|stash_all|rebase|cherry_pick|bisect|tag|worktree|submodule] [stash_action] [rebase_action] [cherry_pick_action] [bisect_action] [tag_action] [worktree_action] [submodule_action]
              [message] [index] [include_untracked] [ref] [onto] [good_ref] [bad_ref] [command] [name] [target] [sign] [signing_key] [path] [branch] [url] [recursive]
```

### Context

```text
git_context   repo_path  [action=summary|search|get_config|set_config|aliases] [query] [limit] [key] [value]
```

### LFS tool

```text
git_lfs  repo_path  action  [patterns] [remote] [include] [exclude] [everything]
```

### Git Flow tool

```text
git_flow  repo_path  [action] [operation] [config_action] [topic_action] [control_action] [topic] [name] [new_name] [pattern] [match_mode] [branch_kind] [parent] [prefix] [start_point] [base_ref] [preset] [scope] [config_file] [force] [no_create_branches] [main_branch] [develop_branch] [staging_branch] [production_branch] [remote] [upstream_strategy] [downstream_strategy] [strategy] [fetch] [ff] [keep_branch] [no_backmerge] [rebase_before_finish] [preserve_merges] [publish] [force_delete] [auto_update] [tag] [tag_prefix] [tag_message] [delete_branch]
```

### Docs tool (no repo_path)

```text
git_docs  action  query
```

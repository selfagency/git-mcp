---
title: Tool Reference
---

git-mcp provides 30+ tools organized by function. Every tool accepts a `repo_path` parameter (the absolute path to the Git repository) unless noted otherwise. When `GIT_REPO_PATH` is configured server-side, `repo_path` is optional.

All tools accept a `response_format` parameter: `"markdown"` (default, human-readable) or `"json"` (machine-friendly structured data).

## Tool Groups

- [Inspect](/tools/inspect) — `git_status`, `git_log`, `git_show`, `git_diff`, `git_blame`, `git_reflog`: read-only repository inspection.
- [Write](/tools/write) — `git_add`, `git_restore`, `git_commit`, `git_reset`, `git_revert`: stage, commit, and undo changes.
- [Branch](/tools/branch) — `git_list_branches`, `git_create_branch`, `git_delete_branch`, `git_rename_branch`, `git_checkout`, `git_set_upstream`: branch lifecycle management.
- [Remote](/tools/remote) — `git_list_remotes`, `git_remote`, `git_fetch`, `git_pull`, `git_push`: remote and transport operations.
- [Advanced](/tools/advanced) — `git_stash`, `git_rebase`, `git_cherry_pick`, `git_bisect`, `git_tag`, `git_worktree`, `git_submodule`: stash, rebase, tags, worktrees, and submodules.
- [Context](/tools/context) — `git_context_summary`, `git_search`, `git_get_config`, `git_set_config`: repository context and configuration.
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

### Inspect tools

```text
git_status    repo_path
git_log       repo_path  [limit] [offset] [author] [grep] [since] [until] [file_path]
git_show      repo_path  ref
git_diff      repo_path  [mode] [from_ref] [to_ref] [filtered]
git_blame     repo_path  file_path  [ref]
git_reflog    repo_path  [limit]
```

### Write tools

```text
git_add       repo_path  [all] [paths]
git_restore   repo_path  paths  [staged] [worktree] [source]
git_commit    repo_path  message  [all] [amend] [no_edit] [sign] [signing_key] [no_verify]
git_reset     repo_path  [mode] [target] [paths] [confirm]
git_revert    repo_path  ref  [no_commit] [mainline]
```

### Branch tools

```text
git_list_branches   repo_path  [all]
git_create_branch   repo_path  name  [from_ref] [checkout]
git_delete_branch   repo_path  name  [force]
git_rename_branch   repo_path  old_name  new_name
git_checkout        repo_path  ref  [create]
git_set_upstream    repo_path  branch  upstream
```

### Remote tools

```text
git_list_remotes  repo_path
git_remote        repo_path  action  name  [url]
git_fetch         repo_path  [remote] [branch] [prune]
git_pull          repo_path  [remote] [branch] [rebase]
git_push          repo_path  [remote] [branch] [set_upstream] [force_with_lease] [force] [no_verify] [tags]
```

### Advanced tools

```text
git_stash        repo_path  action  [message] [index] [include_untracked]
git_rebase       repo_path  action  [onto]
git_cherry_pick  repo_path  action  [ref]
git_bisect       repo_path  action  [ref] [good_ref] [bad_ref] [command]
git_tag          repo_path  action  [name] [target] [message] [sign] [signing_key]
git_worktree     repo_path  action  [path] [branch]
git_submodule    repo_path  action  [url] [path] [recursive]
```

### Context & config tools

```text
git_context_summary  repo_path
git_search           repo_path  query  [limit]
git_get_config       repo_path  [key]
git_set_config       repo_path  key  value
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

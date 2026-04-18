---
title: Workflow Tools
---

## git_workflow

Run named multi-step workflows with resumable lifecycle controls. This tool is designed for common orchestration patterns so agents can avoid long chains of ad-hoc Git commands.

### Lifecycle actions

- `start` — start a new workflow execution
- `status` — read the current active workflow state
- `continue` — continue a paused workflow (for example after resolving conflicts)
- `abort` — abort the active workflow and run best-effort abort commands
- `list` — list supported workflow families

### Supported workflow families

- `snapshot` — combined inspection snapshot (remotes, branches, merge-base, graph log, status)
- `replay` — replay changes through `cherry-pick` series or `git am` patch series
- `branch_surgery` — backup branch + checkout/reset + replay + optional publish
- `publish` — fetch, optional rebase, and push with guarded options

### Parameters

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `repo_path` | `string` | * | — | Absolute path to Git repo unless server default is configured |
| `action` | `"start" \| "status" \| "continue" \| "abort" \| "list"` | no | `"start"` | Lifecycle action |
| `workflow` | `"snapshot" \| "replay" \| "branch_surgery" \| "publish"` | for `start` | — | Workflow family |
| `base_branch` | `string` | no | `main` | Snapshot merge-base branch |
| `log_count` | `number` | no | `12` | Snapshot graph log size |
| `mode` | `"cherry-pick" \| "am"` | no | `"cherry-pick"` | Replay mode |
| `target_branch` | `string` | depends | — | Target branch for replay/branch_surgery/publish |
| `source_commits` | `string[]` | depends | — | Commit list for replay/branch_surgery |
| `patch_files` | `string[]` | depends | — | Patch files for replay mode `am` |
| `three_way` | `boolean` | no | `true` | Use `--3way` for `git am` |
| `backup_branch` | `string` | no | derived | Backup branch in branch_surgery |
| `reset_to` | `string` | no | — | Hard-reset target for replay/branch_surgery |
| `confirm_hard_reset` | `boolean` | no | `false` | Must be `true` when `reset_to` is provided |
| `publish` | `boolean` | no | `false` | Publish at end of replay/branch_surgery |
| `remote` | `string` | no | `origin` | Remote for publish/fetch/push |
| `force_with_lease` | `boolean` | no | `false` | Push with `--force-with-lease` |
| `set_upstream` | `boolean` | no | `false` | Push with `--set-upstream` |
| `fetch_first` | `boolean` | no | `true` | Fetch before publish workflow |
| `rebase_onto` | `string` | no | — | Rebase target before push in publish workflow |
| `response_format` | `"markdown" \| "json"` | no | `"markdown"` | Output format |

### Example: combined snapshot

```json
{
  "tool": "git_workflow",
  "params": {
    "repo_path": "/Users/me/project",
    "action": "start",
    "workflow": "snapshot",
    "base_branch": "origin/main",
    "log_count": 15
  }
}
```

### Example: replay commits onto target branch

```json
{
  "tool": "git_workflow",
  "params": {
    "repo_path": "/Users/me/project",
    "action": "start",
    "workflow": "replay",
    "mode": "cherry-pick",
    "target_branch": "feature/cascade-status-and-skills-npm",
    "source_commits": ["064b5bd"],
    "publish": true,
    "remote": "origin",
    "force_with_lease": true
  }
}
```

### Example: patch series apply

```json
{
  "tool": "git_workflow",
  "params": {
    "repo_path": "/Users/me/project",
    "action": "start",
    "workflow": "replay",
    "mode": "am",
    "target_branch": "feature/cascade-status-and-skills-npm",
    "patch_files": [
      "patches/0001-feature.patch",
      "patches/0002-config.patch"
    ],
    "three_way": true
  }
}
```

### Notes

- Workflows are intentionally bounded and typed; this tool does not accept arbitrary shell command queues.
- Only one active workflow state is supported at a time per repository in this version.
- Use `action=status` to inspect paused state and `action=continue` or `action=abort` to recover.

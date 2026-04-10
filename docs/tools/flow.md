---
title: Git Flow Tool
---

`git_flow` implements git-flow-next-style workflows directly — no `git-flow` or `git-flow-next` CLI binary required.

It keeps a single MCP tool surface while supporting both:

- a canonical generalized request model built around `operation`, `config_action`, `topic_action`, and `control_action`
- legacy alias actions such as `feature-start`, `release-finish`, and `support-list`

The service uses repository config plus `simple-git`, not an external git-flow binary.

## git_flow

### Canonical request shape

Use the generalized contract for new integrations:

- `operation: "init" | "overview" | "config" | "topic" | "control"`
- `config_action: "list" | "add" | "update" | "rename" | "delete"`
- `topic_action: "start" | "finish" | "publish" | "list" | "update" | "delete" | "rename" | "checkout" | "track"`
- `control_action: "continue" | "abort"`

Compatibility alias requests can still use `action`, for example `feature-start` or `topic-finish`.

### Common parameters

- `repo_path` — absolute path to the repository
- `action` — compatibility alias action
- `operation` — canonical operation selector
- `config_action` — canonical config mutation action
- `topic_action` — canonical topic lifecycle action
- `control_action` — continue or abort an in-progress finish
- `topic` — configured topic branch type such as `feature`, `release`, `hotfix`, or a custom type
- `name` — topic short name, branch type name, or release version depending on the action
- `new_name` — rename target for branch types or topic branches
- `pattern` — glob filter for topic listing
- `match_mode` — `exact` or `prefix` branch resolution for shorthand operations
- `branch_kind` — `base` or `topic` for config mutations
- `parent` — parent base branch for a flow branch definition
- `prefix` — topic branch prefix such as `feature/`
- `start_point` — configured start point for a topic type
- `base_ref` — explicit starting ref for `topic_action: "start"`
- `preset` — `classic`, `github`, or `gitlab`
- `scope` / `config_file` — git config write target for init/config mutations
- `force` — rewrite flow config even if already initialized
- `no_create_branches` — write config without creating base branches
- `main_branch`, `develop_branch`, `staging_branch`, `production_branch` — preset branch overrides
- `remote` — remote used by publish/track and optional finish publishing
- `upstream_strategy`, `downstream_strategy`, `strategy` — merge strategy fields for config and lifecycle operations
- `fetch`, `ff`, `keep_branch`, `no_backmerge`, `rebase_before_finish`, `preserve_merges`, `publish` — finish/update behavior controls
- `force_delete`, `auto_update` — flow config flags and topic delete behavior
- `tag`, `tag_prefix`, `tag_message`, `delete_branch` — release/hotfix finish controls
- `response_format` — `markdown` or `json`

## Supported operations

### `operation: "init"`

Initializes structured `gitflow.branch.*` config using the selected preset.

### `operation: "overview"`

Returns:

- configured branch graph
- active topic branches
- current branch
- ahead/behind state
- workflow health issues such as missing parents, duplicate prefixes, or circular base dependencies

### `operation: "config"`

Supports configuration CRUD for base and topic branch definitions.

- `config_action: "list"`
- `config_action: "add"`
- `config_action: "update"`
- `config_action: "rename"`
- `config_action: "delete"`

Structured config is the canonical write format. Legacy `gitflow.branch.master`, `gitflow.branch.develop`, and `gitflow.prefix.*` values are still read for compatibility.

### `operation: "topic"`

Supports generalized topic lifecycle management for configured topic types.

- `topic_action: "start"`
- `topic_action: "finish"`
- `topic_action: "publish"`
- `topic_action: "list"`
- `topic_action: "update"`
- `topic_action: "delete"`
- `topic_action: "rename"`
- `topic_action: "checkout"`
- `topic_action: "track"`

When a current branch already matches the selected topic type, `name` may be omitted for shorthand lifecycle operations such as finish, update, delete, checkout, and rename.

### `operation: "control"`

Resumes or aborts an in-progress finish sequence.

- `control_action: "continue"`
- `control_action: "abort"`

## Compatibility aliases

Legacy aliases remain available and map onto the generalized engine:

- `feature-*`
- `release-*`
- `hotfix-*`
- `support-*`
- `topic-*`
- `config-*`
- `control-*`

## Examples

### Initialize a preset

```json
{ "tool": "git_flow", "params": { "repo_path": "/home/user/myproject", "action": "init", "preset": "classic" } }
```

### Inspect the configured graph

```json
{ "tool": "git_flow", "params": { "repo_path": "/home/user/myproject", "action": "overview" } }
```

### Add a custom topic type with the canonical config contract

```json
{
  "tool": "git_flow",
  "params": {
    "repo_path": "/home/user/myproject",
    "operation": "config",
    "config_action": "add",
    "name": "experiment",
    "branch_kind": "topic",
    "parent": "develop",
    "prefix": "experiment/",
    "strategy": "merge"
  }
}
```

### Start a generalized topic branch

```json
{
  "tool": "git_flow",
  "params": {
    "repo_path": "/home/user/myproject",
    "operation": "topic",
    "topic_action": "start",
    "topic": "feature",
    "name": "user-auth"
  }
}
```

### Publish a topic branch

```json
{
  "tool": "git_flow",
  "params": {
    "repo_path": "/home/user/myproject",
    "operation": "topic",
    "topic_action": "publish",
    "topic": "feature",
    "name": "user-auth",
    "remote": "origin"
  }
}
```

### Finish the current topic branch using shorthand behavior

```json
{
  "tool": "git_flow",
  "params": {
    "repo_path": "/home/user/myproject",
    "operation": "topic",
    "topic_action": "finish",
    "topic": "feature"
  }
}
```

### Recover after a paused finish

```json
{
  "tool": "git_flow",
  "params": {
    "repo_path": "/home/user/myproject",
    "operation": "control",
    "control_action": "continue"
  }
}
```

### Legacy aliases still work

```json
{
  "tool": "git_flow",
  "params": { "repo_path": "/home/user/myproject", "action": "feature-start", "name": "user-auth" }
}
```

## Hook and filter parity

`git_flow` can discover git-flow-next-style hooks from:

1. `gitflow.path.hooks`
2. `core.hooksPath`
3. the repository hooks directory

Hook and filter execution is disabled by default. Enable it explicitly with:

- `GIT_ALLOW_FLOW_HOOKS=true`

When disabled, the response reports that hooks or filters were skipped instead of executing arbitrary repository programs.

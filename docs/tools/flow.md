---
title: Git Flow Tool
---

`git_flow` drives the [git-flow-next](https://git-flow.sh) CLI. The binary owns the workflow
semantics — the finish state machine, conflict recovery, and worktree lifecycle — so it must be
installed and on `PATH`.

## Requirements

```
macOS:            brew install git-flow-next
other platforms:  https://github.com/gittower/git-flow-next/releases
```

Or point `GIT_FLOW_BINARY` at an existing binary. When the binary is missing, `git_flow` returns an
install hint rather than failing opaquely.

> Earlier versions of this server reimplemented git-flow-next in TypeScript and needed no external
> binary. That implementation owned 48 `gitflow.state.finish.*` config writes, which the CLI does
> not read. A repository left mid-finish by the old implementation is not recoverable by the CLI;
> resolve it with plain `git` (`git status`, `git merge --abort`) before switching.

## Request shape

- `operation: "init" | "overview" | "config" | "topic" | "control"`
- `config_action: "list" | "add" | "update" | "rename" | "delete" | "status" | "sync"`
- `topic_action: "start" | "finish" | "publish" | "list" | "update" | "delete" | "rename" | "checkout" | "track"`
- `control_action: "continue" | "abort"`

Compatibility alias requests can still use `action`, for example `feature-start` or `topic-finish`.
Do not mix the two forms.

`topic` must be a type git-flow-next exposes as a command: `bugfix`, `feature`, `release`, `hotfix`,
or `support`. A custom type you configured has no dedicated command — use the bare current-branch
verbs (`finish`, `publish`, `delete`, `update`, `rename`).

## Common parameters

- `repo_path` — absolute path to the repository
- `action` — compatibility alias action
- `name` — topic short name, branch type name, or release version, depending on the action
- `new_name` — rename target for branch types or topic branches
- `base_ref` — explicit starting ref, accepted only by `topic_action: "start"`
- `branch_kind` — `base` or `topic` for config mutations
- `parent` — parent base branch; accepted only by `config_action: "add"`
- `prefix`, `start_point`, `upstream_strategy`, `downstream_strategy`, `auto_update` — config fields
- `preset` — `classic`, `github`, or `gitlab`
- `scope` / `config_file` / `shared` — git config write target for init
- `main_branch`, `develop_branch`, `tag_prefix` — init overrides
- `fetch`, `ff`, `keep_branch`, `rebase_before_finish`, `preserve_merges`, `publish`, `force_delete`, `strategy` — lifecycle behavior
- `tag`, `tag_message` — release/hotfix finish controls
- `worktree`, `worktree_path` — worktree creation, on `start` and `checkout`
- `keep_worktree`, `force_worktree` — worktree cleanup, on `finish` and `delete`
- `worktrees` — provenance column, on `list`
- `recover` — which in-progress operation `control_action` targets, `finish` (default) or `update`
- `response_format` — `markdown` or `json`

## Flags are verb-scoped

git-flow rejects an unknown flag with a full usage dump, which buries the real error. So each
option is checked against the target verb before anything runs, and a mismatch raises with the
verdict rather than being silently dropped:

| Option | Valid on |
|---|---|
| `worktree`, `worktree_path` | `start`, `checkout` |
| `keep_worktree`, `force_worktree` | `finish`, `delete` |
| `worktrees` | `list` |
| `rebase_before_finish`, `preserve_merges`, `ff`, `keep_branch`, `publish`, `tag`, `tag_message`, `force_delete` | `finish` |

`strategy` is a convenience over flags git-flow actually defines: `rebase` becomes `--rebase`,
`squash` becomes `--squash`, and `none` becomes `--no-rebase --no-squash`.

## Unsupported parameters

These are retained in the schema and raise with a reason, rather than being dropped:

| Parameter | Why |
|---|---|
| `pattern` | `git flow <type> list` takes no name filter. |
| `match_mode: "prefix"` | git-flow already does prefix matching on `checkout`. |
| `no_backmerge` | git-flow-next has no backmerge suppression flag. |
| `remote` | the remote is the `gitflow.origin` config key, not a per-call flag. |
| `staging_branch`, `production_branch` | `git flow init` 2.1.0 has no `--staging`/`--production`. Use `preset: "gitlab"`. |
| `delete_branch` | duplicated `keep_branch`, which maps to `--keep` / `--no-keep`. |

## Output

Text. git-flow-next 2.1.0 defines no `--format` flag on any command, so `response_format: "json"`
returns the same text under `{ output }`. The published command reference documents a `--format` the
released binary rejects.

## Worktrees

Since 2.1 git-flow owns the worktree lifecycle, which is why `git_flow` can delegate instead of
reimplementing. Two behaviours worth knowing:

- **Starting a branch in a worktree does not check it out.** Git allows a branch in only one
  worktree, so `topic_action: "start"` with `worktree: true` leaves your current directory alone.
- **Cleanup depends on provenance.** A worktree git-flow created is removed; one you made by hand
  with `git worktree add` is kept and its HEAD detached, so uncommitted work survives. `finish` and
  `delete` refuse up front if the worktree has a merge, rebase, bisect, cherry-pick, or revert in
  progress.

For worktrees addressed by branch name outside a flow operation, see [Git Worktree](./worktree.md).
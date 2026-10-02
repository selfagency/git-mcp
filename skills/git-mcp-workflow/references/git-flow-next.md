# Git Flow Next Usage

`git_flow` drives the [git-flow-next](https://git-flow.sh) CLI, which must be installed and on
`PATH`:

```
macOS:            brew install git-flow-next
other platforms:  https://github.com/gittower/git-flow-next/releases
```

Set `GIT_FLOW_BINARY` to override the path. When the binary is missing, `git_flow` returns an install
hint rather than failing opaquely — treat that hint as the fix, not as an error to work around.

This document maps standard Git Flow command line actions to Git MCP tools and actions.

## Initialization and presets

- `git flow init` → `operation: "init"`
- `git flow init --preset=github` → `operation: "init", preset: "github"`
- `git flow init --preset=gitlab` → `operation: "init", preset: "gitlab"`
- `git flow init --main <branch>` → `operation: "init", main_branch: "<branch>"`
- `git flow init --develop <branch>` → `operation: "init", develop_branch: "<branch>"`
- `git flow init --shared` → `operation: "init", shared: true` (committable `.gitflow`)
- `git flow init --custom` → initialize, then apply explicit `operation: "config"` updates (base/topic definitions) instead of interactive prompts.

git-flow-next 2.1.0 `init` has no `--staging` or `--production`. Use `preset: "gitlab"`, which
configures both.

## Branch type customization

- `--feature <prefix>` → `operation: "config", config_action: "add|update", branch_kind: "topic", name: "feature", prefix: "<prefix>"`
- `--release <prefix>` → same pattern with `name: "release"`
- `--hotfix <prefix>` → same pattern with `name: "hotfix"`

Only `config_action: "add"` accepts a `parent`. `update`, `rename`, and `delete` reject it.

## Topic branch lifecycle (`feature|bugfix|release|hotfix|support`)

- `git flow <topic> start <name> [<base>]`
  → `operation: "topic", topic: "<topic>", topic_action: "start", name: "<name>", base_ref: "<base?>"`
- `git flow <topic> list`
  → `operation: "topic", topic: "<topic>", topic_action: "list"`
- `git flow <topic> update [<name>]`
  → `operation: "topic", topic: "<topic>", topic_action: "update", name: "<name?>"`
- `git flow <topic> delete <name>`
  → `operation: "topic", topic: "<topic>", topic_action: "delete", name: "<name>"`
- `git flow <topic> rename <old> <new>`
  → `operation: "topic", topic: "<topic>", topic_action: "rename", name: "<old>", new_name: "<new>"`
- `git flow <topic> checkout <name>`
  → `operation: "topic", topic: "<topic>", topic_action: "checkout", name: "<name>"`
- `git flow <topic> finish <name>`
  → `operation: "topic", topic: "<topic>", topic_action: "finish", name: "<name>"`
- `git flow <topic> track <name>`
  → `operation: "topic", topic: "<topic>", topic_action: "track", name: "<name>"`

`topic` must be a type git-flow-next exposes as a command. A custom type you configured has no
dedicated command — use the bare current-branch verbs (`finish`, `publish`, `delete`, `update`,
`rename`) via the legacy alias actions.

`base_ref` is accepted only by `topic_action: "start"`.

## Finish options mapping

Use with `operation: "topic", topic_action: "finish"`:

- `--rebase` → `strategy: "rebase"` (or `rebase_before_finish: true`)
- `--squash` → `strategy: "squash"`
- `--no-ff` → `ff: false`
- `--tag` → `tag: true` (optional `tag_message`)
- `--keep` → `keep_branch: true`
- `--force` → `force: true`
- `--abort` → `operation: "control", control_action: "abort"`
- `--continue` → `operation: "control", control_action: "continue"`

`strategy` is a convenience over flags git-flow actually defines. `none` becomes `--no-rebase
--no-squash`. There is no `--strategy` flag.

## Recovery

`control_action` resumes an operation that is already in progress. `finish` and `update` each own
their recovery flags, so say which one:

```
operation: "control", control_action: "continue"                    # finish (default)
operation: "control", control_action: "continue", recover: "update"
```

Before resuming, confirm what is actually in progress with `git_context action=summary`, which
reports merge, rebase, cherry-pick, and bisect state.

## Worktrees

git-flow-next 2.1 owns the worktree lifecycle, which is the main reason `git_flow` delegates
instead of reimplementing it.

- `git flow <topic> start <name> --worktree` → `topic_action: "start", worktree: true`
- `git flow <topic> start <name> --worktree-path <p>` → `topic_action: "start", worktree: true, worktree_path: "<p>"`
- `git flow <topic> finish <name> --keep-worktree` → `topic_action: "finish", keep_worktree: true`
- `git flow <topic> finish <name> -W` → `topic_action: "finish", force_worktree: true`
- `git flow <topic> list --worktrees` → `topic_action: "list", worktrees: true`

Two behaviours worth internalising:

- **Starting a branch in a worktree does not check it out.** Git allows a branch in one worktree
  only, so `start` with `worktree: true` leaves your current directory where it was.
- **Cleanup depends on provenance.** A worktree git-flow created is removed; one you made by hand
  with `git worktree add` is kept and its HEAD detached, so uncommitted work survives. `finish` and
  `delete` refuse up front if that worktree has a merge, rebase, bisect, cherry-pick, or revert in
  progress.

For branch-addressed worktrees outside a flow operation, use `git_worktree action=flow_*`.

## Flow models and when to use

- Traditional Git Flow: base `main` + `develop`; topics `feature/`, `bugfix/`, `release/`, `hotfix/`, optional `support/`.
- GitHub Flow: single base `main`; use `feature/*` for all work.
- GitLab Flow: base branches `main`, `staging`, `production`; topic types usually `feature/` and `hotfix/`.

Represent these with `operation: "init"` presets (`classic|github|gitlab`) plus `operation: "config"` adjustments as needed.

## Configuration and status commands

- `git flow config` / `git flow config list`
  → `operation: "config", config_action: "list"`
- `git flow config add base <name>`
  → `operation: "config", config_action: "add", branch_kind: "base", name: "<name>"`
- `git flow config add topic <name> <parent>`
  → `operation: "config", config_action: "add", branch_kind: "topic", name: "<name>", parent: "<parent>"`
- `git flow config edit base <name>`
  → `operation: "config", config_action: "update", branch_kind: "base", name: "<name>"`
- `git flow config rename topic <old> <new>`
  → `operation: "config", config_action: "rename", branch_kind: "topic", name: "<old>", new_name: "<new>"`
- `git flow config delete topic <name>`
  → `operation: "config", config_action: "delete", branch_kind: "topic", name: "<name>"`
- `git flow config status` → `operation: "config", config_action: "status"`
- `git flow config sync` → `operation: "config", config_action: "sync"`
- `git flow overview` → `operation: "overview"`

## Unsupported parameters

Retained in the schema, and each raises with a reason rather than being dropped:

| Parameter                             | Why                                             |
| ------------------------------------- | ----------------------------------------------- |
| `pattern`                             | `git flow <type> list` takes no name filter.    |
| `match_mode: "prefix"`                | git-flow already prefix-matches on `checkout`.  |
| `no_backmerge`                        | no backmerge suppression flag exists.           |
| `remote`                              | the remote is the `gitflow.origin` config key.  |
| `staging_branch`, `production_branch` | `init` 2.1.0 has no `--staging`/`--production`. |
| `delete_branch`                       | duplicated `keep_branch`.                       |

## Output format

git-flow-next 2.1.0 defines no `--format` flag on any command, so `response_format: "json"` returns
the same text under `{ output }`. The published command reference documents a `--format` the
released binary rejects.

If a desired CLI subcommand has no `git_flow` equivalent, use other `git-mcp` tools (`git_branches`,
`git_status`, `git_history`, `git_commits`) before considering raw CLI.

---
title: Jujutsu Awareness
---

`git_jj_check` detects whether the Jujutsu `jj` CLI is available and whether the repository is jj-managed (has a `.jj/` directory). Jujutsu is a distinct VCS with its own change model layered over a `.git` repository.

## When to use

Call `git_jj_check` before Git operations when a repository may be jj-managed. git-mcp's plain-Git tools operate on the underlying `.git` and will not reflect jj's change model (working-copy commit, bookmarks, operation log).

## Tool

### `git_jj_check`

Detects Jujutsu availability and management status.

| Parameter         | Type                   | Description                          |
| ----------------- | ---------------------- | ------------------------------------ |
| `repo_path`       | `string`               | Absolute path to the repository.     |
| `response_format` | `"markdown" \| "json"` | Output format. Defaults to `"markdown"`. |

**Returns:**

- `enabled` — whether Jujutsu awareness is enabled (`GIT_ALLOW_JJ=true`).
- `available` — whether the `jj` CLI is installed.
- `version` — the `jj` version, when available.
- `managed` — whether the repository has a `.jj/` directory.
- `guidance` — actionable guidance for the agent.

**Guidance logic:**

- jj-managed → prefer the `jj` CLI for all version control operations.
- jj-managed but `jj` not installed → install Jujutsu before making VCS changes.
- Not jj-managed → use git-mcp tools normally.

## Configuration

| Env var         | Description                                       |
| --------------- | ------------------------------------------------- |
| `GIT_ALLOW_JJ`  | Set `true` to enable Jujutsu awareness.          |
| `JJ_BINARY`     | Override the `jj` executable path (default `jj`). |

## Related

- [Jujutsu skill](/skills/jj-workflow) — git→jj mapping and workflow guidance.

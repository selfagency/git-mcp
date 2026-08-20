---
title: Tangled & Entire Awareness
---

`git_tangled_check` and `git_entire_check` detect whether a repository is hosted on Tangled or managed by Entire, and guide agents on which tooling to use.

## Tangled

Tangled is a decentralized Git hosting platform on the AT Protocol. Repositories are hosted on "knots" (lightweight, self-hostable Git servers), with `tangled.org` as the public appview.

### `git_tangled_check`

Detects whether the repository origin remote points at a Tangled host.

| Parameter         | Type                   | Description                          |
| ----------------- | ---------------------- | ------------------------------------ |
| `repo_path`       | `string`               | Absolute path to the repository.     |
| `response_format` | `"markdown" \| "json"` | Output format. Defaults to `"markdown"`. |

**Returns:**

- `enabled` — whether Tangled awareness is enabled (`GIT_ALLOW_TANGLED=true`).
- `tangled` — whether the origin remote points at a Tangled host.
- `guidance` — actionable guidance.

**Guidance:** Git transport (push/pull/clone) works normally via git-mcp tools. Tangled supports pull requests, but they are managed through the web UI — no documented REST API or CLI exists for creating/merging them.

## Entire

Entire captures the context behind agent work — checkpoints, sessions, prompts, and tool calls. It has a CLI (`entire`) with commands like `why`, `blame`, `search`, `recap`, and `review`.

### `git_entire_check`

Detects whether the Entire CLI is available and whether the repository is Entire-managed.

| Parameter         | Response                   | Description                                        |
| ----------------- | -------------------------- | -------------------------------------------------- |
| `repo_path`       | `string`                   | Absolute path to the repository.                    |
| `response_format` | `"markdown" \| "json"`     | Output format. Defaults to `"markdown"`.            |

**Returns:**

- `enabled` — whether Entire awareness is enabled (`GIT_ALLOW_ENTIRE=true`).
- `available` — whether the `entire` CLI is installed.
- `version` — the `entire` version, when available.
- `managed` — whether the repository has a `.entire/` directory.
- `guidance` — actionable guidance.

**Guidance:** When Entire-managed, use the `entire` CLI for session, checkpoint, and attribution queries (`entire why`, `entire blame`, `entire search`, `entire recap`). git-mcp tools operate on the git repo and do not expose Entire's context layer.

## Configuration

| Env var              | Description                                        |
| -------------------- | -------------------------------------------------- |
| `GIT_ALLOW_TANGLED`  | Set `true` to enable Tangled awareness.           |
| `GIT_ALLOW_ENTIRE`   | Set `true` to enable Entire awareness.            |
| `ENTIRE_BINARY`      | Override the `entire` executable path (default `entire`). |

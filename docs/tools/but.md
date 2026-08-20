---
title: GitButler Awareness
---

`git_but_check` detects whether the GitButler `but` CLI is available and returns guidance on whether to prefer `but mcp` / `but` commands over git-mcp tools.

## When to use

Call `git_but_check` before Git operations when a repository may be managed by GitButler. GitButler is a Git-based workspace model (virtual branches), so git-mcp's plain-Git writes can conflict with GitButler's branch layout.

## Tool

### `git_but_check`

Detects GitButler availability and returns guidance.

| Parameter         | Type                   | Description                          |
| ----------------- | ---------------------- | ------------------------------------ |
| `response_format` | `"markdown" \| "json"` | Output format. Defaults to `"markdown"`. |

**Returns:**

- `enabled` — whether GitButler awareness is enabled (`GIT_ALLOW_BUT=true`).
- `available` — whether the `but` CLI is installed.
- `version` — the `but` version, when available.
- `guidance` — actionable guidance for the agent.

**Guidance logic:**

- `but` available → prefer `but mcp` / `but` commands for version control.
- `but` available but git-mcp tools must be used → run `but teardown` first so plain-Git writes do not conflict with GitButler virtual branches.
- `but` absent → use git-mcp tools normally.

## Configuration

| Env var          | Description                                        |
| ---------------- | -------------------------------------------------- |
| `GIT_ALLOW_BUT`  | Set `true` to enable GitButler awareness.         |
| `BUT_BINARY`     | Override the `but` executable path (default `but`). |

## Related

- [GitButler skill](/skills/gitbutler-workflow) — git→but mapping and workflow guidance.

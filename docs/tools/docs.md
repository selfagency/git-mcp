---
title: Docs Tool
---

`git_docs` fetches Git documentation from the official [git-scm.com](https://git-scm.com) reference without leaving the chat.

## git_docs

::: info
Unlike all other tools, `git_docs` does **not** accept a `repo_path` parameter. It is global and not tied to any repository.
:::

| Parameter         | Type                   | Required | Default      | Description                                                                       |
| ----------------- | ---------------------- | -------- | ------------ | --------------------------------------------------------------------------------- |
| `action`          | `"search" \| "man"`    | *        | —            | `search` does a full-text search; `man` fetches a specific Git command's man page |
| `query`           | `string`               | *        | —            | Search term or Git command name (e.g. `"cherry-pick"`, `"rebase onto"`)           |
| `response_format` | `"markdown" \| "json"` |          | `"markdown"` | Output format                                                                     |

## Actions

| Action   | Description                                      |
| -------- | ------------------------------------------------ |
| `search` | Full-text search across all Git documentation    |
| `man`    | Retrieve the man page for a specific Git command |

## Examples

**Search for documentation about rebasing:**

```json
{ "tool": "git_docs", "params": { "action": "search", "query": "rebase interactive" } }
```

**Fetch the `git stash` man page:**

```json
{ "tool": "git_docs", "params": { "action": "man", "query": "stash" } }
```

**Look up cherry-pick options:**

```json
{ "tool": "git_docs", "params": { "action": "man", "query": "cherry-pick" } }
```

## Use Cases

- Ask the AI agent to explain what a Git option does without external searches
- Verify correct syntax for less common Git commands during a workflow
- Retrieve comprehensive option lists for commands like `git log`, `git diff`, or `git rebase`

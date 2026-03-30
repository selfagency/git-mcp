---
title: Context & Config Tools
---

Context and configuration tools let AI assistants understand repository state at a high level and read or write Git configuration.

## git_context_summary

Returns a concise summary of the repository: current branch, upstream tracking status, pending changes, recent commits, and any in-progress operations (merge, rebase, cherry-pick, bisect).

This is the recommended starting point for any AI-assisted workflow — call it first to orient before making changes.

| Parameter         | Type                   | Required | Default      | Description                     |
| ----------------- | ---------------------- | -------- | ------------ | ------------------------------- |
| `repo_path`       | `string`               | *        | —            | Absolute path to the repository |
| `response_format` | `"markdown" \| "json"` |          | `"markdown"` | Output format                   |

**Example:**

```json
{ "tool": "git_context_summary", "params": { "repo_path": "/home/user/myproject" } }
```

**Sample output:**

```text
Branch:    feature/auth  →  origin/feature/auth  (2 ahead, 0 behind)
Status:    2 staged, 1 unstaged, 0 untracked
Last commit: a1b2c3d  feat: add JWT middleware  (2 hours ago)
In progress: none
```

---

## git_search

Searches commit messages, file contents, and author information across the repository history.

| Parameter         | Type                   | Required | Default      | Description                                      |
| ----------------- | ---------------------- | -------- | ------------ | ------------------------------------------------ |
| `repo_path`       | `string`               | *        | —            | Absolute path to the repository                  |
| `query`           | `string`               | *        | —            | Search string to look for in commits and content |
| `limit`           | `number`               |          | `20`         | Maximum number of results (1–200)                |
| `response_format` | `"markdown" \| "json"` |          | `"markdown"` | Output format                                    |

**Example:**

```json
{
  "tool": "git_search",
  "params": { "repo_path": "/home/user/myproject", "query": "authentication middleware" }
}
```

---

## git_get_config

Reads Git configuration values. Returns a single key's value or the full configuration.

| Parameter         | Type                   | Required | Default      | Description                                                                         |
| ----------------- | ---------------------- | -------- | ------------ | ----------------------------------------------------------------------------------- |
| `repo_path`       | `string`               | *        | —            | Absolute path to the repository                                                     |
| `key`             | `string`               |          | —            | Configuration key to read (e.g. `user.email`). Omit to return the full local config |
| `response_format` | `"markdown" \| "json"` |          | `"markdown"` | Output format                                                                       |

**Example — read a single key:**

```json
{
  "tool": "git_get_config",
  "params": { "repo_path": "/home/user/myproject", "key": "user.email" }
}
```

**Example — dump the full local config:**

```json
{ "tool": "git_get_config", "params": { "repo_path": "/home/user/myproject" } }
```

---

## git_set_config

Writes a Git configuration value to the local repository config.

::: warning
This modifies `.git/config` in the repository. Use with care — incorrect values can affect Git behaviour for all operations in the repository.
:::

| Parameter         | Type                   | Required | Default      | Description                                            |
| ----------------- | ---------------------- | -------- | ------------ | ------------------------------------------------------ |
| `repo_path`       | `string`               | *        | —            | Absolute path to the repository                        |
| `key`             | `string`               | *        | —            | Configuration key (e.g. `user.email`, `core.autocrlf`) |
| `value`           | `string`               | *        | —            | Value to set                                           |
| `response_format` | `"markdown" \| "json"` |          | `"markdown"` | Output format                                          |

**Example:**

```json
{
  "tool": "git_set_config",
  "params": {
    "repo_path": "/home/user/myproject",
    "key": "user.email",
    "value": "alice@example.com"
  }
}
```

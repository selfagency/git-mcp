---
title: Inspect Tools
---

Inspect tools are **read-only** — they never modify repository state. Use them freely to understand the current state of a repository before taking action.

## git_status

Shows the working tree status: staged files, unstaged modifications, and untracked files.

| Parameter         | Type                   | Required | Default      | Description                     |
| ----------------- | ---------------------- | -------- | ------------ | ------------------------------- |
| `repo_path`       | `string`               | *        | —            | Absolute path to the repository |
| `response_format` | `"markdown" \| "json"` |          | `"markdown"` | Output format                   |

**Example:**

```json
{ "tool": "git_status", "params": { "repo_path": "/home/user/myproject" } }
```

---

## git_log

Shows the commit history with optional filtering.

| Parameter         | Type                   | Required | Default      | Description                                                        |
| ----------------- | ---------------------- | -------- | ------------ | ------------------------------------------------------------------ |
| `repo_path`       | `string`               | *        | —            | Absolute path to the repository                                    |
| `limit`           | `number`               |          | `30`         | Number of commits to return (1–200)                                |
| `offset`          | `number`               |          | `0`          | Number of commits to skip (for pagination)                         |
| `author`          | `string`               |          | —            | Filter by author name or email                                     |
| `grep`            | `string`               |          | —            | Filter commits whose message matches this string                   |
| `since`           | `string`               |          | —            | Show commits after this date (e.g. `"2024-01-01"`, `"1 week ago"`) |
| `until`           | `string`               |          | —            | Show commits before this date                                      |
| `file_path`       | `string`               |          | —            | Limit to commits that touched this file                            |
| `response_format` | `"markdown" \| "json"` |          | `"markdown"` | Output format                                                      |

**Example — last 10 commits by a specific author:**

```json
{
  "tool": "git_log",
  "params": {
    "repo_path": "/home/user/myproject",
    "limit": 10,
    "author": "alice"
  }
}
```

---

## git_show

Shows the details of a specific commit, tag, or tree object.

| Parameter         | Type                   | Required | Default      | Description                                   |
| ----------------- | ---------------------- | -------- | ------------ | --------------------------------------------- |
| `repo_path`       | `string`               | *        | —            | Absolute path to the repository               |
| `ref`             | `string`               | *        | —            | Commit SHA, tag, branch, or any valid Git ref |
| `response_format` | `"markdown" \| "json"` |          | `"markdown"` | Output format                                 |

**Example:**

```json
{
  "tool": "git_show",
  "params": { "repo_path": "/home/user/myproject", "ref": "a1b2c3d" }
}
```

---

## git_diff

Shows differences between commits, branches, or the working tree and index.

| Parameter         | Type                               | Required | Default      | Description                                                                                           |
| ----------------- | ---------------------------------- | -------- | ------------ | ----------------------------------------------------------------------------------------------------- |
| `repo_path`       | `string`                           | *        | —            | Absolute path to the repository                                                                       |
| `mode`            | `"unstaged" \| "staged" \| "refs"` |          | `"unstaged"` | What to diff. `unstaged` = working tree vs index; `staged` = index vs HEAD; `refs` = between two refs |
| `from_ref`        | `string`                           |          | —            | Required when `mode` is `refs`. Starting ref                                                          |
| `to_ref`          | `string`                           |          | —            | Required when `mode` is `refs`. Ending ref                                                            |
| `filtered`        | `boolean`                          |          | `false`      | When `true`, returns only file names rather than full patch                                           |
| `response_format` | `"markdown" \| "json"`             |          | `"markdown"` | Output format                                                                                         |

**Example — diff between two branches:**

```json
{
  "tool": "git_diff",
  "params": {
    "repo_path": "/home/user/myproject",
    "mode": "refs",
    "from_ref": "main",
    "to_ref": "feature/my-feature"
  }
}
```

---

## git_blame

Shows who last modified each line of a file.

| Parameter         | Type                   | Required | Default      | Description                              |
| ----------------- | ---------------------- | -------- | ------------ | ---------------------------------------- |
| `repo_path`       | `string`               | *        | —            | Absolute path to the repository          |
| `file_path`       | `string`               | *        | —            | Path to the file (relative to repo root) |
| `ref`             | `string`               |          | `HEAD`       | Blame at this commit or ref              |
| `response_format` | `"markdown" \| "json"` |          | `"markdown"` | Output format                            |

**Example:**

```json
{
  "tool": "git_blame",
  "params": { "repo_path": "/home/user/myproject", "file_path": "src/index.ts" }
}
```

---

## git_reflog

Shows the reference log — a history of where HEAD and branches have pointed.

Useful for recovering commits after a hard reset or accidental branch deletion.

| Parameter         | Type                   | Required | Default      | Description                         |
| ----------------- | ---------------------- | -------- | ------------ | ----------------------------------- |
| `repo_path`       | `string`               | *        | —            | Absolute path to the repository     |
| `limit`           | `number`               |          | `30`         | Number of entries to return (1–200) |
| `response_format` | `"markdown" \| "json"` |          | `"markdown"` | Output format                       |

**Example:**

```json
{ "tool": "git_reflog", "params": { "repo_path": "/home/user/myproject", "limit": 50 } }
```

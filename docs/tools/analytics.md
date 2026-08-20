---
title: Repository Analytics
---

`git_analytics` provides read-only repository analytics computed from local git history — no external binaries, no API keys, no data egress.

## Tool

### `git_analytics`

| Parameter         | Type                   | Description                                                              |
| ----------------- | ---------------------- | ------------------------------------------------------------------------ |
| `repo_path`       | `string`               | Absolute path to the Git repository.                                     |
| `action`          | `"contributors" \| "churn" \| "activity" \| "summary" \| "file-stats"` | Analytics operation. |
| `response_format` | `"markdown" \| "json"` | Output format. Defaults to `"markdown"`.                                 |

## Actions

### `contributors`

Per-author commit counts, additions/deletions, and first/last activity.

```text
git_analytics  action=contributors
```

### `churn`

File hotspots — files with the most commits and most lines changed.

```text
git_analytics  action=churn
```

### `activity`

Commit frequency over time (per day).

```text
git_analytics  action=activity
```

### `summary`

Repo overview: branch count, tag count, total commits, top contributors, oldest/newest commit.

```text
git_analytics  action=summary
```

### `file-stats`

File-type breakdown, largest files, and recently modified files.

```text
git_analytics  action=file-stats
```

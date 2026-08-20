---
title: History Rewrite
---

`git_rewrite` rewrites commit history — reword messages, squash commits, rewrite messages across a range, and create/restore backups. History rewriting changes commit hashes and requires force-push, so destructive actions require `confirm=true` and a backup is recommended first.

## Tool

### `git_rewrite`

| Parameter         | Type                   | Description                                                              |
| ----------------- | ---------------------- | ------------------------------------------------------------------------ |
| `repo_path`       | `string`               | Absolute path to the Git repository.                                     |
| `action`          | `"reword" \| "squash" \| "rewrite-messages" \| "backup" \| "restore"` | History rewrite operation. |
| `ref`             | `string`               | Commit ref to reword (defaults to `HEAD`).                               |
| `message`         | `string`               | New commit message (reword/squash).                                      |
| `count`           | `number`               | Number of commits to squash (min 2).                                     |
| `range`           | `string`               | Commit range to rewrite (e.g. `HEAD~5..HEAD`).                           |
| `messages`        | `object`               | Map of commit SHA to replacement message (rewrite-messages).             |
| `name`            | `string`               | Backup branch name (backup/restore).                                     |
| `confirm`         | `boolean`              | Confirm destructive history rewrite.                                     |
| `response_format` | `"markdown" \| "json"` | Output format. Defaults to `"markdown"`.                                 |

## Actions

### `reword`

Change one commit's message. `HEAD` is amended in place; an arbitrary commit is rewritten with `git filter-branch --msg-filter`. Rewording a non-HEAD commit requires `confirm=true`.

```text
git_rewrite  action=reword  message="fix(auth): correct token refresh"  [ref=<sha>]  [confirm=true]
```

### `squash`

Combine the last `count` commits into one with a new message. Uses `git reset --soft` + `git commit` (non-interactive). Requires `confirm=true`.

```text
git_rewrite  action=squash  count=3  message="feat: bundle three commits"  confirm=true
```

### `rewrite-messages`

Rewrite messages across a range using an explicit SHA→message mapping. Commits not in the mapping keep their original message. Uses `git filter-branch --msg-filter`. Requires `confirm=true`.

```text
git_rewrite  action=rewrite-messages  range=HEAD~5..HEAD  messages={"abc1234":"feat: new feature"}  confirm=true
```

### `backup`

Create a backup branch at the current HEAD named `rewrite-backup/<name>` before rewriting.

```text
git_rewrite  action=backup  name=pre-rewrite
```

### `restore`

Restore the repository to a backup branch (hard reset). Requires `confirm=true`.

```text
git_rewrite  action=restore  name=pre-rewrite  confirm=true
```

## Safety

- History rewriting changes commit hashes and requires force-push. Create a backup first.
- Non-HEAD reword, squash, rewrite-messages, and restore all require `confirm=true`.
- Prefer `git revert` over rewriting when the goal is to undo published changes.

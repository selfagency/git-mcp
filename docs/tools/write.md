---
title: Write Tools
---

Write tools modify repository state. They include guardrails for dangerous operations — read the parameter descriptions carefully before invoking them.

## git_add

Stages files for the next commit.

| Parameter         | Type                   | Required | Default      | Description                                                                |
| ----------------- | ---------------------- | -------- | ------------ | -------------------------------------------------------------------------- |
| `repo_path`       | `string`               | *        | —            | Absolute path to the repository                                            |
| `all`             | `boolean`              |          | `false`      | Stage all tracked and untracked changes (`git add -A`)                     |
| `paths`           | `string[]`             |          | —            | Specific file or directory paths to stage. Required unless `all` is `true` |
| `response_format` | `"markdown" \| "json"` |          | `"markdown"` | Output format                                                              |

**Example — stage specific files:**

```json
{
  "tool": "git_add",
  "params": {
    "repo_path": "/home/user/myproject",
    "paths": ["src/index.ts", "README.md"]
  }
}
```

---

## git_restore

Discards working tree or staged changes for specified files.

::: warning
This operation discards uncommitted changes. It cannot be undone for unstaged changes.
:::

| Parameter         | Type                   | Required | Default      | Description                                                       |
| ----------------- | ---------------------- | -------- | ------------ | ----------------------------------------------------------------- |
| `repo_path`       | `string`               | *        | —            | Absolute path to the repository                                   |
| `paths`           | `string[]`             | *        | —            | Files to restore. Must contain at least one entry                 |
| `staged`          | `boolean`              |          | `false`      | Unstage the files (moves changes from index back to working tree) |
| `worktree`        | `boolean`              |          | `true`       | Discard working tree changes                                      |
| `source`          | `string`               |          | —            | Restore from this commit or ref instead of `HEAD`                 |
| `response_format` | `"markdown" \| "json"` |          | `"markdown"` | Output format                                                     |

**Example — discard unstaged changes:**

```json
{
  "tool": "git_restore",
  "params": { "repo_path": "/home/user/myproject", "paths": ["src/index.ts"] }
}
```

**Example — unstage files without discarding changes:**

```json
{
  "tool": "git_restore",
  "params": {
    "repo_path": "/home/user/myproject",
    "paths": ["src/index.ts"],
    "staged": true,
    "worktree": false
  }
}
```

---

## git_commit

Records staged changes as a new commit.

| Parameter         | Type                   | Required | Default      | Description                                                               |
| ----------------- | ---------------------- | -------- | ------------ | ------------------------------------------------------------------------- |
| `repo_path`       | `string`               | *        | —            | Absolute path to the repository                                           |
| `message`         | `string`               | *        | —            | Commit message                                                            |
| `all`             | `boolean`              |          | `false`      | Automatically stage all tracked modified files before committing          |
| `amend`           | `boolean`              |          | `false`      | Amend the most recent commit instead of creating a new one                |
| `no_edit`         | `boolean`              |          | `false`      | When amending, reuse the existing commit message without prompting        |
| `sign`            | `boolean`              |          | `false`      | Sign the commit. Also enabled globally by `GIT_AUTO_SIGN_COMMITS=true`    |
| `signing_key`     | `string`               |          | —            | Override the default signing key (GPG ID or SSH key path)                 |
| `no_verify`       | `boolean`              |          | `false`      | Skip pre-commit and commit-msg hooks. Requires `GIT_ALLOW_NO_VERIFY=true` |
| `response_format` | `"markdown" \| "json"` |          | `"markdown"` | Output format                                                             |

**Example:**

```json
{
  "tool": "git_commit",
  "params": {
    "repo_path": "/home/user/myproject",
    "message": "feat: add user authentication"
  }
}
```

**Example — amend without changing the message:**

```json
{
  "tool": "git_commit",
  "params": {
    "repo_path": "/home/user/myproject",
    "message": "",
    "amend": true,
    "no_edit": true
  }
}
```

---

## git_reset

Moves HEAD (and optionally the index and working tree) to a different commit.

::: danger Hard reset
`mode: "hard"` permanently discards working tree changes. You must pass `confirm: true` to proceed. This cannot be undone for uncommitted changes.
:::

| Parameter         | Type                          | Required | Default      | Description                                                                                                             |
| ----------------- | ----------------------------- | -------- | ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `repo_path`       | `string`                      | *        | —            | Absolute path to the repository                                                                                         |
| `mode`            | `"soft" \| "mixed" \| "hard"` |          | `"mixed"`    | Reset mode. `soft` = move HEAD only; `mixed` = move HEAD + unstage; `hard` = move HEAD + unstage + discard working tree |
| `target`          | `string`                      |          | `HEAD`       | Target commit, branch, or ref                                                                                           |
| `paths`           | `string[]`                    |          | —            | Limit reset to specific files (only valid with `mixed` mode)                                                            |
| `confirm`         | `boolean`                     |          | `false`      | Required to be `true` when `mode` is `hard`                                                                             |
| `response_format` | `"markdown" \| "json"`        |          | `"markdown"` | Output format                                                                                                           |

**Example — soft reset to undo the last commit while keeping changes staged:**

```json
{
  "tool": "git_reset",
  "params": {
    "repo_path": "/home/user/myproject",
    "mode": "soft",
    "target": "HEAD~1"
  }
}
```

**Example — hard reset (requires confirm):**

```json
{
  "tool": "git_reset",
  "params": {
    "repo_path": "/home/user/myproject",
    "mode": "hard",
    "target": "HEAD",
    "confirm": true
  }
}
```

---

## git_revert

Creates a new commit that undoes the changes introduced by an existing commit. Safe for published history because it does not rewrite commits.

| Parameter         | Type                   | Required | Default      | Description                                                                                          |
| ----------------- | ---------------------- | -------- | ------------ | ---------------------------------------------------------------------------------------------------- |
| `repo_path`       | `string`               | *        | —            | Absolute path to the repository                                                                      |
| `ref`             | `string`               | *        | —            | Commit to revert                                                                                     |
| `no_commit`       | `boolean`              |          | `false`      | Stage the revert changes without creating a commit (useful when reverting multiple commits together) |
| `mainline`        | `number`               |          | —            | For merge commits: which parent (1-based index) to use as mainline                                   |
| `response_format` | `"markdown" \| "json"` |          | `"markdown"` | Output format                                                                                        |

**Example:**

```json
{
  "tool": "git_revert",
  "params": { "repo_path": "/home/user/myproject", "ref": "a1b2c3d" }
}
```

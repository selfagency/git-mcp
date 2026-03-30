---
title: Advanced Tools
---

Advanced tools cover specialized workflows — stashing changes, rebasing, cherry-picking, bisecting, tagging, working trees, and submodules.

## git_stash

Saves or restores the working tree and index without creating a commit.

| Parameter           | Type                                             | Required | Default      | Description                                                                     |
| ------------------- | ------------------------------------------------ | -------- | ------------ | ------------------------------------------------------------------------------- |
| `repo_path`         | `string`                                         | *        | —            | Absolute path to the repository                                                 |
| `action`            | `"save" \| "list" \| "apply" \| "pop" \| "drop"` | *        | —            | Operation to perform                                                            |
| `message`           | `string`                                         |          | —            | Description for the stash (used with `save`)                                    |
| `index`             | `number`                                         |          | —            | Stash index to apply, pop, or drop (0-based). Defaults to the most recent stash |
| `include_untracked` | `boolean`                                        |          | `false`      | Include untracked files when saving                                             |
| `response_format`   | `"markdown" \| "json"`                           |          | `"markdown"` | Output format                                                                   |

**Example — save current changes:**

```json
{
  "tool": "git_stash",
  "params": {
    "repo_path": "/home/user/myproject",
    "action": "save",
    "message": "WIP: login form",
    "include_untracked": true
  }
}
```

**Example — apply the most recent stash:**

```json
{ "tool": "git_stash", "params": { "repo_path": "/home/user/myproject", "action": "pop" } }
```

---

## git_rebase

Applies commits from the current branch on top of another base.

::: warning History rewriting
Rebasing rewrites commit SHAs. Only rebase branches that have not been published to a shared remote, or use `force_with_lease` on push after rebasing.
:::

| Parameter         | Type                                         | Required | Default      | Description                                                                       |
| ----------------- | -------------------------------------------- | -------- | ------------ | --------------------------------------------------------------------------------- |
| `repo_path`       | `string`                                     | *        | —            | Absolute path to the repository                                                   |
| `action`          | `"start" \| "continue" \| "abort" \| "skip"` | *        | —            | `start` begins a new rebase; the others control an in-progress interactive rebase |
| `onto`            | `string`                                     |          | —            | Required for `start`. The target branch or commit to rebase onto                  |
| `response_format` | `"markdown" \| "json"`                       |          | `"markdown"` | Output format                                                                     |

**Example — rebase feature branch onto main:**

```json
{
  "tool": "git_rebase",
  "params": { "repo_path": "/home/user/myproject", "action": "start", "onto": "main" }
}
```

**Example — continue after resolving conflicts:**

```json
{ "tool": "git_rebase", "params": { "repo_path": "/home/user/myproject", "action": "continue" } }
```

---

## git_cherry_pick

Applies the changes introduced by specific commits onto the current branch.

| Parameter         | Type                               | Required | Default      | Description                                                                      |
| ----------------- | ---------------------------------- | -------- | ------------ | -------------------------------------------------------------------------------- |
| `repo_path`       | `string`                           | *        | —            | Absolute path to the repository                                                  |
| `action`          | `"start" \| "continue" \| "abort"` | *        | —            | `start` applies a commit; `continue` / `abort` manage an in-progress cherry-pick |
| `ref`             | `string`                           |          | —            | Required for `start`. Commit SHA or ref to apply                                 |
| `response_format` | `"markdown" \| "json"`             |          | `"markdown"` | Output format                                                                    |

**Example:**

```json
{
  "tool": "git_cherry_pick",
  "params": { "repo_path": "/home/user/myproject", "action": "start", "ref": "a1b2c3d" }
}
```

---

## git_bisect

Uses binary search to find the commit that introduced a bug.

| Parameter         | Type                                                       | Required | Default      | Description                                                    |
| ----------------- | ---------------------------------------------------------- | -------- | ------------ | -------------------------------------------------------------- |
| `repo_path`       | `string`                                                   | *        | —            | Absolute path to the repository                                |
| `action`          | `"start" \| "good" \| "bad" \| "skip" \| "run" \| "reset"` | *        | —            | Bisect command to run                                          |
| `ref`             | `string`                                                   |          | —            | Commit ref for `good`, `bad`, or `skip`                        |
| `good_ref`        | `string`                                                   |          | —            | Last known good commit (for `start`)                           |
| `bad_ref`         | `string`                                                   |          | —            | First known bad commit (for `start`). Defaults to `HEAD`       |
| `command`         | `string`                                                   |          | —            | Shell command for `run` mode — exits 0 for good, non-0 for bad |
| `response_format` | `"markdown" \| "json"`                                     |          | `"markdown"` | Output format                                                  |

**Typical bisect workflow:**

```json
{ "tool": "git_bisect", "params": { "repo_path": "...", "action": "start", "good_ref": "v1.0.0", "bad_ref": "HEAD" } }
{ "tool": "git_bisect", "params": { "repo_path": "...", "action": "good", "ref": "HEAD" } }
{ "tool": "git_bisect", "params": { "repo_path": "...", "action": "bad", "ref": "HEAD" } }
{ "tool": "git_bisect", "params": { "repo_path": "...", "action": "reset" } }
```

---

## git_tag

Lists, creates, or deletes Git tags.

| Parameter         | Type                             | Required | Default      | Description                                               |
| ----------------- | -------------------------------- | -------- | ------------ | --------------------------------------------------------- |
| `repo_path`       | `string`                         | *        | —            | Absolute path to the repository                           |
| `action`          | `"list" \| "create" \| "delete"` | *        | —            | Operation to perform                                      |
| `name`            | `string`                         |          | —            | Tag name. Required for `create` and `delete`              |
| `target`          | `string`                         |          | `HEAD`       | Commit to tag (for `create`)                              |
| `message`         | `string`                         |          | —            | Annotation message. If provided, creates an annotated tag |
| `sign`            | `boolean`                        |          | `false`      | Sign the tag. Also enabled by `GIT_AUTO_SIGN_TAGS=true`   |
| `signing_key`     | `string`                         |          | —            | Override the default signing key                          |
| `response_format` | `"markdown" \| "json"`           |          | `"markdown"` | Output format                                             |

**Example — create an annotated, signed tag:**

```json
{
  "tool": "git_tag",
  "params": {
    "repo_path": "/home/user/myproject",
    "action": "create",
    "name": "v1.2.0",
    "message": "Release v1.2.0",
    "sign": true
  }
}
```

---

## git_worktree

Manages Git worktrees — multiple working trees attached to the same repository.

| Parameter         | Type                          | Required | Default      | Description                                                                       |
| ----------------- | ----------------------------- | -------- | ------------ | --------------------------------------------------------------------------------- |
| `repo_path`       | `string`                      | *        | —            | Absolute path to the main repository                                              |
| `action`          | `"add" \| "list" \| "remove"` | *        | —            | Operation to perform                                                              |
| `path`            | `string`                      |          | —            | Filesystem path for the new or removed worktree (required for `add` and `remove`) |
| `branch`          | `string`                      |          | —            | Branch to check out in the new worktree (for `add`)                               |
| `response_format` | `"markdown" \| "json"`        |          | `"markdown"` | Output format                                                                     |

**Example — add a worktree for a hotfix:**

```json
{
  "tool": "git_worktree",
  "params": {
    "repo_path": "/home/user/myproject",
    "action": "add",
    "path": "/home/user/myproject-hotfix",
    "branch": "hotfix/critical-bug"
  }
}
```

---

## git_submodule

Manages Git submodules embedded in a repository.

| Parameter         | Type                                    | Required | Default      | Description                                              |
| ----------------- | --------------------------------------- | -------- | ------------ | -------------------------------------------------------- |
| `repo_path`       | `string`                                | *        | —            | Absolute path to the repository                          |
| `action`          | `"add" \| "list" \| "update" \| "sync"` | *        | —            | Operation to perform                                     |
| `url`             | `string`                                |          | —            | Remote URL for the submodule (required for `add`)        |
| `path`            | `string`                                |          | —            | Submodule path within the repository. Required for `add` |
| `recursive`       | `boolean`                               |          | `false`      | Operate recursively on nested submodules                 |
| `response_format` | `"markdown" \| "json"`                  |          | `"markdown"` | Output format                                            |

**Example — add a submodule:**

```json
{
  "tool": "git_submodule",
  "params": {
    "repo_path": "/home/user/myproject",
    "action": "add",
    "url": "https://github.com/org/library.git",
    "path": "vendor/library"
  }
}
```

**Example — update all submodules recursively:**

```json
{
  "tool": "git_submodule",
  "params": { "repo_path": "/home/user/myproject", "action": "update", "recursive": true }
}
```

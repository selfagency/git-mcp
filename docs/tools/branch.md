---
title: Branch Tools
---

Branch tools manage the full lifecycle of Git branches — listing, creating, deleting, renaming, checking out, and setting tracking relationships.

## git_list_branches

Lists local branches. Optionally includes remote-tracking branches.

| Parameter         | Type                   | Required | Default      | Description                      |
| ----------------- | ---------------------- | -------- | ------------ | -------------------------------- |
| `repo_path`       | `string`               | *        | —            | Absolute path to the repository  |
| `all`             | `boolean`              |          | `false`      | Include remote-tracking branches |
| `response_format` | `"markdown" \| "json"` |          | `"markdown"` | Output format                    |

**Example:**

```json
{ "tool": "git_list_branches", "params": { "repo_path": "/home/user/myproject", "all": true } }
```

---

## git_create_branch

Creates a new branch, optionally from a specified ref.

| Parameter         | Type                   | Required | Default      | Description                                     |
| ----------------- | ---------------------- | -------- | ------------ | ----------------------------------------------- |
| `repo_path`       | `string`               | *        | —            | Absolute path to the repository                 |
| `name`            | `string`               | *        | —            | Name for the new branch                         |
| `from_ref`        | `string`               |          | `HEAD`       | Starting point (commit, branch, or tag)         |
| `checkout`        | `boolean`              |          | `false`      | Also switch to the new branch after creating it |
| `response_format` | `"markdown" \| "json"` |          | `"markdown"` | Output format                                   |

**Example:**

```json
{
  "tool": "git_create_branch",
  "params": {
    "repo_path": "/home/user/myproject",
    "name": "feature/login",
    "from_ref": "main",
    "checkout": true
  }
}
```

---

## git_delete_branch

Deletes a local branch.

::: warning
Use `force: true` only when you are certain the branch's commits are reachable from another ref. Without it, Git refuses to delete a branch that has not been merged.
:::

| Parameter         | Type                   | Required | Default      | Description                                    |
| ----------------- | ---------------------- | -------- | ------------ | ---------------------------------------------- |
| `repo_path`       | `string`               | *        | —            | Absolute path to the repository                |
| `name`            | `string`               | *        | —            | Branch to delete                               |
| `force`           | `boolean`              |          | `false`      | Delete even if the branch has unmerged commits |
| `response_format` | `"markdown" \| "json"` |          | `"markdown"` | Output format                                  |

**Example:**

```json
{
  "tool": "git_delete_branch",
  "params": { "repo_path": "/home/user/myproject", "name": "feature/login" }
}
```

---

## git_rename_branch

Renames a local branch.

| Parameter         | Type                   | Required | Default      | Description                     |
| ----------------- | ---------------------- | -------- | ------------ | ------------------------------- |
| `repo_path`       | `string`               | *        | —            | Absolute path to the repository |
| `old_name`        | `string`               | *        | —            | Current branch name             |
| `new_name`        | `string`               | *        | —            | New branch name                 |
| `response_format` | `"markdown" \| "json"` |          | `"markdown"` | Output format                   |

**Example:**

```json
{
  "tool": "git_rename_branch",
  "params": {
    "repo_path": "/home/user/myproject",
    "old_name": "feature/login",
    "new_name": "feature/auth"
  }
}
```

---

## git_checkout

Switches the working tree to a branch, tag, or commit. Equivalent to `git switch` / `git checkout`.

| Parameter         | Type                   | Required | Default      | Description                                                 |
| ----------------- | ---------------------- | -------- | ------------ | ----------------------------------------------------------- |
| `repo_path`       | `string`               | *        | —            | Absolute path to the repository                             |
| `ref`             | `string`               | *        | —            | Branch, tag, or commit to check out                         |
| `create`          | `boolean`              |          | `false`      | Create the branch if it does not exist (equivalent to `-b`) |
| `response_format` | `"markdown" \| "json"` |          | `"markdown"` | Output format                                               |

**Example:**

```json
{
  "tool": "git_checkout",
  "params": { "repo_path": "/home/user/myproject", "ref": "main" }
}
```

---

## git_set_upstream

Sets the upstream (tracking) remote branch for a local branch.

| Parameter         | Type                   | Required | Default      | Description                                                          |
| ----------------- | ---------------------- | -------- | ------------ | -------------------------------------------------------------------- |
| `repo_path`       | `string`               | *        | —            | Absolute path to the repository                                      |
| `branch`          | `string`               | *        | —            | Local branch name                                                    |
| `upstream`        | `string`               | *        | —            | Remote tracking ref in the form `remote/branch` (e.g. `origin/main`) |
| `response_format` | `"markdown" \| "json"` |          | `"markdown"` | Output format                                                        |

**Example:**

```json
{
  "tool": "git_set_upstream",
  "params": {
    "repo_path": "/home/user/myproject",
    "branch": "feature/auth",
    "upstream": "origin/feature/auth"
  }
}
```

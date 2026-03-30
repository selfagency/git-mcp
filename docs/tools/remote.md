---
title: Remote Tools
---

Remote tools manage connections to remote repositories and synchronize content between local and remote.

## git_list_remotes

Lists all configured remotes with their fetch and push URLs.

| Parameter         | Type                   | Required | Default      | Description                     |
| ----------------- | ---------------------- | -------- | ------------ | ------------------------------- |
| `repo_path`       | `string`               | *        | —            | Absolute path to the repository |
| `response_format` | `"markdown" \| "json"` |          | `"markdown"` | Output format                   |

**Example:**

```json
{ "tool": "git_list_remotes", "params": { "repo_path": "/home/user/myproject" } }
```

---

## git_remote

Adds, removes, or updates a remote.

| Parameter         | Type                             | Required | Default      | Description                                                 |
| ----------------- | -------------------------------- | -------- | ------------ | ----------------------------------------------------------- |
| `repo_path`       | `string`                         | *        | —            | Absolute path to the repository                             |
| `action`          | `"add" \| "remove" \| "set-url"` | *        | —            | Operation to perform                                        |
| `name`            | `string`                         | *        | —            | Remote name (e.g. `origin`)                                 |
| `url`             | `string`                         |          | —            | Required for `add` and `set-url`. Remote URL (HTTPS or SSH) |
| `response_format` | `"markdown" \| "json"`           |          | `"markdown"` | Output format                                               |

**Example — add a remote:**

```json
{
  "tool": "git_remote",
  "params": {
    "repo_path": "/home/user/myproject",
    "action": "add",
    "name": "upstream",
    "url": "https://github.com/original/repo.git"
  }
}
```

---

## git_fetch

Downloads objects and refs from a remote without modifying the working tree.

| Parameter         | Type                   | Required | Default      | Description                                                    |
| ----------------- | ---------------------- | -------- | ------------ | -------------------------------------------------------------- |
| `repo_path`       | `string`               | *        | —            | Absolute path to the repository                                |
| `remote`          | `string`               |          | `"origin"`   | Remote to fetch from                                           |
| `branch`          | `string`               |          | —            | Specific branch to fetch. Omit to fetch all branches           |
| `prune`           | `boolean`              |          | `true`       | Remove remote-tracking refs that no longer exist on the remote |
| `response_format` | `"markdown" \| "json"` |          | `"markdown"` | Output format                                                  |

**Example:**

```json
{ "tool": "git_fetch", "params": { "repo_path": "/home/user/myproject" } }
```

---

## git_pull

Fetches and integrates changes from a remote branch into the current branch.

| Parameter         | Type                   | Required | Default      | Description                                                          |
| ----------------- | ---------------------- | -------- | ------------ | -------------------------------------------------------------------- |
| `repo_path`       | `string`               | *        | —            | Absolute path to the repository                                      |
| `remote`          | `string`               |          | `"origin"`   | Remote to pull from                                                  |
| `branch`          | `string`               |          | —            | Remote branch to pull. Defaults to the current branch's upstream     |
| `rebase`          | `boolean`              |          | `false`      | Rebase local commits on top of the fetched branch instead of merging |
| `response_format` | `"markdown" \| "json"` |          | `"markdown"` | Output format                                                        |

**Example:**

```json
{ "tool": "git_pull", "params": { "repo_path": "/home/user/myproject", "rebase": true } }
```

---

## git_push

Uploads local commits to a remote repository.

::: warning Force push
`force: true` requires `GIT_ALLOW_FORCE_PUSH=true`. Prefer `force_with_lease: true`, which aborts if the remote has received new commits since your last fetch.
:::

| Parameter          | Type                   | Required | Default      | Description                                                       |
| ------------------ | ---------------------- | -------- | ------------ | ----------------------------------------------------------------- |
| `repo_path`        | `string`               | *        | —            | Absolute path to the repository                                   |
| `remote`           | `string`               |          | `"origin"`   | Remote to push to                                                 |
| `branch`           | `string`               |          | —            | Local branch to push. Defaults to the current branch              |
| `set_upstream`     | `boolean`              |          | `false`      | Set the upstream tracking ref (`-u`)                              |
| `force_with_lease` | `boolean`              |          | `false`      | Force push only if the remote ref matches your last-fetched state |
| `force`            | `boolean`              |          | `false`      | Force push unconditionally. Requires `GIT_ALLOW_FORCE_PUSH=true`  |
| `no_verify`        | `boolean`              |          | `false`      | Skip pre-push hooks. Requires `GIT_ALLOW_NO_VERIFY=true`          |
| `tags`             | `boolean`              |          | `false`      | Also push all local tags                                          |
| `response_format`  | `"markdown" \| "json"` |          | `"markdown"` | Output format                                                     |

**Example — first push of a new branch:**

```json
{
  "tool": "git_push",
  "params": {
    "repo_path": "/home/user/myproject",
    "set_upstream": true
  }
}
```

**Example — safe force push after a rebase:**

```json
{
  "tool": "git_push",
  "params": {
    "repo_path": "/home/user/myproject",
    "force_with_lease": true
  }
}
```

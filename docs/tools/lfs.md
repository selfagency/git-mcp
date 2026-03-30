---
title: LFS Tool
---

`git_lfs` manages [Git Large File Storage](https://git-lfs.com/) — an extension that replaces large binary files with text pointers and stores the actual file contents on a remote server.

## git_lfs

| Parameter         | Type                   | Required | Default      | Description                                                         |
| ----------------- | ---------------------- | -------- | ------------ | ------------------------------------------------------------------- |
| `repo_path`       | `string`               | *        | —            | Absolute path to the repository                                     |
| `action`          | `string`               | *        | —            | LFS operation (see below)                                           |
| `patterns`        | `string[]`             |          | —            | File patterns for `track` and `untrack` (e.g. `["*.psd", "*.zip"]`) |
| `remote`          | `string`               |          | `"origin"`   | Remote for `pull` and `push`                                        |
| `include`         | `string`               |          | —            | Include filter for `migrate-import` / `migrate-export`              |
| `exclude`         | `string`               |          | —            | Exclude filter for `migrate-import` / `migrate-export`              |
| `everything`      | `boolean`              |          | `false`      | When `true`, apply migrate operations to all refs                   |
| `response_format` | `"markdown" \| "json"` |          | `"markdown"` | Output format                                                       |

## Actions

| Action           | Description                                                              |
| ---------------- | ------------------------------------------------------------------------ |
| `install`        | Install LFS hooks in the repository (run once per clone)                 |
| `track`          | Register file patterns to be stored via LFS. Updates `.gitattributes`    |
| `untrack`        | Remove patterns from LFS tracking                                        |
| `ls-files`       | List all files currently managed by LFS                                  |
| `status`         | Show LFS-tracked files that differ between HEAD and the working tree     |
| `pull`           | Download LFS objects from a remote                                       |
| `push`           | Upload LFS objects to a remote                                           |
| `migrate-import` | Convert existing files matching a pattern to LFS, rewriting history      |
| `migrate-export` | Convert LFS-tracked files back to regular Git objects, rewriting history |

## Examples

**Install LFS hooks after cloning:**

```json
{ "tool": "git_lfs", "params": { "repo_path": "/home/user/myproject", "action": "install" } }
```

**Track design assets and videos:**

```json
{
  "tool": "git_lfs",
  "params": {
    "repo_path": "/home/user/myproject",
    "action": "track",
    "patterns": ["*.psd", "*.mp4", "*.zip"]
  }
}
```

**List all LFS-tracked files:**

```json
{ "tool": "git_lfs", "params": { "repo_path": "/home/user/myproject", "action": "ls-files" } }
```

**Pull LFS objects from origin:**

```json
{ "tool": "git_lfs", "params": { "repo_path": "/home/user/myproject", "action": "pull" } }
```

**Migrate existing `*.psd` files to LFS (rewrites history):**

::: warning
`migrate-import` rewrites commit history. Only use this on branches that have not been published, or coordinate with all collaborators before pushing the rewritten history.
:::

```json
{
  "tool": "git_lfs",
  "params": {
    "repo_path": "/home/user/myproject",
    "action": "migrate-import",
    "include": "*.psd",
    "everything": true
  }
}
```

## Prerequisites

Git LFS must be installed on the system. Verify with:

```bash
git lfs version
```

If LFS is not installed:

- **macOS**: `brew install git-lfs`
- **Ubuntu/Debian**: `apt install git-lfs`
- **Windows**: Download from [git-lfs.com](https://git-lfs.com/)

After installing, run `git lfs install` once globally or use `git_lfs` with `action: "install"` per repository.

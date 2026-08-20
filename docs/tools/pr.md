---
title: Pull Requests
---

`git_pr` creates, lists, and merges pull requests / merge requests on the detected forge provider (GitHub, GitLab, Forgejo, Gitea, Bitbucket). It uses the provider CLI (`gh`/`glab`/`tea`) when installed locally, otherwise the provider REST API with a `*_TOKEN` env var.

## Provider detection

The provider is detected from the `origin` remote URL:

| Host | Provider | CLI | Token |
| ---- | -------- | --- | ----- |
| `github.com` | GitHub | `gh` | `GITHUB_TOKEN` |
| `gitlab.com` | GitLab | `glab` | `GITLAB_TOKEN` |
| `codeberg.org` | Forgejo | `tea` | `FORGEJO_TOKEN` |
| `gitea.com` | Gitea | `tea` | `FORGEJO_TOKEN` |
| `bitbucket.org` | Bitbucket | — | `BITBUCKET_TOKEN` |

For self-hosted instances that cannot be detected from the hostname, set `GIT_FORGE_PROVIDER` to `github` | `gitlab` | `forgejo` | `gitea` | `bitbucket`.

## Tool

### `git_pr`

| Parameter         | Type                   | Description                                                              |
| ----------------- | ---------------------- | ------------------------------------------------------------------------ |
| `repo_path`       | `string`               | Absolute path to the Git repository.                                     |
| `action`          | `"create" \| "list" \| "merge"` | Pull request operation.                                          |
| `title`           | `string`               | PR/MR title (create).                                                    |
| `body`            | `string`               | PR/MR body/description (create).                                         |
| `base`            | `string`               | Target branch (create, default `main`).                                  |
| `head`            | `string`               | Source branch (create, default `HEAD`).                                  |
| `state`           | `"open" \| "closed" \| "all"` | Filter for list (default `open`).                                  |
| `number`          | `number`               | PR/MR number (merge).                                                    |
| `method`          | `"merge" \| "squash" \| "rebase"` | Merge method (merge).                                            |
| `response_format` | `"markdown" \| "json"` | Output format. Defaults to `"markdown"`.                                 |

## Actions

### `create`

Create a pull request / merge request.

```text
git_pr  action=create  title="feat: add analytics"  base=main  head=feature/analytics
```

### `list`

List pull requests / merge requests.

```text
git_pr  action=list  state=open
```

### `merge`

Merge a pull request / merge request.

```text
git_pr  action=merge  number=42  method=squash
```

## Configuration

| Env var               | Description                                                              |
| --------------------- | ------------------------------------------------------------------------ |
| `GITHUB_TOKEN`        | GitHub token (REST fallback).                                            |
| `GITLAB_TOKEN`        | GitLab token (REST fallback).                                            |
| `FORGEJO_TOKEN`       | Forgejo/Gitea token (REST fallback).                                     |
| `BITBUCKET_TOKEN`     | Bitbucket token (REST fallback).                                         |
| `GIT_FORGE_PROVIDER`  | Explicit provider override for self-hosted instances.                    |

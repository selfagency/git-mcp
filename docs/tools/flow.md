---
title: Git Flow Tool
---

`git_flow` implements the [Gitflow branching model](https://nvie.com/posts/a-successful-git-branching-model/) directly — no `git-flow` CLI binary required.

Gitflow defines a strict branching structure with dedicated branches for features, releases, hotfixes, and ongoing support.

## git_flow

| Parameter         | Type                   | Required | Default      | Description                                              |
| ----------------- | ---------------------- | -------- | ------------ | -------------------------------------------------------- |
| `repo_path`       | `string`               | *        | —            | Absolute path to the repository                          |
| `action`          | `string`               | *        | —            | Gitflow operation (see below)                            |
| `name`            | `string`               |          | —            | Branch name for the feature, release, hotfix, or support |
| `main_branch`     | `string`               |          | `"main"`     | Production branch name (used during `init`)              |
| `develop_branch`  | `string`               |          | `"develop"`  | Integration branch name (used during `init`)             |
| `remote`          | `string`               |          | `"origin"`   | Remote for publish operations                            |
| `tag`             | `boolean`              |          | `true`       | Create a tag when finishing a release or hotfix          |
| `tag_message`     | `string`               |          | —            | Annotation for the tag created on finish                 |
| `delete_branch`   | `boolean`              |          | `true`       | Delete the branch after finishing                        |
| `response_format` | `"markdown" \| "json"` |          | `"markdown"` | Output format                                            |

## Actions

| Action            | Description                                                                   |
| ----------------- | ----------------------------------------------------------------------------- |
| `init`            | Initialize Gitflow in the repository (creates `develop` if it does not exist) |
| `feature-start`   | Create a new feature branch from `develop`                                    |
| `feature-finish`  | Merge a feature branch back into `develop`                                    |
| `feature-publish` | Push a feature branch to the remote                                           |
| `feature-list`    | List all open feature branches                                                |
| `release-start`   | Create a release branch from `develop`                                        |
| `release-finish`  | Merge release into `main` and `develop`, create a tag                         |
| `release-publish` | Push a release branch to the remote                                           |
| `release-list`    | List all open release branches                                                |
| `hotfix-start`    | Create a hotfix branch from `main`                                            |
| `hotfix-finish`   | Merge hotfix into `main` and `develop`, create a tag                          |
| `hotfix-list`     | List all open hotfix branches                                                 |
| `support-start`   | Create a long-term support branch from a tag                                  |
| `support-list`    | List all open support branches                                                |

## Typical Workflow

**1. Initialize:**

```json
{ "tool": "git_flow", "params": { "repo_path": "/home/user/myproject", "action": "init" } }
```

**2. Start a feature:**

```json
{
  "tool": "git_flow",
  "params": { "repo_path": "/home/user/myproject", "action": "feature-start", "name": "user-auth" }
}
```

This creates `feature/user-auth` from `develop`.

**3. Publish the feature (optional):**

```json
{
  "tool": "git_flow",
  "params": { "repo_path": "/home/user/myproject", "action": "feature-publish", "name": "user-auth" }
}
```

**4. Finish the feature:**

```json
{
  "tool": "git_flow",
  "params": { "repo_path": "/home/user/myproject", "action": "feature-finish", "name": "user-auth" }
}
```

Merges `feature/user-auth` into `develop` and deletes the branch.

**5. Start a release:**

```json
{
  "tool": "git_flow",
  "params": { "repo_path": "/home/user/myproject", "action": "release-start", "name": "1.2.0" }
}
```

**6. Finish the release:**

```json
{
  "tool": "git_flow",
  "params": {
    "repo_path": "/home/user/myproject",
    "action": "release-finish",
    "name": "1.2.0",
    "tag_message": "Release 1.2.0"
  }
}
```

Merges into `main` and `develop`, creates tag `v1.2.0`.

**7. Emergency hotfix:**

```json
{
  "tool": "git_flow",
  "params": { "repo_path": "/home/user/myproject", "action": "hotfix-start", "name": "1.2.1" }
}
```

```json
{
  "tool": "git_flow",
  "params": { "repo_path": "/home/user/myproject", "action": "hotfix-finish", "name": "1.2.1" }
}
```

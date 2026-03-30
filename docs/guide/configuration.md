---
title: Configuration
---

git-mcp is configured exclusively through environment variables. No config file is required.

## Environment Variables

| Variable                | Default | Description                                                                                                             |
| ----------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------- |
| `GIT_REPO_PATH`         | —       | Default repository path. Used when `repo_path` is omitted from tool calls. Also settable via `--repo-path` CLI flag.    |
| `GIT_ALLOW_NO_VERIFY`   | `false` | Set to `true` to permit `no_verify: true` on `git_commit` and `git_push`. When `false`, the option is silently ignored. |
| `GIT_ALLOW_FORCE_PUSH`  | `false` | Set to `true` to permit `force: true` on `git_push`. Without it, only `force_with_lease` is available.                  |
| `GIT_AUTO_SIGN_COMMITS` | `false` | Set to `true` to automatically sign every commit, even when `sign: false` is passed.                                    |
| `GIT_AUTO_SIGN_TAGS`    | `false` | Set to `true` to automatically sign every annotated tag.                                                                |
| `GIT_SIGNING_KEY`       | —       | Default signing key — a GPG key ID (e.g. `A1B2C3D4`) or path to an SSH key (e.g. `/home/user/.ssh/id_ed25519`).         |
| `GIT_SIGNING_FORMAT`    | —       | Signing format: `openpgp`, `ssh`, or `x509`.                                                                            |

## Setting Variables

### MCP client config (recommended)

Pass variables in the `env` block of your MCP server config. This scopes them to git-mcp only:

```json
{
  "mcpServers": {
    "git": {
      "command": "npx",
      "args": ["-y", "@selfagency/git-mcp"],
      "env": {
        "GIT_REPO_PATH": "/home/user/myproject",
        "GIT_ALLOW_FORCE_PUSH": "true"
      }
    }
  }
}
```

### Shell environment

Export variables before starting the server:

```bash
export GIT_REPO_PATH=/home/user/myproject
export GIT_AUTO_SIGN_COMMITS=true
export GIT_SIGNING_KEY=A1B2C3D4
export GIT_SIGNING_FORMAT=openpgp
npx @selfagency/git-mcp
```

### CLI flag

The `--repo-path` flag is equivalent to `GIT_REPO_PATH`:

```bash
npx @selfagency/git-mcp --repo-path /home/user/myproject
```

## Signing Configuration

To enable commit and tag signing:

1. Ensure your Git signing setup works locally (`git config --global user.signingkey` etc.)
2. Set `GIT_SIGNING_KEY` to your key ID or SSH key path
3. Set `GIT_SIGNING_FORMAT` to `openpgp`, `ssh`, or `x509`
4. Optionally set `GIT_AUTO_SIGN_COMMITS=true` and/or `GIT_AUTO_SIGN_TAGS=true`

Per-request signing can also be enabled by passing `sign: true` (and optionally `signing_key`) to `git_commit` or `git_tag`.

## Security Flags

`GIT_ALLOW_FORCE_PUSH` and `GIT_ALLOW_NO_VERIFY` are **opt-in only**.

- Without `GIT_ALLOW_FORCE_PUSH=true`, calling `git_push` with `force: true` falls back to a safe push (the `force` field is ignored).
- Without `GIT_ALLOW_NO_VERIFY=true`, `no_verify: true` on `git_commit` / `git_push` is ignored and hooks always run.

This ensures that even if an AI assistant requests a dangerous operation, it cannot succeed unless you have explicitly permitted it at the server level.

See also: [Safety model](/guide/safety)

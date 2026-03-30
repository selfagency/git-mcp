---
title: Safety Model
---

git-mcp is built around the principle that **every mutating Git action can lose work**. The server applies several layers of protection to prevent accidental or AI-induced data loss.

## Inspect Before Mutate

Tools are grouped by risk level. Inspection tools (`git_status`, `git_log`, `git_diff`, etc.) have no side effects and can always be called freely. Write tools impose additional constraints.

## Hard Reset Requires Explicit Confirmation

`git_reset` supports `soft`, `mixed`, and `hard` modes. A **hard reset** permanently discards working tree changes and cannot be undone. To prevent accidental data loss, the `confirm` parameter must be set to `true` for hard resets:

```json
{
  "tool": "git_reset",
  "params": {
    "repo_path": "/path/to/repo",
    "mode": "hard",
    "target": "HEAD~1",
    "confirm": true
  }
}
```

If `confirm` is `false` or absent and `mode` is `hard`, the tool returns an error explaining the requirement.

## Force Push is Opt-In

Force pushes rewrite published history and can permanently erase commits for other collaborators. The `force` option on `git_push` is **silently ignored** unless the server is started with:

```bash
GIT_ALLOW_FORCE_PUSH=true
```

`force_with_lease` is always available — it is a safer alternative that aborts if the remote has received new commits since your last fetch.

## No-Verify is Opt-In

Git hooks (pre-commit, commit-msg, pre-push) exist to enforce quality standards. Bypassing them with `--no-verify` is a deliberate opt-out. The `no_verify` option on `git_commit` and `git_push` is ignored unless:

```bash
GIT_ALLOW_NO_VERIFY=true
```

## Preferring Revert Over Reset

When an AI assistant needs to undo a published commit, git-mcp favors `git_revert` over `git_reset`. Revert creates a new commit that inverts the changes, preserving the history visible to other collaborators. Reset rewrites history and should only be used for local, unpublished work.

## Path Traversal Prevention

All file path arguments are validated against the repository root. Paths that attempt directory traversal (`../../etc/passwd`) are rejected with a clear error. git-mcp never allows file operations outside the declared repository root.

## History-Rewriting Operations

Operations that rewrite history — `git_rebase`, `git_reset --hard`, and force push — are explicitly identified in their documentation. The server:

- Does not initiate these operations unless the user's prompt clearly requests them
- Returns rollback guidance alongside any mutating operation where applicable
- Reports in-progress merge, rebase, cherry-pick, or bisect state before allowing new operations that could conflict

## Sensitive Data

git-mcp never logs or returns:

- SSH keys or GPG private key material
- Remote URLs that contain embedded credentials (`https://user:token@host`)
- Contents of `.env` files or secrets stored in the working tree

If a remote URL contains credentials, the credentials are redacted in response output.

## Summary of Safeguards

| Operation          | Safeguard                            |
| ------------------ | ------------------------------------ |
| Hard reset         | `confirm: true` required             |
| Force push         | `GIT_ALLOW_FORCE_PUSH=true` required |
| No-verify bypass   | `GIT_ALLOW_NO_VERIFY=true` required  |
| Path traversal     | Rejected at validation layer         |
| Credential leakage | URLs redacted in output              |
| History rewrite    | Explicit user intent required        |

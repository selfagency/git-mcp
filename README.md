# git-mcp

> A Git [MCP](https://modelcontextprotocol.io) server that doesn't suck

Exposes the full Git workflow to any MCP-compatible AI client — inspect, write, branch, remote, stash, rebase, LFS, git-flow, documentation lookup, and more. Designed to be safe by default, composable, and fast. Powered by [`simple-git`](https://github.com/steveukx/git-js).

---

## Features

- **30+ tools** covering everyday Git workflows and advanced recovery operations
- **Safety-first** — destructive operations require explicit confirmation; force push and hook bypass are opt-in via server config
- **GPG/SSH signing** for commits and tags, with server-level auto-sign support
- **Git LFS** — track patterns, manage objects, install hooks, migrate history
- **Git Flow** — full branching model (feature/release/hotfix/support) without requiring the `git-flow` CLI
- **Documentation lookup** — search git-scm.com and fetch man pages directly from the LLM
- **MCP Resources** — URI-addressable read-only views of status, log, branches, and diff
- **Bundled agent skill** — `skills/git-mcp-workflow/` documents MCP-first Git workflows, recovery, worktrees, releases, and advanced operations for agent users
- **Multi-repo** — pass `repo_path` per-call or configure a server-level default
- **Cross-platform** — macOS, Linux, Windows (Git for Windows)

---

## Quick Start

### npx (no install)

```bash
npx @selfagency/git-mcp --repo-path /path/to/your/repo
```

### Install globally

```bash
npm install -g @selfagency/git-mcp
git-mcp --repo-path /path/to/your/repo
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "git": {
      "command": "npx",
      "args": ["-y", "@selfagency/git-mcp", "--repo-path", "/path/to/your/repo"]
    }
  }
}
```

### VS Code (Copilot)

Add to `.vscode/mcp.json` in your project:

```json
{
  "servers": {
    "git": {
      "command": "npx",
      "args": ["-y", "@selfagency/git-mcp", "--repo-path", "${workspaceFolder}"]
    }
  }
}
```

---

## Configuration

All configuration is via environment variables. Pass them in your MCP client config:

| Variable                | Default | Description                                           |
| ----------------------- | ------- | ----------------------------------------------------- |
| `GIT_REPO_PATH`         | —       | Default repository path (also: `--repo-path` CLI arg) |
| `GIT_ALLOW_NO_VERIFY`   | `false` | Allow `--no-verify` on commit/push (bypasses hooks)   |
| `GIT_ALLOW_FORCE_PUSH`  | `false` | Allow `--force` on push                               |
| `GIT_AUTO_SIGN_COMMITS` | `false` | Automatically sign every commit                       |
| `GIT_AUTO_SIGN_TAGS`    | `false` | Automatically sign every tag                          |
| `GIT_SIGNING_KEY`       | —       | Default GPG key ID or SSH key path                    |
| `GIT_SIGNING_FORMAT`    | —       | Signing format: `openpgp`, `ssh`, or `x509`           |

---

## Tool Reference

### Inspect (read-only)

| Tool         | Description                                |
| ------------ | ------------------------------------------ |
| `git_status` | Working tree and branch status             |
| `git_log`    | Commit history with filters and pagination |
| `git_show`   | Patch and metadata for any ref             |
| `git_diff`   | Unstaged, staged, or ref-to-ref diff       |
| `git_blame`  | Line-level author attribution              |
| `git_reflog` | HEAD movement history for recovery         |

### Write

| Tool          | Description                              |
| ------------- | ---------------------------------------- |
| `git_add`     | Stage files                              |
| `git_restore` | Restore paths from index or a source ref |
| `git_commit`  | Create commits (amend, sign, no-verify)  |
| `git_reset`   | Soft/mixed/hard reset                    |
| `git_revert`  | Safe undo via revert commit              |

### Branches

| Tool                | Description                      |
| ------------------- | -------------------------------- |
| `git_list_branches` | List local or all branches       |
| `git_create_branch` | Create branch from HEAD or ref   |
| `git_delete_branch` | Delete a local branch            |
| `git_rename_branch` | Rename a branch                  |
| `git_checkout`      | Switch to branch, tag, or commit |
| `git_set_upstream`  | Set upstream tracking            |

### Remote

| Tool         | Description                               |
| ------------ | ----------------------------------------- |
| `git_remote` | Add, remove, or set-url for a remote      |
| `git_fetch`  | Fetch with optional pruning               |
| `git_pull`   | Pull with merge or rebase                 |
| `git_push`   | Push (force-with-lease, force, no-verify) |

### Advanced

| Tool              | Description                                 |
| ----------------- | ------------------------------------------- |
| `git_stash`       | Save, list, apply, pop, or drop stashes     |
| `git_rebase`      | Start, continue, skip, or abort rebase      |
| `git_cherry_pick` | Start, continue, or abort cherry-pick       |
| `git_bisect`      | Binary search to find regressions           |
| `git_tag`         | List, create, or delete tags (with signing) |
| `git_worktree`    | Add, list, or remove worktrees              |
| `git_submodule`   | Add, list, update, or sync submodules       |

### Context & Config

| Tool                  | Description                                |
| --------------------- | ------------------------------------------ |
| `git_context_summary` | High-signal repo summary for LLM workflows |
| `git_search`          | Pickaxe + grep across history              |
| `git_get_config`      | Read git config values                     |
| `git_set_config`      | Write repository-local git config          |

### LFS

| Tool      | Description                                               |
| --------- | --------------------------------------------------------- |
| `git_lfs` | Track patterns, pull/push objects, install hooks, migrate |

### Git Flow

| Tool       | Description                                       |
| ---------- | ------------------------------------------------- |
| `git_flow` | Init, feature, release, hotfix, support workflows |

### Documentation

| Tool       | Description                           |
| ---------- | ------------------------------------- |
| `git_docs` | Search git-scm.com or fetch man pages |

---

## MCP Resources

URI-addressable read-only snapshots (subscribe-capable):

| Resource URI                      | Content                       |
| --------------------------------- | ----------------------------- |
| `git+repo://status/{repo_path}`   | Working tree status (JSON)    |
| `git+repo://log/{repo_path}`      | Recent commit log (JSON)      |
| `git+repo://branches/{repo_path}` | Branch list (JSON)            |
| `git+repo://diff/{repo_path}`     | Unstaged + staged diff (JSON) |

---

## Development

```bash
# Clone and install
git clone https://github.com/selfagency/git-mcp.git
cd git-mcp
pnpm install

# Run in development mode (hot reload)
pnpm dev

# Build
pnpm build

# Run tests
pnpm test

# Type check
pnpm typecheck

# Lint
pnpm lint

# Docs (dev server)
pnpm docs:dev

# Docs (build)
pnpm docs:build
```

---

## Safety

- All mutating tools have `destructiveHint: true` in their MCP annotations
- `git_reset --hard` requires `confirm=true`
- Force push (`--force`) is disabled unless `GIT_ALLOW_FORCE_PUSH=true`
- Hook bypass (`--no-verify`) is disabled unless `GIT_ALLOW_NO_VERIFY=true`
- Paths are validated against the repository root — traversal attempts are rejected
- Credentials and tokens are never included in responses

---

## License

MIT © [Daniel Sieradski](https://self.agency)

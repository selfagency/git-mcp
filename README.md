# git-mcp

> A Git [MCP](https://modelcontextprotocol.io) server that doesn't suck

Exposes the full Git workflow to any MCP-compatible AI client — inspect, write, branch, remote, stash, rebase, LFS, git-flow, documentation lookup, and more. Designed to be safe by default, composable, and fast. Powered by [`simple-git`](https://github.com/steveukx/git-js).

---

## Features

- **11 grouped tools with 60+ actions** covering everyday Git workflows and advanced recovery operations
- **Safety-first** — destructive operations require explicit confirmation; force push and hook bypass are opt-in via server config
- **GPG/SSH signing** for commits and tags, with server-level auto-sign support
- **Git LFS** — track patterns, manage objects, install hooks, migrate history
- **Git Flow** — git-flow-next-style workflow support with preset init, overview, config CRUD, generalized topic actions, finish recovery, optional hook/filter parity, and classic feature/release/hotfix/support aliases, without requiring the external CLI
- **Documentation lookup** — search git-scm.com and fetch man pages directly from the LLM
- **MCP Resources** — URI-addressable read-only views of status, log, branches, and diff
- **Bundled agent skill** — `skills/git-mcp-workflow/` documents MCP-first Git workflows, recovery, worktrees, releases, and advanced operations for agent users; installable via [`skills-npm`](https://github.com/antfu/skills-npm)
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
| `GIT_ALLOW_FLOW_HOOKS`  | `false` | Allow `git_flow` hooks and filters to execute         |
| `GIT_AUTO_SIGN_COMMITS` | `false` | Automatically sign every commit                       |
| `GIT_AUTO_SIGN_TAGS`    | `false` | Automatically sign every tag                          |
| `GIT_SIGNING_KEY`       | —       | Default GPG key ID or SSH key path                    |
| `GIT_SIGNING_FORMAT`    | —       | Signing format: `openpgp`, `ssh`, or `x509`           |

---

## Tool Reference

Tools are grouped by domain. Each root tool takes an `action` parameter that selects the operation. Where an action is marked as default, omitting `action` will use it.

### Context (`git_context`)

| Action       | Description                                                                               |
| ------------ | ----------------------------------------------------------------------------------------- |
| `summary`    | _(default)_ Full repo snapshot: branch, upstream, pending changes, in-progress operations |
| `search`     | Search commit history and working tree content                                            |
| `get_config` | Read a Git config value                                                                   |
| `set_config` | Write a Git config value                                                                  |
| `aliases`    | List all configured git aliases                                                           |

### Status (`git_status`)

| Action      | Description                                                                  |
| ----------- | ---------------------------------------------------------------------------- |
| `status`    | _(default)_ Working tree and branch status                                   |
| `diff`      | Unstaged, staged, or ref-to-ref diff                                         |
| `diff_main` | Changes from branch divergence point vs `main` (or configurable base branch) |

### History (`git_history`)

| Action   | Description                                                                       |
| -------- | --------------------------------------------------------------------------------- |
| `log`    | _(default)_ Commit log with filtering, pagination, revision ranges, and pathspecs |
| `show`   | Inspect a single commit                                                           |
| `blame`  | Line-by-line attribution for a file                                               |
| `reflog` | Full reflog — the recovery ledger                                                 |
| `lg`     | Compact graph log (`--oneline --graph --decorate --all`)                          |
| `who`    | Contributor shortlog (supports optional `file_path`)                              |

### Commits (`git_commits`)

| Action    | Description                                             |
| --------- | ------------------------------------------------------- |
| `add`     | Stage files or hunks                                    |
| `restore` | Discard working tree changes                            |
| `unstage` | Remove files from the staging area                      |
| `commit`  | Create a commit with message, signing, and author flags |
| `amend`   | Amend the last commit without editing the message       |
| `wip`     | Stage all changes and commit with message `WIP`         |
| `revert`  | Create a revert commit for a given ref                  |
| `undo`    | Soft-reset the last commit (`reset --soft HEAD~1`)      |
| `reset`   | Reset HEAD with configurable mode (soft/mixed/hard)     |
| `nuke`    | Hard-reset the last commit — requires `confirm=true`    |

### Branches (`git_branches`)

| Action         | Description                                 |
| -------------- | ------------------------------------------- |
| `list`         | _(default)_ Local and remote branch listing |
| `create`       | Create a branch                             |
| `delete`       | Delete a branch                             |
| `rename`       | Rename a branch                             |
| `checkout`     | Switch to a branch or ref                   |
| `set_upstream` | Set or update tracking upstream             |
| `recent`       | Recent branches sorted by committer date    |

### Remotes (`git_remotes`)

| Action   | Description                                    |
| -------- | ---------------------------------------------- |
| `list`   | _(default)_ List configured remotes            |
| `manage` | Add, remove, or rename a remote                |
| `fetch`  | Fetch from a remote                            |
| `pull`   | Pull (fetch + merge/rebase)                    |
| `push`   | Push to a remote; `force_with_lease` supported |

### Workspace (`git_workspace`)

| Action        | Description                                                   |
| ------------- | ------------------------------------------------------------- |
| `stash`       | Stash and pop/apply/drop/list/show stash entries              |
| `stash_all`   | Stash tracked and untracked changes in one operation          |
| `rebase`      | Start, continue, abort, or skip a rebase                      |
| `cherry_pick` | Apply one or more commits; supports continue/abort/skip       |
| `merge`       | Merge branches with full flag control                         |
| `bisect`      | Binary search for a regression (start, good, bad, reset, log) |
| `tag`         | Create, list, delete, or push tags; supports GPG/SSH signing  |
| `worktree`    | Add, list, remove, or prune linked worktrees                  |
| `submodule`   | Add, update, sync, init, deinit, and list submodules          |

### Git Flow (`git_flow`)

Preset git-flow-next workflow without requiring the external CLI.

| Operation  | Description                                                     |
| ---------- | --------------------------------------------------------------- |
| `init`     | Initialize a repository with git-flow branch conventions        |
| `overview` | Show the current flow state and active branches                 |
| `config`   | Read or write git-flow configuration values                     |
| `topic`    | Generalized topic branch action (start, finish, publish, track) |
| `control`  | Flow control: resume interrupted finish, abort, or recover      |

### LFS (`git_lfs`)

| Action           | Description                                |
| ---------------- | ------------------------------------------ |
| `track`          | Add a tracking pattern to `.gitattributes` |
| `untrack`        | Remove a tracking pattern                  |
| `ls-files`       | List tracked LFS files                     |
| `status`         | Show LFS status                            |
| `pull`           | Pull LFS objects                           |
| `push`           | Push LFS objects                           |
| `install`        | Install LFS hooks in the repository        |
| `migrate-import` | Migrate existing history to LFS            |
| `migrate-export` | Migrate LFS history back to plain objects  |

### Documentation (`git_docs`)

| Action   | Description                          |
| -------- | ------------------------------------ |
| `search` | Search git-scm.com for documentation |
| `man`    | Fetch and return a Git man page      |

### Health Check (`git_ping`)

Returns server status. Useful for confirming the server is reachable.

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

## Bundled Agent Skill

git-mcp ships a bundled agent skill at `skills/git-mcp-workflow/` that teaches any `skills-npm`-compatible agent to use the MCP tool surface instead of running raw `git` CLI commands. The skill covers:

- Why LLMs must not use the Git CLI (quoting hazards, silent failures)
- Inspect-before-mutate workflow rules
- Safety order for undo and recovery operations
- Full registered tool surface with action reference
- Workflow playbooks: feature branch, rebase, recovery, worktree, backport, release tagging, Git Flow, merge
- Git concept explanations anchored to MCP tools

### Installing the skill

If your agent supports [skills-npm](https://github.com/antfu/skills-npm):

```bash
npm install @selfagency/git-mcp   # or pnpm/yarn
npx skills-npm
```

Or add to your project's `package.json` so it runs automatically:

```json
{
  "scripts": {
    "prepare": "skills-npm"
  }
}
```

Then add to `.gitignore`:

```txt
skills/npm-*
```

---

## Safety

- All mutating tools have `destructiveHint: true` in their MCP annotations
- `git_commits action=reset mode=hard` requires `confirm=true`
- `git_commits action=nuke` requires `confirm=true`
- Force push (`--force`) is disabled unless `GIT_ALLOW_FORCE_PUSH=true`; `force_with_lease` is always available
- Hook bypass (`--no-verify`) is disabled unless `GIT_ALLOW_NO_VERIFY=true`
- `git_flow` hook and filter execution is disabled unless `GIT_ALLOW_FLOW_HOOKS=true`
- Paths are validated against the repository root — traversal attempts are rejected
- Credentials and tokens are never included in responses

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

## License

MIT © [Daniel Sieradski](https://self.agency)

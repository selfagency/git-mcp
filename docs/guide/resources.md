---
title: MCP Resources
---

git-mcp exposes four read-only MCP resources that map common Git views to URI-addressable endpoints. Resource-aware clients can subscribe to these URIs and receive structured JSON rather than calling tools.

## Available Resources

| URI                               | Description                                       |
| --------------------------------- | ------------------------------------------------- |
| `git+repo://status/{repo_path}`   | Working tree status (staged, unstaged, untracked) |
| `git+repo://log/{repo_path}`      | The 20 most recent commits                        |
| `git+repo://branches/{repo_path}` | All local branches with tracking info             |
| `git+repo://diff/{repo_path}`     | Unstaged and staged changes                       |

## URI Format

The `{repo_path}` segment is the **absolute path** to the repository, URI-encoded. For example:

```text
git+repo://status//home/user/myproject
git+repo://log//Users/dan/dev/app
```

> On Windows, encode the drive letter path:
> `git+repo://status/C%3A%5CUsers%5Cdan%5Cdev%5Capp`

## Resource Contents

### `git+repo://status/{repo_path}`

Returns a JSON object mirroring the output of `git status --porcelain=v2`. Fields include:

- `staged` — files in the index (key: file path, value: status code)
- `unstaged` — files modified in the working tree
- `untracked` — new files not yet tracked
- `branch` — current branch name or `HEAD` if detached
- `tracking` — upstream ref and ahead/behind counts

### `git+repo://log/{repo_path}`

Returns a JSON array of up to 20 commit objects, each with:

- `hash` — full commit SHA
- `short` — abbreviated SHA (7 chars)
- `author` — `{ name, email }`
- `date` — ISO 8601 timestamp
- `message` — commit subject line
- `body` — commit body (may be empty)

### `git+repo://branches/{repo_path}`

Returns a JSON array of branch objects, each with:

- `name` — local branch name
- `current` — `true` if currently checked out
- `upstream` — tracking remote ref (or `null`)
- `ahead` — commits ahead of upstream
- `behind` — commits behind upstream

### `git+repo://diff/{repo_path}`

Returns a JSON object with:

- `staged` — unified diff of staged changes
- `unstaged` — unified diff of unstaged changes

## When to Use Resources vs. Tools

Use **resources** when:

- Your client supports resource subscriptions and you want live updates
- You need a lightweight snapshot without additional parameters
- You are building a resource-aware UI on top of MCP

Use **tools** when:

- You need filtering, pagination, or custom options (e.g. `git_log` with `author`, `since`, or `grep`)
- You need a response format other than JSON (e.g. `markdown`)
- You are performing any write operation

## Public Agent Discovery Endpoints

The documentation site publishes additional static discovery metadata for crawlers and AI agents:

| Endpoint | Purpose |
| --- | --- |
| `/.well-known/api-catalog` | High-level discovery links for docs and MCP metadata |
| `/.well-known/mcp/server-card.json` | Server metadata card describing transport and capabilities |
| `/.well-known/agent-skills/index.json` | Index of published agent skill files with digest metadata |
| `/.well-known/agent-skills/git-mcp-overview/SKILL.md` | Human-readable skill profile for git-mcp |
| `/robots.txt` | Crawl policy including AI/model crawler directives |

These files are intended for web discovery of project capabilities and do not replace MCP runtime discovery inside connected clients.

## Static Hosting Constraints

This site is hosted as static content (GitHub Pages), so discovery metadata is static at build time:

- No dynamic capability negotiation or per-client responses
- No request signing or auth handshakes at `/.well-known/*`
- No runtime mutation of skill indexes or server cards

For runtime behavior, always trust live MCP server capabilities exposed by the connected transport/session.

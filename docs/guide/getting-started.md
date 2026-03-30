---
title: Getting Started
---

git-mcp is a production-grade [Model Context Protocol](https://modelcontextprotocol.io) server that gives AI assistants full access to Git workflows. It uses [simple-git](https://github.com/steveukx/git-js) under the hood and requires only a system Git installation — no other dependencies.

## Prerequisites

- Node.js 20 or later
- Git installed and available on `PATH`
- An MCP-compatible client (Claude Desktop, VS Code Copilot, etc.)

## Installation

### npx (no install required)

Run git-mcp on demand without installing anything globally:

```bash
npx @selfagency/git-mcp
```

### Global install

```bash
npm install -g @selfagency/git-mcp
git-mcp
```

### From source

```bash
git clone https://github.com/selfagency/git-mcp.git
cd git-mcp
pnpm install
pnpm build
pnpm start
```

## Connecting to Claude Desktop

Edit your Claude Desktop configuration file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "git": {
      "command": "npx",
      "args": ["-y", "@selfagency/git-mcp"],
      "env": {
        "GIT_REPO_PATH": "/path/to/your/repo"
      }
    }
  }
}
```

Restart Claude Desktop after saving the file. You should see a hammer icon in the chat toolbar indicating MCP tools are available.

## Connecting to VS Code (GitHub Copilot)

### User settings

Add to your VS Code `settings.json` (`Cmd+Shift+P` → "Open User Settings (JSON)"):

```json
{
  "mcp": {
    "servers": {
      "git": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "@selfagency/git-mcp"],
        "env": {
          "GIT_REPO_PATH": "${workspaceFolder}"
        }
      }
    }
  }
}
```

### Workspace `.vscode/mcp.json`

For per-project configuration, create `.vscode/mcp.json` in the root of your repository:

```json
{
  "servers": {
    "git": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@selfagency/git-mcp"],
      "env": {
        "GIT_REPO_PATH": "${workspaceFolder}"
      }
    }
  }
}
```

## Setting a Default Repository

The `GIT_REPO_PATH` environment variable sets the default repository path used by all tools when `repo_path` is not provided in the tool call:

```bash
GIT_REPO_PATH=/home/user/myproject git-mcp
```

You can also pass it on the command line:

```bash
npx @selfagency/git-mcp --repo-path /home/user/myproject
```

If neither is set, the AI must provide `repo_path` explicitly in every tool call.

## Verifying the Installation

Ask your AI assistant:

> "What's the git status of this repo?"

or

> "Show me the last 5 commits."

The AI will call `git_status` or `git_log` and stream results back. If you see an error about `repo_path`, set `GIT_REPO_PATH` in the server configuration.

## Next Steps

- [Configuration reference](/guide/configuration) — all environment variables
- [MCP Resources](/guide/resources) — URI-addressable read-only data
- [Tool reference](/tools/) — complete parameter documentation for every tool
- [Safety model](/guide/safety) — how git-mcp protects against destructive operations

---
layout: home

hero:
  name: git-mcp
  text: Git for AI Assistants
  tagline: A production-grade Model Context Protocol server giving AI clients full Git workflow access — inspect, write, branch, remote, LFS, git-flow, and more.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Tool Reference
      link: /tools/
    - theme: alt
      text: GitHub
      link: https://github.com/selfagency/git-mcp

features:
  - icon: 🔍
    title: Complete Inspection
    details: Status, log, diff, blame, reflog — everything you need to understand the current repository state.
  - icon: ✍️
    title: Safe Writes
    details: Stage, commit, reset, and revert with built-in safety guardrails. Hard reset requires explicit confirmation; force push is opt-in.
  - icon: 🌿
    title: Branch Workflows
    details: Create, delete, rename, checkout, and track branches. Includes git-flow-next-style presets, config graphs, recovery flows, and classic alias compatibility without requiring an external git-flow binary.
  - icon: 🔗
    title: Remote Operations
    details: Fetch, pull, and push — including force-with-lease for safer force pushes. Remote management built in.
  - icon: 🔏
    title: Signing Support
    details: GPG and SSH signing for commits and tags. Configure per-request or set server-wide auto-sign defaults.
  - icon: 📦
    title: LFS Support
    details: Track file patterns, install hooks, pull/push LFS objects, and migrate existing history into or out of LFS.
  - icon: 📚
    title: Documentation Lookup
    details: Search git-scm.com and fetch man pages directly from the LLM. Ask git questions without leaving the chat.
  - icon: 🔌
    title: MCP Resources
    details: URI-addressable read-only snapshots of status, log, branches, and diff for resource-aware MCP clients.
---

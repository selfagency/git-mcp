# Git MCP Server Implementation Plan

## Objective

Build a production-minded TypeScript MCP server for Git operations using `simple-git` as the sole backend. Prioritize day-to-day developer workflows, recovery operations, and clear safety guardrails for destructive actions.

## Key decisions

- Backend: `simple-git` only (no `nodegit`, no `isomorphic-git`)
- MCP SDK: `@modelcontextprotocol/sdk` v1.x
- Transport: stdio first
- Input validation: Zod for every tool
- Output model: stable DTOs + concise markdown-oriented text content
- Cross-platform target: macOS, Linux, Windows (Git for Windows)

## Delivery phases

### Phase 0 — Project alignment

1. Update `.github/copilot-instructions.md` to codify:
   - simple-git-only backend
   - tool consolidation rules
   - safety rules for destructive operations
   - Windows compatibility expectations
2. Create this implementation plan in `docs/IMPLEMENTATION.md`.

### Phase 1 — Foundation

1. Update `package.json`:
   - remove `nodegit`
   - add `simple-git`, `@modelcontextprotocol/sdk`, `zod`
   - add scripts: `dev`, `build`, `start`, `lint`, `test`
2. Add project config:
   - `tsconfig.json` (strict TS)
   - `tsup.config.ts` (Node-friendly bundle)
3. Create base source structure:
   - `src/index.ts`
   - `src/constants.ts`
   - `src/types.ts`
   - `src/git/client.ts` (single execution adapter + error normalization + path safety)
   - `src/schemas/index.ts`

### Phase 2 — Core daily workflow tools

- `git_status`
- `git_add`
- `git_restore`
- `git_commit`
- `git_diff`
- `git_log`
- `git_show`
- `git_checkout`
- `git_list_branches`
- `git_create_branch`
- `git_delete_branch`
- `git_merge`
- `git_fetch`
- `git_pull`
- `git_push`
- `git_revert`
- `git_reset` (guarded; hard reset requires explicit confirmation)

### Phase 3 — Recovery and advanced workflows

- `git_reflog`
- `git_stash` (action-based: save/list/apply/pop/drop)
- `git_rebase` (start/continue/abort/skip)
- `git_cherry_pick` (start/continue/abort)
- `git_bisect` (start/good/bad/skip/run/reset)
- `git_tag` (list/create/delete)
- `git_worktree` (add/list/remove)
- `git_submodule` (add/list/update/sync)

### Phase 4 — Agent-optimized tools and resources

- `git_context_summary`
- `git_search` (pickaxe + grep style)
- `git_get_config`
- `git_set_config`
- Resources:
  - `git+repo://{path}/status`
  - `git+repo://{path}/log`
  - `git+repo://{path}/branches`
  - `git+repo://{path}/diff`

### Phase 5 — Verification

1. Build: `pnpm build`
2. Lint: `pnpm lint`
3. Tests (Vitest):
   - path traversal rejection
   - status parsing
   - destructive-operation guardrails
   - force-push behavior (`--force-with-lease` only)
4. Smoke test server start

## Safety model

- Inspect-before-mutate defaults
- Explicit confirmation for destructive actions (`reset --hard`, etc.)
- Revert preferred over history rewrite for published commits
- Never use bare `--force`; only `--force-with-lease`
- Return actionable rollback guidance when possible

## Tool-count strategy

Keep the surface compact via action-based tools where appropriate, targeting practical everyday use plus robust recovery support rather than maximal command parity.

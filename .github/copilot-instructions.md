# GitHub Copilot Instructions

You are assisting on a TypeScript Model Context Protocol (MCP) server project that implements an advanced Git server using `simple-git` (Git CLI wrapper) as the Git engine.

## Project goals

* Build a reliable, composable, production-minded Git MCP server.
* Use `simple-git` as the primary backend for Git operations.
* Assume system Git is available (`git` on macOS/Linux, `git.exe` from Git for Windows on Windows).
* Keep the MCP surface small, explicit, and well validated.
* Optimize for correctness, safety, and observability over cleverness.
* Treat Git mutation as risky by default.

## MCP architecture rules

* Follow the MCP TypeScript SDK conventions already present in the repo.
* Unless the repository explicitly opts into SDK v2, target the stable v1.x SDK APIs for production work.
* Use snake_case tool names with clear action verbs and Git context, for example:
  * `git_list_branches`
  * `git_get_status`
  * `git_create_branch`
  * `git_commit`
  * `git_merge`
* Use Zod schemas for all tool inputs.
* Keep tool handlers thin.
* Put Git logic in dedicated service modules, not in the MCP transport layer.
* Use resources for read-only, URI-addressable data.
* Use tools for actions that mutate state.
* When returning large collections, paginate and apply a `CHARACTER_LIMIT`.
* Prefer markdown responses for human-readable output and JSON only when the caller clearly needs machine-friendly structure.
* Emit notifications only when server state or capabilities genuinely change.

## Git domain design rules

* Model Git concepts explicitly:
  * repositories
  * remotes
  * branches
  * tags
  * commits
  * trees
  * stashes
  * reflog entries
  * worktrees
  * submodules
* Preserve the distinction between:
  * repository state inspection
  * repository mutation
  * history rewriting
  * transport/network operations
* Prefer tool inputs that model user intent (for example `action` enums) when this reduces tool count without harming clarity.
* Prefer safe operations first:
  * inspect before mutate
  * dry-run when available
  * avoid irreversible changes unless explicitly requested
* Never assume a destructive action is acceptable without explicit intent.
* For history-rewriting operations such as reset, rebase, and force push, require clear safeguards and clear user intent.
* Prefer `git revert` behavior over rewriting history when the goal is to undo published changes.
* Treat detached HEAD, unborn branches, bare repositories, and dirty working trees as first-class cases.
* Validate paths against the repository root and reject traversal attempts.

## Git backend rules (`simple-git` only)

* Use `simple-git` as the only backend.
* Do not add `nodegit` or `isomorphic-git`.
* Keep all command invocation through `simple-git` argument arrays (no shell interpolation).
* Support both SSH and HTTPS remotes through system Git configuration.
* Treat Git binary compatibility as first-class on macOS, Linux, and Windows (Git for Windows).
* Do not parse human-only porcelain output when machine-readable forms are available.
* Centralize command execution and error normalization in one adapter module.

## TypeScript standards

* Use `strict` TypeScript patterns.
* Prefer explicit return types for exported functions.
* Avoid `any`.
* Use `unknown` only when immediately narrowed.
* Prefer `readonly` data and `as const` where appropriate.
* Keep functions small and single-purpose.
* Prefer pure helpers for formatting, parsing, and normalization.
* Use discriminated unions for tool results and domain outcomes where helpful.
* Use `async`/`await` consistently for I/O and process work.
* Do not introduce unnecessary abstractions.
* Keep public exports minimal.

## Tool and resource design

* Keep read-only views as resources when the data is naturally URI-addressable.
* Keep the tool catalog practical for daily developer workflows and recovery workflows.
* Prefer a single tool with an explicit `action` enum when operations are tightly related and share schemas.
* Do not split tools purely for implementation convenience.
* Prioritize common workflows:
  * status, add, restore, commit, diff, log, checkout/switch, branch, fetch/pull/push, merge, reset, revert
* Include popular advanced workflows:
  * stash
  * rebase and cherry-pick
  * reflog and bisect
  * worktree
  * submodule
* When a result can be large, paginate it and truncate safely.
* When truncating, explain what was omitted and how to retrieve more.
* Return stable, predictable shapes from tool handlers.

## Error handling rules

* Return clear, actionable error messages.
* Distinguish between:
  * invalid user input
  * repository state issues
  * permission issues
  * missing Git binary/configuration
  * Git conflicts
  * network failures
  * unsupported operations
* Never swallow errors silently.
* Preserve enough context for debugging, but do not leak secrets, tokens, or private repository contents.
* If a Git conflict exists, report which operation failed and what the user should inspect next.
* If a command is unsafe in the current repository state, explain why and how to proceed safely.

## Formatting and linting rules

* Use `oxlint` for linting.
* Use `oxfmt` for formatting.
* Do not introduce ESLint or Prettier unless the repository explicitly needs them for compatibility.
* Respect the repo’s Oxc configuration files.
* Keep lint rules and formatting consistent with existing config.
* Prefer small, clean diffs over broad mechanical rewrites.
* Before finishing any change, ensure formatting and linting pass.

## Build and development rules

* Use `tsx` for development-time execution.
* Use `tsup` for bundling production output.
* Keep `tsup` Node-friendly:
  * target Node runtime semantics
  * externalize runtime-only dependencies when appropriate
  * emit source maps when useful
  * emit type declarations if the project expects published artifacts
* Do not add a heavy build pipeline unless the project truly needs it.
* Keep the development workflow fast and reproducible.
* Do not use `ts-node` or legacy runners if `tsx` already covers the workflow.
* Prefer watch-based local development with `tsx` and incremental builds where appropriate.

## Safe Git behavior

* Assume every mutating Git action can lose work.
* Before mutation, inspect:
  * current branch
  * worktree status
  * upstream tracking
  * outstanding stashes
  * open merges/rebases/cherry-picks/bisects
  * detached HEAD state
* Prefer a non-destructive alternative when one exists.
* Do not auto-force push.
* Do not auto-reset hard.
* Do not auto-clean untracked files.
* Do not rewrite history unless the user explicitly asked for it and the risk is understood.
* If an operation could affect published history, call that out clearly.
* When possible, provide rollback guidance alongside any mutating operation.

## Testing guidance

* Add or update tests for:
  * clean and dirty working trees
  * detached HEAD
  * merge conflicts
  * stashes
  * worktrees
  * submodules
  * large repos and pagination
  * invalid refs and missing objects
  * path traversal rejection
* Prefer deterministic fixture repositories.
* Avoid real network dependencies in tests unless transport behavior is the purpose.
* Verify both success paths and failure paths.
* If a change affects output formatting, snapshot tests should reflect stable public shape only.

## Code organization guidance

* Keep the codebase layered:
  * transport / MCP wiring
  * validation
  * Git domain services
  * simple-git adapter
  * formatting / serialization
* Extract shared helpers early instead of duplicating logic across tools.
* Use consistent DTOs for commits, refs, statuses, diffs, and repository summaries.
* Keep protocol-specific code out of core Git logic.

## Documentation and comments

* Write comments only where they add operational value.
* Prefer self-explanatory names over verbose commentary.
* Document safety constraints on mutating Git tools.
* Document platform-specific Git binary setup when needed.
* Keep README examples aligned with actual tool names and behavior.

## What to avoid

* Do not invent unsupported MCP APIs.
* Do not use unstable SDK patterns unless the repo is explicitly on that track.
* Do not introduce `nodegit`.
* Do not introduce `isomorphic-git`.
* Do not use unsafe shell interpolation for Git commands.
* Do not make destructive Git changes by default.
* Do not return huge unpaginated blobs of text.
* Do not leak secrets, private URLs, or tokenized values into logs or responses.
* Do not introduce formatting or linting tools that conflict with `oxlint` and `oxfmt`.

## Preferred implementation mindset

* Inspect before mutate.
* Validate before action.
* Keep the public contract simple.
* Make failure states understandable.
* Prefer reversible operations.
* Build with long-term maintainability in mind.

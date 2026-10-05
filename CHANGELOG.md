# Change Log

## [Unreleased]

### Breaking

- **flow**: `git_flow` now drives the [git-flow-next](https://git-flow.sh) CLI and requires it installed and on `PATH` (`brew install git-flow-next`, or the releases page; override with `GIT_FLOW_BINARY`). The in-process reimplementation is gone. A missing binary returns an install hint rather than failing opaquely.
  - Repositories left mid-finish by the previous implementation are not recoverable by the CLI — that state lived in `gitflow.state.finish.*` config keys the CLI does not read. Resolve them with plain `git` (`git status`, `git merge --abort`) before switching.
  - Removed parameters, each with no CLI equivalent: `pattern`, `match_mode` (`prefix` only), `no_backmerge`, `remote`, `delete_branch` (duplicated `keep_branch`). `staging_branch` and `production_branch` remain in the schema but raise on `init`, which has no `--staging`/`--production` in 2.1.0 — use `preset: "gitlab"`.
  - Added: `worktree`, `worktrees`, `worktree_path`, `keep_worktree`, `force_worktree`, `recover`, `shared`, and `config_action: "status" | "sync"`.
  - `response_format: "json"` now returns the same text as `markdown`. git-flow-next 2.1.0 defines no `--format` flag; the published command reference documents one the released binary rejects.

### Fixed

- **windows**: resolve external binaries through `PATH` and `PATHEXT`, so npm-installed `.cmd` shims (`gh`, `glab`, `jj`, `but`) are found instead of reported as missing. Since Node 18.20.2 these cannot be spawned by bare name via `execFile`.
- **windows**: forward-slash temporary paths before embedding them in `git filter-branch --msg-filter`. Git for Windows runs that script through its bundled `sh`, where a backslash path inside double quotes has its escapes eaten, so `rewrite` with `reword`/`squash`/`rewrite_messages` failed to read the message file.
- **windows**: run git-flow hooks and filters through the Git for Windows `sh.exe`, discovered relative to `git --exec-path`. Hooks are `#!/bin/sh` scripts with no Windows exec association.
- **windows**: kill process trees with `taskkill /T /F` instead of `SIGKILL`, which Windows maps to a flat terminate and leaves grandchildren holding the repository lock.

### Added

- **worktree**: `git_worktree` gains `flow_add`, `flow_remove`, `flow_list`, and `flow_path`, driving `git flow worktree`. These address worktrees by branch name, place them from the `gitflow.worktreePath` template, and record the ones git-flow created — the provenance that lets `finish` and `delete` remove a git-flow-created worktree while detaching a hand-made one instead of destroying uncommitted work. The existing path-addressed actions remain on plain `git worktree`, so worktrees still need nothing beyond git.
- **ci**: run an `ubuntu-latest` + `windows-latest` matrix. git-flow-next is installed on both runners from a pinned, checksum-verified release, so the Windows and git-flow code paths execute rather than skip.

## [0.3.0] - 2026-08-20

## 📦 Uncategorized

- feat(mcp-registry): complete MCP Registry quickstart compliance
  - PR: #10
- fix(remote): resolve default remote in push + external VCS awareness + git-flow hotfix
  - PR: #12
- fix(quality): resolve SonarQube code smells
  - PR: #16

_Source: changes from v0.2.2 to v0.3.0._

## [0.2.2] - 2026-04-18

## What's Changed

- feat: harden git operations and expand coverage by @selfagency in https://github.com/selfagency/git-mcp/pull/9

**Full Changelog**: https://github.com/selfagency/git-mcp/compare/v0.2.1...v0.2.2

_Source: changes from v0.2.1 to v0.2.2._

## [0.2.1] - 2026-04-17

## What's Changed

- chore(deps): bump hono from 4.12.12 to 4.12.14 in the npm_and_yarn group across 1 directory by @dependabot[bot] in https://github.com/selfagency/git-mcp/pull/8

**Full Changelog**: https://github.com/selfagency/git-mcp/compare/v0.2.0...v0.2.1

_Source: changes from v0.2.0 to v0.2.1._

## [0.2.0] - 2026-04-15

## What's Changed

- chore(deps-dev): bump vite from 6.4.1 to 6.4.2 in the npm_and_yarn group across 1 directory by @dependabot[bot] in https://github.com/selfagency/git-mcp/pull/4
- chore(deps): bump the npm_and_yarn group across 1 directory with 2 updates by @dependabot[bot] in https://github.com/selfagency/git-mcp/pull/5
- feat: add git-flow-next workflow engine by @selfagency in https://github.com/selfagency/git-mcp/pull/6
- feat: replace individual tools with grouped tool architecture + skills-npm by @selfagency in https://github.com/selfagency/git-mcp/pull/7

## New Contributors

- @dependabot[bot] made their first contribution in https://github.com/selfagency/git-mcp/pull/4

**Full Changelog**: https://github.com/selfagency/git-mcp/compare/v0.1.2...v0.2.0

_Source: changes from v0.1.2 to v0.2.0._

## [0.1.2] - 2026-03-31

## What's Changed

- fix: improve release auth and rollback by @selfagency in https://github.com/selfagency/git-mcp/pull/3

**Full Changelog**: https://github.com/selfagency/git-mcp/compare/v0.1.1...v0.1.2

_Source: changes from v0.1.1 to v0.1.2._

## [0.1.1] - 2026-03-31

## What's Changed

- docs: add git-mcp workflow skill by @selfagency in <https://github.com/selfagency/git-mcp/pull/2>

**Full Changelog**: <https://github.com/selfagency/git-mcp/compare/v0.1.0...v0.1.1>

_Source: changes from v0.1.0 to v0.1.1._

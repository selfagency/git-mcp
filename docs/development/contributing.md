---
title: Contributing
---

Contributions are welcome. Please follow the guidelines below to keep the codebase consistent and the review process smooth.

## Prerequisites

- Node.js 20 or later
- pnpm 10 or later
- Git 2.38 or later (for `--format=...` options used in tests)

## Setup

```bash
git clone https://github.com/selfagency/git-mcp.git
cd git-mcp
pnpm install
pnpm build
```

Start the development server with hot reload:

```bash
pnpm dev
```

## Before Submitting a PR

Run the full gate:

```bash
pnpm typecheck   # TypeScript strict checks
pnpm lint        # oxlint
pnpm format:check  # oxfmt
pnpm test        # vitest
```

All four must pass. CI runs the same checks.

## Code Style

### Formatter

Use `oxfmt` for all TypeScript and Markdown files:

```bash
pnpm format      # format everything
pnpm format:check  # check without writing
```

Do not use Prettier. Do not introduce ESLint.

### Linter

Use `oxlint`:

```bash
pnpm lint        # check
pnpm lint:fix    # fix auto-fixable issues
```

### TypeScript

- `strict: true` — no exceptions
- No `any` — use `unknown` and narrow immediately if truly needed
- Explicit return types on all exported functions
- Prefer `readonly` and `as const` where appropriate
- `async`/`await` consistently — no `.then()`/`.catch()` chains

### Architecture rules

- Tools delegate to services. No Git logic in tool handlers.
- Services delegate to the git adapter. No `simple-git` calls in services.
- Config is read from `src/config.ts`, not from `process.env` directly.
- Shared Zod schemas live in `src/schemas/`.

## Adding a New Tool

1. **Add Zod schema** in `src/schemas/` (if new shared params are needed)
2. **Add service function** in the relevant `src/services/*.service.ts`
3. **Register tool** in the relevant `src/tools/*.tools.ts`
4. **Update `src/index.ts`** if a new tool file is added
5. **Write tests** in `src/services/__tests__/`
6. **Document** in the corresponding `docs/tools/*.md` page

Follow the naming convention: `git_<verb>_<noun>` in snake_case.

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```text
feat: add git_cherry_pick tool
fix: handle detached HEAD in git_status
docs: add LFS prerequisites section
test: add edge cases for git_reset hard mode
chore: upgrade simple-git to 3.27
```

Types: `feat`, `fix`, `docs`, `test`, `chore`, `refactor`, `perf`, `ci`

## Pull Request Process

1. Fork the repository and create a branch from `main`
2. Make your changes following the guidelines above
3. Run the full gate (`typecheck`, `lint`, `format:check`, `test`)
4. Open a PR with a clear description of what changed and why
5. Link any related issues in the PR description

PRs that fail CI, introduce `any`, skip tests, or bypass the formatter will not be merged until fixed.

## Reporting Issues

Use [GitHub Issues](https://github.com/selfagency/git-mcp/issues). Include:

- git-mcp version (`npx @selfagency/git-mcp --version`)
- Node.js version (`node --version`)
- Git version (`git --version`)
- OS and architecture
- Minimal reproduction steps
- Actual vs. expected behaviour

---
title: Architecture
---

git-mcp is structured as a layered TypeScript application. Each layer has a single responsibility, and dependencies only flow downward.

```text
┌─────────────────────────────────────┐
│           MCP Transport             │  src/index.ts
│       (StdioServerTransport)        │
├─────────────────────────────────────┤
│           Tool Handlers             │  src/tools/*.tools.ts
│      (Zod validation, routing)      │
├─────────────────────────────────────┤
│           Git Services              │  src/services/*.service.ts
│       (Domain logic, safety)        │
├─────────────────────────────────────┤
│           simple-git adapter        │  src/git/
│      (Command execution, errors)    │
└─────────────────────────────────────┘
```

## Directory Structure

```text
src/
├── index.ts              # MCP server entry point; registers tools and resources
├── config.ts             # Environment variable parsing
├── constants.ts          # CHARACTER_LIMIT, tool names, shared constants
├── types.ts              # Shared TypeScript types and DTOs
├── git/                  # simple-git adapter and error normalisation
├── schemas/              # Shared Zod schemas (repo_path, response_format, etc.)
├── tools/                # MCP tool handlers (one file per tool group)
│   ├── inspect.tools.ts
│   ├── write.tools.ts
│   ├── branch.tools.ts
│   ├── remote.tools.ts
│   ├── advanced.tools.ts
│   ├── context.tools.ts
│   ├── lfs.tools.ts
│   ├── flow.tools.ts
│   └── docs.tools.ts
├── services/             # Git domain services (one file per tool group)
│   ├── inspect.service.ts
│   ├── write.service.ts
│   ├── branch.service.ts
│   ├── remote.service.ts
│   ├── advanced.service.ts
│   ├── context.service.ts
│   ├── lfs.service.ts
│   ├── flow.service.ts
│   ├── docs.service.ts
│   └── __tests__/        # Service unit tests
└── resources/            # MCP resource handlers
```

## Layer Responsibilities

### Transport layer (`src/index.ts`)

- Creates the MCP server instance using `@modelcontextprotocol/sdk`
- Registers all tools by importing tool handler groups
- Registers all MCP resources
- Starts `StdioServerTransport`

### Tool handlers (`src/tools/*.tools.ts`)

- Accept raw MCP tool call inputs
- Validate parameters with Zod schemas
- Delegate to the corresponding service function
- Format and return the response
- **Never contain Git logic**

### Services (`src/services/*.service.ts`)

- Contain all domain logic
- Enforce safety constraints (e.g. hard reset confirmation, force push gating)
- Call the simple-git adapter to execute Git commands
- Return typed DTOs or formatted strings
- **Never import MCP SDK types**

### Git adapter (`src/git/`)

- Wraps `simple-git`
- Provides a consistent interface for all Git commands
- Normalises Git error messages into structured errors
- Handles platform differences

## Schemas

Shared Zod schemas live in `src/schemas/`. Each tool group may have its own schema file. Common schemas (`repo_path`, `response_format`) are defined once and imported everywhere.

## Configuration

`src/config.ts` parses environment variables at startup and exports a typed `config` object. Tools import from `config` rather than reading `process.env` directly.

## Response Formatting

All tool responses support two formats:

- `"markdown"` (default) — a human-readable string, often using code blocks or tables
- `"json"` — a JSON object suitable for programmatic consumption

Formatting helpers are co-located with the service that produces the data.

## Character Limit

Large outputs are truncated to `CHARACTER_LIMIT` (defined in `src/constants.ts`) to avoid overwhelming MCP clients. When truncation occurs, the response includes a message indicating how much was omitted and how to retrieve more (e.g. by using `limit`/`offset`).

## Error Model

Errors are returned as structured error objects with:

- `isError: true` in the MCP response
- A human-readable message explaining what went wrong
- Where applicable, guidance on how to resolve the issue

No errors are swallowed silently. Git conflicts, invalid refs, missing binaries, permission issues, and validation failures all produce distinct messages.

## Build

```bash
pnpm build       # tsup bundles src/ → dist/
pnpm start       # node dist/index.js
pnpm dev         # tsx watch src/index.ts (hot reload)
pnpm typecheck   # tsc --noEmit
```

`tsup` is configured to target Node.js, produce CJS output, and emit type declarations.

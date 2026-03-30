---
title: Testing
---

git-mcp uses [Vitest](https://vitest.dev/) for all tests. Tests are co-located with the services they test in `src/services/__tests__/`.

## Running Tests

```bash
pnpm test              # run all tests once
pnpm test:coverage     # run with coverage report
pnpm dev               # tsx watch also hot-reloads tests when in watch mode
```

## Test Structure

Tests are organized by service module:

```text
src/services/__tests__/
├── inspect.service.test.ts
├── write.service.test.ts
├── branch.service.test.ts
├── remote.service.test.ts
├── context.service.test.ts
└── advanced.service.test.ts
```

Each test file mirrors its service file and independently mocks the `git/client.js` adapter layer:

```ts
vi.mock('../../git/client.js', () => ({
  getGit: vi.fn(),
  validateRepoPath: vi.fn((p: string) => p),
  toGitError: vi.fn((e: unknown) => ({ kind: 'unknown', message: String(e) })),
}));
```

This means all tests run **without a real Git binary or repository**. Git operations are simulated using `vi.fn()` factories.

## Writing a Test

### Helper factory

Create a mock `git` object with `vi.fn()` stubs for every method the service under test will call:

```ts
function makeGit(overrides: Record<string, unknown> = {}) {
  return {
    status: vi.fn().mockResolvedValue({ current: 'main', files: [], isClean: () => true }),
    raw: vi.fn().mockResolvedValue(''),
    diffSummary: vi.fn().mockResolvedValue({ files: [] }),
    ...overrides,
  };
}
```

### Test structure

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getGit } from '../../git/client.js';
import { getStatus } from '../inspect.service.js';

// ... mock setup above ...

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getStatus', () => {
  it('returns branch name', async () => {
    const git = makeGit({
      status: vi.fn().mockResolvedValue({
        current: 'feature/auth',
        tracking: 'origin/feature/auth',
        ahead: 0,
        behind: 0,
        files: [],
        isClean: () => true,
      }),
    });
    vi.mocked(getGit).mockReturnValue(git as any);

    const result = await getStatus('/repo');
    expect(result.branch).toBe('feature/auth');
  });
});
```

## What to Test

Cover these scenarios for every service function:

| Scenario               | Description                                              |
| ---------------------- | -------------------------------------------------------- |
| Happy path             | Normal inputs, expected output                           |
| Empty / clean state    | Clean working tree, empty log, no remotes                |
| Boundary values        | `limit: 1`, `limit: 200`, empty `paths[]`                |
| Safety guards          | Hard reset without `confirm`, force push without env var |
| Error propagation      | Simulated Git failures return structured errors          |
| Detached HEAD          | `current` is `null` or a SHA                             |
| Dirty working tree     | Files in multiple states (staged, unstaged, untracked)   |
| In-progress operations | Simulated merge/rebase/cherry-pick in progress           |

## Mocking Git errors

Simulate a Git failure by rejecting the mock:

```ts
const git = makeGit({
  status: vi.fn().mockRejectedValue(new Error('not a git repository')),
});
vi.mocked(getGit).mockReturnValue(git as any);

await expect(getStatus('/not/a/repo')).rejects.toThrow();
```

## Coverage

Run `pnpm test:coverage` to generate a V8 coverage report. The report is written to `coverage/`. Aim for high branch coverage on safety-critical code paths (reset modes, force flags, confirmation checks).

## Integration Tests

If you are testing transport-level behaviour (stdio framing, large payloads, concurrent requests), create a separate test in `src/__tests__/` and spin up the server as a child process. These tests require a real Git binary and should be clearly marked with a `[integration]` prefix in the test name.

```bash
# Run only integration tests
pnpm test --reporter=verbose src/__tests__
```

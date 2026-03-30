import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the git client module
vi.mock('../../git/client.js', () => ({
  getGit: vi.fn(),
  validateRepoPath: vi.fn((p: string) => p),
  toGitError: vi.fn((e: unknown) => ({ kind: 'unknown', message: String(e) })),
}));

import { getGit } from '../../git/client.js';
import {
  runBisectAction,
  runCherryPickAction,
  runRebaseAction,
  runStashAction,
  runSubmoduleAction,
  runTagAction,
  runWorktreeAction,
} from '../advanced.service.js';

function makeGit(overrides: Record<string, unknown> = {}) {
  return {
    raw: vi.fn().mockResolvedValue(''),
    tags: vi.fn().mockResolvedValue({ all: [] }),
    tag: vi.fn().mockResolvedValue(''),
    addTag: vi.fn().mockResolvedValue(''),
    addAnnotatedTag: vi.fn().mockResolvedValue(''),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Stash
// ---------------------------------------------------------------------------
describe('runStashAction', () => {
  it('saves a stash', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('Saved working directory') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await runStashAction('/repo', { action: 'save' });
    expect(git.raw).toHaveBeenCalledWith(['stash', 'push']);
    expect(result).toBe('Saved working directory');
  });

  it('saves stash with message and includeUntracked', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('Saved') });
    vi.mocked(getGit).mockReturnValue(git as any);
    await runStashAction('/repo', { action: 'save', message: 'wip', includeUntracked: true });
    expect(git.raw).toHaveBeenCalledWith(['stash', 'push', '--include-untracked', '-m', 'wip']);
  });

  it('lists stashes', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('stash@{0}: wip') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await runStashAction('/repo', { action: 'list' });
    expect(result).toBe('stash@{0}: wip');
  });

  it('returns "No stashes." when list is empty', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await runStashAction('/repo', { action: 'list' });
    expect(result).toBe('No stashes.');
  });

  it('applies stash at index 0 by default', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await runStashAction('/repo', { action: 'apply' });
    expect(git.raw).toHaveBeenCalledWith(['stash', 'apply', 'stash@{0}']);
    expect(result).toBe('Applied stash@{0}.');
  });

  it('pops stash at given index', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    await runStashAction('/repo', { action: 'pop', index: 2 });
    expect(git.raw).toHaveBeenCalledWith(['stash', 'pop', 'stash@{2}']);
  });

  it('drops stash', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    await runStashAction('/repo', { action: 'drop', index: 1 });
    expect(git.raw).toHaveBeenCalledWith(['stash', 'drop', 'stash@{1}']);
  });
});

// ---------------------------------------------------------------------------
// Rebase
// ---------------------------------------------------------------------------
describe('runRebaseAction', () => {
  it('throws when start has no onto', async () => {
    const git = makeGit();
    vi.mocked(getGit).mockReturnValue(git as any);
    await expect(runRebaseAction('/repo', { action: 'start' })).rejects.toThrow('onto is required');
  });

  it('starts rebase onto given ref', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await runRebaseAction('/repo', { action: 'start', onto: 'main' });
    expect(git.raw).toHaveBeenCalledWith(['rebase', 'main']);
    expect(result).toBe('Rebase started onto main.');
  });

  it('continues rebase', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await runRebaseAction('/repo', { action: 'continue' });
    expect(git.raw).toHaveBeenCalledWith(['rebase', '--continue']);
    expect(result).toBe('Rebase continued.');
  });

  it('aborts rebase', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    await runRebaseAction('/repo', { action: 'abort' });
    expect(git.raw).toHaveBeenCalledWith(['rebase', '--abort']);
  });

  it('skips rebase commit', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    await runRebaseAction('/repo', { action: 'skip' });
    expect(git.raw).toHaveBeenCalledWith(['rebase', '--skip']);
  });
});

// ---------------------------------------------------------------------------
// Cherry-pick
// ---------------------------------------------------------------------------
describe('runCherryPickAction', () => {
  it('starts cherry-pick', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await runCherryPickAction('/repo', { action: 'start', ref: 'abc123' });
    expect(git.raw).toHaveBeenCalledWith(['cherry-pick', 'abc123']);
    expect(result).toBe('Cherry-picked abc123.');
  });

  it('throws when start has no ref', async () => {
    const git = makeGit();
    vi.mocked(getGit).mockReturnValue(git as any);
    await expect(runCherryPickAction('/repo', { action: 'start' })).rejects.toThrow('ref is required');
  });

  it('continues cherry-pick', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    await runCherryPickAction('/repo', { action: 'continue' });
    expect(git.raw).toHaveBeenCalledWith(['cherry-pick', '--continue']);
  });

  it('aborts cherry-pick', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    await runCherryPickAction('/repo', { action: 'abort' });
    expect(git.raw).toHaveBeenCalledWith(['cherry-pick', '--abort']);
  });
});

// ---------------------------------------------------------------------------
// Bisect
// ---------------------------------------------------------------------------
describe('runBisectAction', () => {
  it('throws without goodRef and badRef on start', async () => {
    const git = makeGit();
    vi.mocked(getGit).mockReturnValue(git as any);
    await expect(runBisectAction('/repo', { action: 'start' })).rejects.toThrow('goodRef and badRef are required');
  });

  it('starts bisect', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await runBisectAction('/repo', { action: 'start', goodRef: 'v1.0', badRef: 'HEAD' });
    expect(result).toContain('good=v1.0');
    expect(result).toContain('bad=HEAD');
  });

  it('marks current commit as good', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    await runBisectAction('/repo', { action: 'good' });
    expect(git.raw).toHaveBeenCalledWith(['bisect', 'good']);
  });

  it('marks commit as bad with ref', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    await runBisectAction('/repo', { action: 'bad', ref: 'HEAD~3' });
    expect(git.raw).toHaveBeenCalledWith(['bisect', 'bad', 'HEAD~3']);
  });

  it('skips commit', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    await runBisectAction('/repo', { action: 'skip' });
    expect(git.raw).toHaveBeenCalledWith(['bisect', 'skip']);
  });

  it('throws when run has no command', async () => {
    const git = makeGit();
    vi.mocked(getGit).mockReturnValue(git as any);
    await expect(runBisectAction('/repo', { action: 'run' })).rejects.toThrow('command is required');
  });

  it('runs bisect with command', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    await runBisectAction('/repo', { action: 'run', command: 'make test' });
    expect(git.raw).toHaveBeenCalledWith(['bisect', 'run', 'sh', '-lc', 'make test']);
  });

  it('resets bisect', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    await runBisectAction('/repo', { action: 'reset' });
    expect(git.raw).toHaveBeenCalledWith(['bisect', 'reset']);
  });
});

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------
describe('runTagAction', () => {
  it('lists tags', async () => {
    const git = makeGit({ tags: vi.fn().mockResolvedValue({ all: ['v1.0', 'v2.0'] }) });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await runTagAction('/repo', { action: 'list' });
    expect(result).toBe('v1.0\nv2.0');
  });

  it('returns "No tags." when list is empty', async () => {
    const git = makeGit({ tags: vi.fn().mockResolvedValue({ all: [] }) });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await runTagAction('/repo', { action: 'list' });
    expect(result).toBe('No tags.');
  });

  it('throws when delete has no name', async () => {
    const git = makeGit();
    vi.mocked(getGit).mockReturnValue(git as any);
    await expect(runTagAction('/repo', { action: 'delete' })).rejects.toThrow('name is required for delete action');
  });

  it('deletes a tag', async () => {
    const git = makeGit({ tag: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await runTagAction('/repo', { action: 'delete', name: 'v1.0' });
    expect(git.tag).toHaveBeenCalledWith(['-d', 'v1.0']);
    expect(result).toBe('Deleted tag v1.0.');
  });

  it('throws when create has no name', async () => {
    const git = makeGit();
    vi.mocked(getGit).mockReturnValue(git as any);
    await expect(runTagAction('/repo', { action: 'create' })).rejects.toThrow('name is required for create action');
  });

  it('creates a lightweight tag', async () => {
    const git = makeGit({ addTag: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await runTagAction('/repo', { action: 'create', name: 'v3.0' });
    expect(git.addTag).toHaveBeenCalledWith('v3.0');
    expect(result).toBe('Created tag v3.0.');
  });

  it('creates an annotated tag', async () => {
    const git = makeGit({ addAnnotatedTag: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await runTagAction('/repo', { action: 'create', name: 'v3.0', message: 'release' });
    expect(git.addAnnotatedTag).toHaveBeenCalledWith('v3.0', 'release');
    expect(result).toBe('Created annotated tag v3.0.');
  });
});

// ---------------------------------------------------------------------------
// Worktree
// ---------------------------------------------------------------------------
describe('runWorktreeAction', () => {
  it('lists worktrees', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('worktree /repo HEAD abc123\n') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await runWorktreeAction('/repo', { action: 'list' });
    expect(git.raw).toHaveBeenCalledWith(['worktree', 'list', '--porcelain']);
    expect(result).toBe('worktree /repo HEAD abc123');
  });

  it('throws when remove has no path', async () => {
    const git = makeGit();
    vi.mocked(getGit).mockReturnValue(git as any);
    await expect(runWorktreeAction('/repo', { action: 'remove' })).rejects.toThrow('path is required');
  });

  it('removes worktree', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await runWorktreeAction('/repo', { action: 'remove', path: '/wt1' });
    expect(git.raw).toHaveBeenCalledWith(['worktree', 'remove', '/wt1']);
    expect(result).toBe('Removed worktree /wt1.');
  });

  it('throws when add has no path or branch', async () => {
    const git = makeGit();
    vi.mocked(getGit).mockReturnValue(git as any);
    await expect(runWorktreeAction('/repo', { action: 'add' })).rejects.toThrow('path and branch are required');
  });

  it('adds worktree', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await runWorktreeAction('/repo', { action: 'add', path: '/wt1', branch: 'feature' });
    expect(git.raw).toHaveBeenCalledWith(['worktree', 'add', '/wt1', 'feature']);
    expect(result).toBe('Added worktree at /wt1 for feature.');
  });
});

// ---------------------------------------------------------------------------
// Submodule
// ---------------------------------------------------------------------------
describe('runSubmoduleAction', () => {
  it('lists submodules', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue(' abc123 path/sub (v1.0)') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await runSubmoduleAction('/repo', { action: 'list' });
    expect(git.raw).toHaveBeenCalledWith(['submodule', 'status']);
    expect(result).toBe('abc123 path/sub (v1.0)');
  });

  it('returns "No submodules." when status is empty', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await runSubmoduleAction('/repo', { action: 'list' });
    expect(result).toBe('No submodules.');
  });

  it('syncs submodules recursively', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    await runSubmoduleAction('/repo', { action: 'sync', recursive: true });
    expect(git.raw).toHaveBeenCalledWith(['submodule', 'sync', '--recursive']);
  });

  it('updates submodules with init', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    await runSubmoduleAction('/repo', { action: 'update', recursive: false });
    expect(git.raw).toHaveBeenCalledWith(['submodule', 'update', '--init']);
  });

  it('throws when add has no url or path', async () => {
    const git = makeGit();
    vi.mocked(getGit).mockReturnValue(git as any);
    await expect(runSubmoduleAction('/repo', { action: 'add' })).rejects.toThrow('url and path are required');
  });

  it('adds a submodule', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await runSubmoduleAction('/repo', { action: 'add', url: 'https://github.com/a/b', path: 'libs/b' });
    expect(git.raw).toHaveBeenCalledWith(['submodule', 'add', 'https://github.com/a/b', 'libs/b']);
    expect(result).toBe('Added submodule libs/b.');
  });
});

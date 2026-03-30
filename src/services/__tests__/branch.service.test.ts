import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../git/client.js', () => ({
  getGit: vi.fn(),
  validateRepoPath: vi.fn((p: string) => p),
  toGitError: vi.fn((e: unknown) => ({ kind: 'unknown', message: String(e) })),
}));

import { getGit } from '../../git/client.js';
import { checkoutRef, createBranch, deleteBranch, listBranches, renameBranch, setUpstream } from '../branch.service.js';

function makeGit(overrides: Record<string, unknown> = {}) {
  return {
    branch: vi.fn().mockResolvedValue({ all: [], current: '', branches: {} }),
    checkoutBranch: vi.fn().mockResolvedValue(''),
    checkout: vi.fn().mockResolvedValue(''),
    deleteLocalBranch: vi.fn().mockResolvedValue(''),
    checkoutLocalBranch: vi.fn().mockResolvedValue(''),
    raw: vi.fn().mockResolvedValue(''),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// listBranches
// ---------------------------------------------------------------------------
describe('listBranches', () => {
  it('lists local branches', async () => {
    const git = makeGit({
      branch: vi.fn().mockResolvedValue({
        all: ['main', 'dev'],
        current: 'main',
        branches: {
          main: { commit: 'abc', label: 'origin/main' },
          dev: { commit: 'def', label: 'origin/dev' },
        },
      }),
    });
    vi.mocked(getGit).mockReturnValue(git as any);
    const branches = await listBranches('/repo', false);
    expect(git.branch).toHaveBeenCalledWith([]);
    expect(branches).toHaveLength(2);
    expect(branches[0]).toMatchObject({ name: 'main', isCurrent: true, commit: 'abc' });
    expect(branches[1]).toMatchObject({ name: 'dev', isCurrent: false });
  });

  it('lists all branches with -a flag', async () => {
    const git = makeGit({
      branch: vi.fn().mockResolvedValue({ all: [], current: '', branches: {} }),
    });
    vi.mocked(getGit).mockReturnValue(git as any);
    await listBranches('/repo', true);
    expect(git.branch).toHaveBeenCalledWith(['-a']);
  });
});

// ---------------------------------------------------------------------------
// createBranch
// ---------------------------------------------------------------------------
describe('createBranch', () => {
  it('creates a branch without checkout', async () => {
    const git = makeGit({ branch: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await createBranch('/repo', { name: 'feat', checkout: false });
    expect(git.branch).toHaveBeenCalledWith(['feat']);
    expect(result).toBe('Created branch feat.');
  });

  it('creates and checks out a branch', async () => {
    const git = makeGit({
      branch: vi.fn().mockResolvedValue(''),
      checkout: vi.fn().mockResolvedValue(''),
    });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await createBranch('/repo', { name: 'feat', checkout: true });
    expect(git.branch).toHaveBeenCalledWith(['feat']);
    expect(git.checkout).toHaveBeenCalledWith('feat');
    expect(result).toBe('Created and checked out feat.');
  });

  it('creates branch from ref and checks out', async () => {
    const git = makeGit({
      checkoutBranch: vi.fn().mockResolvedValue(''),
      checkout: vi.fn().mockResolvedValue(''),
    });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await createBranch('/repo', { name: 'feat', fromRef: 'main', checkout: true });
    expect(git.checkoutBranch).toHaveBeenCalledWith('feat', 'main');
    expect(result).toContain('Created and checked out feat from main');
  });

  it('creates branch from ref without checkout stays on current branch', async () => {
    const git = makeGit({
      raw: vi.fn().mockResolvedValue(''),
      checkout: vi.fn().mockResolvedValue(''),
    });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await createBranch('/repo', { name: 'feat', fromRef: 'main', checkout: false });
    expect(git.raw).toHaveBeenCalledWith(['branch', 'feat', 'main']);
    expect(git.checkout).not.toHaveBeenCalled();
    expect(result).toContain('Created branch feat from main');
  });
});

// ---------------------------------------------------------------------------
// deleteBranch
// ---------------------------------------------------------------------------
describe('deleteBranch', () => {
  it('deletes a branch', async () => {
    const git = makeGit({ deleteLocalBranch: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await deleteBranch('/repo', { name: 'feat', force: false });
    expect(git.deleteLocalBranch).toHaveBeenCalledWith('feat', false);
    expect(result).toBe('Deleted branch feat.');
  });

  it('force deletes a branch', async () => {
    const git = makeGit({ deleteLocalBranch: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    await deleteBranch('/repo', { name: 'feat', force: true });
    expect(git.deleteLocalBranch).toHaveBeenCalledWith('feat', true);
  });
});

// ---------------------------------------------------------------------------
// renameBranch
// ---------------------------------------------------------------------------
describe('renameBranch', () => {
  it('renames a branch', async () => {
    const git = makeGit({ branch: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await renameBranch('/repo', 'old', 'new');
    expect(git.branch).toHaveBeenCalledWith(['-m', 'old', 'new']);
    expect(result).toBe('Renamed branch old to new.');
  });
});

// ---------------------------------------------------------------------------
// checkoutRef
// ---------------------------------------------------------------------------
describe('checkoutRef', () => {
  it('checks out an existing branch', async () => {
    const git = makeGit({ checkout: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await checkoutRef('/repo', 'main', false);
    expect(git.checkout).toHaveBeenCalledWith('main');
    expect(result).toBe('Checked out main.');
  });

  it('creates and checks out a new local branch', async () => {
    const git = makeGit({ checkoutLocalBranch: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await checkoutRef('/repo', 'new-branch', true);
    expect(git.checkoutLocalBranch).toHaveBeenCalledWith('new-branch');
    expect(result).toBe('Created and checked out new-branch.');
  });
});

// ---------------------------------------------------------------------------
// setUpstream
// ---------------------------------------------------------------------------
describe('setUpstream', () => {
  it('sets branch upstream tracking', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await setUpstream('/repo', 'feat', 'origin/feat');
    expect(git.raw).toHaveBeenCalledWith(['branch', '--set-upstream-to', 'origin/feat', 'feat']);
    expect(result).toBe('Set upstream of feat to origin/feat.');
  });
});

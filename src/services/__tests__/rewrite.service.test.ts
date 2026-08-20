import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../git/client.js', () => ({
  getGit: vi.fn(),
  validateRepoPath: vi.fn((p: string) => p),
  toGitError: vi.fn((e: unknown) => ({ kind: 'unknown', message: String(e) })),
}));

import { getGit } from '../../git/client.js';
import { createBackup, restoreBackup, rewordCommit, rewriteMessages, squashCommits } from '../rewrite.service.js';

function makeGit(overrides: Record<string, unknown> = {}) {
  return {
    raw: vi.fn().mockResolvedValue(''),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('rewordCommit', () => {
  it('amends HEAD in place', async () => {
    const git = makeGit();
    vi.mocked(getGit).mockReturnValue(git as never);
    const result = await rewordCommit('/repo', { message: 'new message' });
    expect(git.raw).toHaveBeenCalledWith(['commit', '--amend', '-m', 'new message']);
    expect(result).toContain('Reworded HEAD');
  });

  it('rewrites an arbitrary commit via filter-branch', async () => {
    const git = makeGit();
    vi.mocked(getGit).mockReturnValue(git as never);
    await rewordCommit('/repo', { ref: 'abc1234', message: 'new message' });
    expect(git.raw).toHaveBeenCalledWith([
      'filter-branch',
      '--force',
      '--msg-filter',
      expect.stringContaining('abc1234'),
      '--',
      'HEAD',
    ]);
  });
});

describe('squashCommits', () => {
  it('squashes the last N commits', async () => {
    const git = makeGit();
    vi.mocked(getGit).mockReturnValue(git as never);
    const result = await squashCommits('/repo', { count: 3, message: 'squashed' });
    expect(git.raw).toHaveBeenCalledWith(['reset', '--soft', 'HEAD~3']);
    expect(git.raw).toHaveBeenCalledWith(['commit', '-m', 'squashed']);
    expect(result).toContain('3');
  });

  it('rejects count < 2', async () => {
    const git = makeGit();
    vi.mocked(getGit).mockReturnValue(git as never);
    await expect(squashCommits('/repo', { count: 1, message: 'x' })).rejects.toThrow('at least 2');
  });
});

describe('rewriteMessages', () => {
  it('builds a msg-filter with mapped commits and passes through others', async () => {
    const git = makeGit();
    vi.mocked(getGit).mockReturnValue(git as never);
    await rewriteMessages('/repo', { range: 'HEAD~5..HEAD', messages: { abc1234: 'new msg' } });
    const args = git.raw.mock.calls[0][0] as string[];
    expect(args[0]).toBe('filter-branch');
    expect(args).toContain('HEAD~5..HEAD');
    expect(args.join(' ')).toContain('abc1234');
    expect(args.join(' ')).toContain('else cat; fi');
  });

  it('rejects empty messages mapping', async () => {
    const git = makeGit();
    vi.mocked(getGit).mockReturnValue(git as never);
    await expect(rewriteMessages('/repo', { range: 'HEAD~2..HEAD', messages: {} })).rejects.toThrow(
      'must not be empty',
    );
  });
});

describe('createBackup / restoreBackup', () => {
  it('creates a backup branch', async () => {
    const git = makeGit();
    vi.mocked(getGit).mockReturnValue(git as never);
    const result = await createBackup('/repo', { name: 'pre-rewrite' });
    expect(git.raw).toHaveBeenCalledWith(['branch', 'rewrite-backup/pre-rewrite']);
    expect(result).toContain('rewrite-backup/pre-rewrite');
  });

  it('restores from a backup branch', async () => {
    const git = makeGit();
    vi.mocked(getGit).mockReturnValue(git as never);
    const result = await restoreBackup('/repo', { name: 'pre-rewrite' });
    expect(git.raw).toHaveBeenCalledWith(['reset', '--hard', 'rewrite-backup/pre-rewrite']);
    expect(result).toContain('rewrite-backup/pre-rewrite');
  });
});

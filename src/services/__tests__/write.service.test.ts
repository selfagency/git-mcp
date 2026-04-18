import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../git/client.js', () => ({
  getGit: vi.fn(),
  validateRepoPath: vi.fn((p: string) => p),
  validatePathArguments: vi.fn((_: string, paths: string[]) => paths),
  toGitError: vi.fn((e: unknown) => ({ kind: 'unknown', message: String(e) })),
}));

import { getGit, validatePathArguments } from '../../git/client.js';
import { addFiles, commitChanges, resetChanges, restoreFiles, revertCommit } from '../write.service.js';

function makeGit(overrides: Record<string, unknown> = {}) {
  return {
    add: vi.fn().mockResolvedValue(''),
    raw: vi.fn().mockResolvedValue(''),
    commit: vi.fn().mockResolvedValue({ commit: 'abc1234' }),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// addFiles
// ---------------------------------------------------------------------------
describe('addFiles', () => {
  it('stages all with all=true', async () => {
    const git = makeGit({ add: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await addFiles('/repo', { all: true });
    expect(git.add).toHaveBeenCalledWith('.');
    expect(result).toBe('Staged all changes.');
  });

  it('stages specific paths', async () => {
    const git = makeGit({ add: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await addFiles('/repo', { paths: ['src/a.ts', 'src/b.ts'] });
    expect(git.add).toHaveBeenCalledWith(['src/a.ts', 'src/b.ts']);
    expect(result).toBe('Staged 2 path(s).');
  });

  it('throws when no paths and all=false', async () => {
    const git = makeGit();
    vi.mocked(getGit).mockReturnValue(git as any);
    await expect(addFiles('/repo', {})).rejects.toThrow('Provide paths or set all=true');
  });

  it('propagates path traversal validation errors', async () => {
    const git = makeGit();
    vi.mocked(getGit).mockReturnValue(git as any);
    vi.mocked(validatePathArguments).mockImplementationOnce(() => {
      throw new Error('Path argument escapes repository root');
    });

    await expect(addFiles('/repo', { paths: ['../secret'] })).rejects.toThrow('escapes repository root');
  });
});

// ---------------------------------------------------------------------------
// restoreFiles
// ---------------------------------------------------------------------------
describe('restoreFiles', () => {
  it('throws when neither staged nor worktree', async () => {
    const git = makeGit();
    vi.mocked(getGit).mockReturnValue(git as any);
    await expect(restoreFiles('/repo', { paths: ['a.ts'], staged: false, worktree: false })).rejects.toThrow(
      'At least one of staged/worktree must be true',
    );
  });

  it('restores staged files', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await restoreFiles('/repo', { paths: ['a.ts'], staged: true, worktree: false });
    expect(git.raw).toHaveBeenCalledWith(['restore', '--staged', '--', 'a.ts']);
    expect(result).toBe('Restored 1 path(s).');
  });

  it('restores worktree files', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    await restoreFiles('/repo', { paths: ['b.ts'], staged: false, worktree: true });
    expect(git.raw).toHaveBeenCalledWith(['restore', '--worktree', '--', 'b.ts']);
  });

  it('restores from source', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    await restoreFiles('/repo', { paths: ['c.ts'], staged: true, worktree: false, source: 'HEAD~1' });
    expect(git.raw).toHaveBeenCalledWith(['restore', '--staged', '--source', 'HEAD~1', '--', 'c.ts']);
  });
});

// ---------------------------------------------------------------------------
// commitChanges
// ---------------------------------------------------------------------------
describe('commitChanges', () => {
  it('commits with message', async () => {
    const git = makeGit({ commit: vi.fn().mockResolvedValue({ commit: 'abc1234' }) });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await commitChanges('/repo', {
      message: 'feat: add thing',
      all: false,
      amend: false,
      noEdit: false,
    });
    expect(git.commit).toHaveBeenCalledWith('feat: add thing', []);
    expect(result).toBe('Committed abc1234.');
  });

  it('commits with -a flag', async () => {
    const git = makeGit({ commit: vi.fn().mockResolvedValue({ commit: 'abc1234' }) });
    vi.mocked(getGit).mockReturnValue(git as any);
    await commitChanges('/repo', { message: 'fix: typo', all: true, amend: false, noEdit: false });
    expect(git.commit).toHaveBeenCalledWith('fix: typo', ['-a']);
  });

  it('amends commit with no-edit', async () => {
    const git = makeGit({ commit: vi.fn().mockResolvedValue({ commit: 'abc1234' }) });
    vi.mocked(getGit).mockReturnValue(git as any);
    await commitChanges('/repo', { message: '', all: false, amend: true, noEdit: true });
    expect(git.commit).toHaveBeenCalledWith('', ['--amend', '--no-edit']);
  });
});

// ---------------------------------------------------------------------------
// resetChanges
// ---------------------------------------------------------------------------
describe('resetChanges', () => {
  it('resets to HEAD soft mode', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await resetChanges('/repo', { mode: 'soft' });
    expect(git.raw).toHaveBeenCalledWith(['reset', '--soft']);
    expect(result).toBe('Reset completed with mode=soft.');
  });

  it('hard resets to specific target', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    await resetChanges('/repo', { mode: 'hard', target: 'HEAD~2' });
    expect(git.raw).toHaveBeenCalledWith(['reset', '--hard', 'HEAD~2']);
  });

  it('unstages specific paths', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await resetChanges('/repo', { mode: 'mixed', paths: ['a.ts', 'b.ts'] });
    expect(git.raw).toHaveBeenCalledWith(['reset', '--', 'a.ts', 'b.ts']);
    expect(result).toBe('Unstaged 2 path(s).');
  });

  it('unstages paths with target ref', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    await resetChanges('/repo', { mode: 'mixed', target: 'HEAD', paths: ['a.ts'] });
    expect(git.raw).toHaveBeenCalledWith(['reset', 'HEAD', '--', 'a.ts']);
  });
});

// ---------------------------------------------------------------------------
// revertCommit
// ---------------------------------------------------------------------------
describe('revertCommit', () => {
  it('reverts a commit', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await revertCommit('/repo', { ref: 'abc123', noCommit: false });
    expect(git.raw).toHaveBeenCalledWith(['revert', 'abc123']);
    expect(result).toBe('Reverted abc123.');
  });

  it('reverts with --no-commit', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    await revertCommit('/repo', { ref: 'abc123', noCommit: true });
    expect(git.raw).toHaveBeenCalledWith(['revert', '--no-commit', 'abc123']);
  });

  it('reverts with mainline', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    await revertCommit('/repo', { ref: 'abc123', noCommit: false, mainline: 1 });
    expect(git.raw).toHaveBeenCalledWith(['revert', '-m', '1', 'abc123']);
  });
});

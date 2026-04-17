import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../git/client.js', () => ({
  getGit: vi.fn(),
  validateRepoPath: vi.fn((p: string) => p),
  toGitError: vi.fn((e: unknown) => ({ kind: 'unknown', message: String(e) })),
}));

import { getGit } from '../../git/client.js';
import { runLfsAction } from '../lfs.service.js';

function makeGit(overrides: Record<string, unknown> = {}) {
  return {
    raw: vi.fn().mockResolvedValue(''),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runLfsAction', () => {
  it('runs lfs install', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('Git LFS initialized.') });
    vi.mocked(getGit).mockReturnValue(git as never);
    const result = await runLfsAction('/repo', { action: 'install' });
    expect(git.raw).toHaveBeenCalledWith(['lfs', 'install']);
    expect(result).toContain('Git LFS initialized.');
  });

  it('requires patterns for track', async () => {
    const git = makeGit();
    vi.mocked(getGit).mockReturnValue(git as never);
    await expect(runLfsAction('/repo', { action: 'track' })).rejects.toThrow('patterns is required');
  });

  it('tracks patterns', async () => {
    const git = makeGit();
    vi.mocked(getGit).mockReturnValue(git as never);
    await runLfsAction('/repo', { action: 'track', patterns: ['*.psd'] });
    expect(git.raw).toHaveBeenCalledWith(['lfs', 'track', '*.psd']);
  });

  it('requires remote for push', async () => {
    const git = makeGit();
    vi.mocked(getGit).mockReturnValue(git as never);
    await expect(runLfsAction('/repo', { action: 'push' })).rejects.toThrow('remote is required');
  });

  it('runs migrate import with include/exclude/everything', async () => {
    const git = makeGit();
    vi.mocked(getGit).mockReturnValue(git as never);
    await runLfsAction('/repo', {
      action: 'migrate-import',
      include: '*.zip',
      exclude: '*.png',
      everything: true,
    });

    expect(git.raw).toHaveBeenCalledWith([
      'lfs',
      'migrate',
      'import',
      '--everything',
      '--include',
      '*.zip',
      '--exclude',
      '*.png',
    ]);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../git/client.js', () => ({
  getGit: vi.fn(),
  validateRepoPath: vi.fn((p: string) => p),
  toGitError: vi.fn((e: unknown) => ({ kind: 'unknown', message: String(e) })),
}));

import { getGit } from '../../git/client.js';
import { fetchRemote, listRemotes, manageRemote, pullRemote, pushRemote } from '../remote.service.js';

function makeGit(overrides: Record<string, unknown> = {}) {
  return {
    getRemotes: vi.fn().mockResolvedValue([]),
    addRemote: vi.fn().mockResolvedValue(''),
    removeRemote: vi.fn().mockResolvedValue(''),
    remote: vi.fn().mockResolvedValue(''),
    fetch: vi.fn().mockResolvedValue(''),
    pull: vi.fn().mockResolvedValue(''),
    push: vi.fn().mockResolvedValue(''),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// listRemotes
// ---------------------------------------------------------------------------
describe('listRemotes', () => {
  it('maps getRemotes to RemoteInfo[]', async () => {
    const git = makeGit({
      getRemotes: vi
        .fn()
        .mockResolvedValue([
          { name: 'origin', refs: { fetch: 'https://github.com/a/b.git', push: 'https://github.com/a/b.git' } },
        ]),
    });
    vi.mocked(getGit).mockReturnValue(git as any);
    const remotes = await listRemotes('/repo');
    expect(remotes).toEqual([
      { name: 'origin', fetchUrl: 'https://github.com/a/b.git', pushUrl: 'https://github.com/a/b.git' },
    ]);
  });

  it('returns empty array when no remotes', async () => {
    const git = makeGit({ getRemotes: vi.fn().mockResolvedValue([]) });
    vi.mocked(getGit).mockReturnValue(git as any);
    const remotes = await listRemotes('/repo');
    expect(remotes).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// manageRemote
// ---------------------------------------------------------------------------
describe('manageRemote', () => {
  it('adds a remote', async () => {
    const git = makeGit({ addRemote: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await manageRemote('/repo', { action: 'add', name: 'origin', url: 'https://example.com' });
    expect(git.addRemote).toHaveBeenCalledWith('origin', 'https://example.com');
    expect(result).toBe('Added remote origin.');
  });

  it('throws when add has no url', async () => {
    const git = makeGit();
    vi.mocked(getGit).mockReturnValue(git as any);
    await expect(manageRemote('/repo', { action: 'add', name: 'origin' })).rejects.toThrow(
      "url is required for action='add'",
    );
  });

  it('removes a remote', async () => {
    const git = makeGit({ removeRemote: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await manageRemote('/repo', { action: 'remove', name: 'origin' });
    expect(git.removeRemote).toHaveBeenCalledWith('origin');
    expect(result).toBe('Removed remote origin.');
  });

  it('sets a remote url', async () => {
    const git = makeGit({ remote: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await manageRemote('/repo', { action: 'set-url', name: 'origin', url: 'https://new.com' });
    expect(git.remote).toHaveBeenCalledWith(['set-url', 'origin', 'https://new.com']);
    expect(result).toBe('Updated remote origin URL.');
  });

  it('throws when set-url has no url', async () => {
    const git = makeGit();
    vi.mocked(getGit).mockReturnValue(git as any);
    await expect(manageRemote('/repo', { action: 'set-url', name: 'origin' })).rejects.toThrow(
      "url is required for action='set-url'",
    );
  });
});

// ---------------------------------------------------------------------------
// fetchRemote
// ---------------------------------------------------------------------------
describe('fetchRemote', () => {
  it('fetches all (no remote)', async () => {
    const git = makeGit({ fetch: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await fetchRemote('/repo', { prune: false });
    expect(git.fetch).toHaveBeenCalledWith([]);
    expect(result).toBe('Fetched default remote.');
  });

  it('fetches specific remote', async () => {
    const git = makeGit({ fetch: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await fetchRemote('/repo', { remote: 'origin', prune: false });
    expect(git.fetch).toHaveBeenCalledWith('origin', []);
    expect(result).toBe('Fetched origin.');
  });

  it('fetches remote and branch', async () => {
    const git = makeGit({ fetch: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await fetchRemote('/repo', { remote: 'origin', branch: 'main', prune: false });
    expect(git.fetch).toHaveBeenCalledWith('origin', 'main', []);
    expect(result).toBe('Fetched origin/main.');
  });

  it('passes --prune flag when prune=true', async () => {
    const git = makeGit({ fetch: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    await fetchRemote('/repo', { prune: true });
    expect(git.fetch).toHaveBeenCalledWith(['--prune']);
  });
});

// ---------------------------------------------------------------------------
// pullRemote
// ---------------------------------------------------------------------------
describe('pullRemote', () => {
  it('pulls from default remote', async () => {
    const git = makeGit({ pull: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await pullRemote('/repo', { rebase: false });
    expect(git.pull).toHaveBeenCalledWith(undefined, undefined, []);
    expect(result).toContain('Pulled tracking remote');
  });

  it('pulls with rebase flag', async () => {
    const git = makeGit({ pull: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await pullRemote('/repo', { remote: 'origin', branch: 'main', rebase: true });
    expect(git.pull).toHaveBeenCalledWith('origin', 'main', ['--rebase']);
    expect(result).toContain('with rebase');
  });
});

// ---------------------------------------------------------------------------
// pushRemote
// ---------------------------------------------------------------------------
describe('pushRemote', () => {
  it('pushes with default options', async () => {
    const git = makeGit({ push: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await pushRemote('/repo', { setUpstream: false, forceWithLease: false, tags: false });
    expect(git.push).toHaveBeenCalledWith(undefined, undefined, []);
    expect(result).toContain('Pushed tracking remote');
  });

  it('pushes with setUpstream and forceWithLease', async () => {
    const git = makeGit({ push: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    await pushRemote('/repo', {
      remote: 'origin',
      branch: 'feat',
      setUpstream: true,
      forceWithLease: true,
      tags: false,
    });
    expect(git.push).toHaveBeenCalledWith('origin', 'feat', ['--set-upstream', '--force-with-lease']);
  });

  it('pushes tags', async () => {
    const git = makeGit({ push: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    await pushRemote('/repo', { setUpstream: false, forceWithLease: false, tags: true });
    expect(git.push).toHaveBeenCalledWith(undefined, undefined, ['--tags']);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../git/client.js', () => ({
  getGit: vi.fn(),
  validateRepoPath: vi.fn((p: string) => p),
  toGitError: vi.fn((e: unknown) => ({ kind: 'unknown', message: String(e) })),
}));

// Mock inspect.service to isolate context.service
vi.mock('../inspect.service.js', () => ({
  getStatus: vi.fn().mockResolvedValue({
    branch: 'main',
    current: 'main',
    tracking: 'origin/main',
    ahead: 1,
    behind: 0,
    files: [{ path: 'a.ts', index: 'M', workingTree: ' ' }],
    isClean: false,
  }),
  getLog: vi.fn().mockResolvedValue([
    {
      hash: 'abc1234',
      subject: 'feat: init',
      dateIso: '2024-01-01T00:00:00Z',
      authorName: 'A',
      authorEmail: 'a@a.com',
    },
  ]),
}));

import { getGit } from '../../git/client.js';
import { getConfig, getContextSummary, searchHistory, setConfig } from '../context.service.js';

function makeGit(overrides: Record<string, unknown> = {}) {
  return {
    getRemotes: vi.fn().mockResolvedValue([{ name: 'origin' }]),
    raw: vi.fn().mockResolvedValue(''),
    ...overrides,
  };
}

beforeEach(async () => {
  vi.clearAllMocks();
  // reset inspect.service mocks between tests
  const inspect = vi.mocked(await import('../inspect.service.js'));
  inspect.getStatus.mockResolvedValue({
    branch: 'main',
    current: 'main',
    tracking: 'origin/main',
    ahead: 1,
    behind: 0,
    files: [{ path: 'a.ts', index: 'M', workingTree: ' ' }],
    isClean: false,
  } as any);
  inspect.getLog.mockResolvedValue([
    {
      hash: 'abc1234',
      subject: 'feat: init',
      dateIso: '2024-01-01T00:00:00Z',
      authorName: 'A',
      authorEmail: 'a@a.com',
    },
  ]);
});

// ---------------------------------------------------------------------------
// getContextSummary
// ---------------------------------------------------------------------------
describe('getContextSummary', () => {
  it('returns a summary with branch, commits, and remotes', async () => {
    const git = makeGit();
    vi.mocked(getGit).mockReturnValue(git as any);
    const summary = await getContextSummary('/repo');
    expect(summary.branch).toBe('main');
    expect(summary.ahead).toBe(1);
    expect(summary.changedFiles).toBe(1);
    expect(summary.remotes).toContain('origin');
    expect(summary.recentCommits).toHaveLength(1);
    expect(summary.recentCommits[0].hash).toBe('abc1234');
  });

  it('returns inProgress as object', async () => {
    const git = makeGit();
    vi.mocked(getGit).mockReturnValue(git as any);
    const summary = await getContextSummary('/repo');
    expect(summary.inProgress).toMatchObject({
      rebasing: expect.any(Boolean),
      merging: expect.any(Boolean),
      cherryPicking: expect.any(Boolean),
      bisecting: expect.any(Boolean),
    });
  });
});

// ---------------------------------------------------------------------------
// searchHistory
// ---------------------------------------------------------------------------
describe('searchHistory', () => {
  it('returns pickaxe and grep sections', async () => {
    const git = makeGit({
      raw: vi
        .fn()
        .mockResolvedValueOnce('abc1234 feat: add query')
        .mockResolvedValueOnce('src/a.ts:10:const query = x'),
    });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await searchHistory('/repo', 'query', 10);
    expect(result).toContain('## Pickaxe (-S)');
    expect(result).toContain('abc1234 feat: add query');
    expect(result).toContain('## grep');
    expect(result).toContain('src/a.ts');
  });

  it('returns "No history matches." when pickaxe is empty', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await searchHistory('/repo', 'nothing', 10);
    expect(result).toContain('No history matches.');
  });
});

// ---------------------------------------------------------------------------
// getConfig
// ---------------------------------------------------------------------------
describe('getConfig', () => {
  it('gets a specific config key', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('John Doe\n') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await getConfig('/repo', 'user.name');
    expect(git.raw).toHaveBeenCalledWith(['config', '--get', 'user.name']);
    expect(result).toBe('John Doe');
  });

  it('gets the full config list', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('user.name=John\nuser.email=john@example.com\n') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await getConfig('/repo');
    expect(git.raw).toHaveBeenCalledWith(['config', '--list']);
    expect(result).toContain('user.name=John');
  });

  it('blocks restricted config keys', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    await expect(getConfig('/repo', 'credential.helper')).rejects.toThrow('not permitted');
  });

  it('redacts sensitive token-like values', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('ghp_0123456789abcdef0123456789abcdef01234567\n') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await getConfig('/repo', 'user.name');
    expect(result).toBe('***');
  });
});

// ---------------------------------------------------------------------------
// setConfig
// ---------------------------------------------------------------------------
describe('setConfig', () => {
  it('sets a config value', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await setConfig('/repo', 'user.name', 'Alice');
    expect(git.raw).toHaveBeenCalledWith(['config', '--local', 'user.name', 'Alice']);
    expect(result).toBe('Set user.name.');
  });

  it('blocks restricted config keys for writes', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    await expect(setConfig('/repo', 'credential.helper', 'store')).rejects.toThrow('not permitted');
  });
});

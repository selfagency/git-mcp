import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../git/client.js', () => ({
  getGit: vi.fn(),
  validateRepoPath: vi.fn((p: string) => p),
  validatePathArgument: vi.fn((_: string, filePath: string) => filePath),
  toGitError: vi.fn((e: unknown) => ({ kind: 'unknown', message: String(e) })),
}));

import { getGit } from '../../git/client.js';
import { validatePathArgument } from '../../git/client.js';
import { blameFile, getDiff, getDiffSummary, getLog, getStatus, showRef } from '../inspect.service.js';

function makeGit(overrides: Record<string, unknown> = {}) {
  return {
    status: vi.fn().mockResolvedValue({
      current: 'main',
      tracking: 'origin/main',
      ahead: 0,
      behind: 0,
      files: [],
      isClean: () => true,
    }),
    raw: vi.fn().mockResolvedValue(''),
    diffSummary: vi.fn().mockResolvedValue({ files: [], insertions: 0, deletions: 0 }),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getStatus
// ---------------------------------------------------------------------------
describe('getStatus', () => {
  it('returns mapped status', async () => {
    const git = makeGit({
      status: vi.fn().mockResolvedValue({
        current: 'feat',
        tracking: 'origin/feat',
        ahead: 2,
        behind: 1,
        files: [{ path: 'a.ts', index: 'M', working_dir: ' ' }],
        isClean: () => false,
      }),
    });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await getStatus('/repo');
    expect(result.branch).toBe('feat');
    expect(result.ahead).toBe(2);
    expect(result.behind).toBe(1);
    expect(result.isClean).toBe(false);
    expect(result.files).toEqual([{ path: 'a.ts', index: 'M', workingTree: ' ' }]);
  });

  it('reports clean repo', async () => {
    const git = makeGit();
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await getStatus('/repo');
    expect(result.isClean).toBe(true);
    expect(result.files).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getLog
// ---------------------------------------------------------------------------
describe('getLog', () => {
  it('parses commit log output', async () => {
    const logLine = 'abc1234\tJohn Doe\tjohn@example.com\t2024-01-01T00:00:00Z\tfeat: add thing';
    const git = makeGit({ raw: vi.fn().mockResolvedValue(logLine) });
    vi.mocked(getGit).mockReturnValue(git as any);
    const commits = await getLog('/repo', { limit: 10, offset: 0 });
    expect(commits).toHaveLength(1);
    expect(commits[0]).toMatchObject({
      hash: 'abc1234',
      authorName: 'John Doe',
      authorEmail: 'john@example.com',
      subject: 'feat: add thing',
    });
  });

  it('returns empty array for empty git log', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const commits = await getLog('/repo', { limit: 10, offset: 0 });
    expect(commits).toEqual([]);
  });

  it('passes author filter', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    await getLog('/repo', { limit: 10, offset: 0, author: 'alice' });
    const call = git.raw.mock.calls[0][0] as string[];
    expect(call).toContain('--author=alice');
  });

  it('passes grep filter', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    await getLog('/repo', { limit: 5, offset: 0, grep: 'bug' });
    const call = git.raw.mock.calls[0][0] as string[];
    expect(call).toContain('--grep=bug');
  });

  it('passes filePath filter', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    await getLog('/repo', { limit: 5, offset: 0, filePath: 'src/a.ts' });
    const call = git.raw.mock.calls[0][0] as string[];
    expect(call).toContain('--');
    expect(call).toContain('src/a.ts');
  });
});

// ---------------------------------------------------------------------------
// showRef
// ---------------------------------------------------------------------------
describe('showRef', () => {
  it('calls show with stat and patch', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('commit info') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await showRef('/repo', 'HEAD');
    expect(git.raw).toHaveBeenCalledWith(['show', '--stat', '--patch', 'HEAD']);
    expect(result).toBe('commit info');
  });
});

describe('blameFile', () => {
  it('throws when path validation rejects traversal', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as any);
    vi.mocked(validatePathArgument).mockImplementationOnce(() => {
      throw new Error('Path argument escapes repository root');
    });

    await expect(blameFile('/repo', '../etc/passwd')).rejects.toThrow('escapes repository root');
  });
});

// ---------------------------------------------------------------------------
// getDiffSummary
// ---------------------------------------------------------------------------
describe('getDiffSummary', () => {
  it('returns diff summary for unstaged mode', async () => {
    const git = makeGit({
      diffSummary: vi.fn().mockResolvedValue({ files: [{}, {}], insertions: 10, deletions: 3 }),
    });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await getDiffSummary('/repo', { mode: 'unstaged', filtered: false });
    expect(result).toEqual({ filesChanged: 2, insertions: 10, deletions: 3 });
  });

  it('returns diff summary for staged mode', async () => {
    const git = makeGit({
      diffSummary: vi.fn().mockResolvedValue({ files: [{}], insertions: 5, deletions: 1 }),
    });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await getDiffSummary('/repo', { mode: 'staged', filtered: false });
    expect(git.diffSummary).toHaveBeenCalledWith(['--staged']);
    expect(result.filesChanged).toBe(1);
  });

  it('throws when refs mode has no fromRef/toRef', async () => {
    const git = makeGit();
    vi.mocked(getGit).mockReturnValue(git as any);
    await expect(getDiffSummary('/repo', { mode: 'refs', filtered: false })).rejects.toThrow(
      'from_ref and to_ref are required',
    );
  });
});

// ---------------------------------------------------------------------------
// getDiff
// ---------------------------------------------------------------------------
describe('getDiff', () => {
  it('returns unfiltered diff', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('diff output') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await getDiff('/repo', { mode: 'unstaged', filtered: false });
    expect(result).toBe('diff output');
  });

  it('returns "No changed files after filtering." when files are all excluded', async () => {
    // Use a file whose extension is in EXCLUDED_DIFF_EXTENSIONS (e.g. .png)
    const git = makeGit({
      raw: vi.fn().mockResolvedValueOnce('banner.png\n').mockResolvedValue(''),
    });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await getDiff('/repo', { mode: 'unstaged', filtered: true });
    expect(result).toBe('No changed files after filtering.');
  });
});

// ---------------------------------------------------------------------------
// blameFile
// ---------------------------------------------------------------------------
describe('blameFile', () => {
  it('blames a file', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('abc1234 (Author 2024-01-01 1) line content') });
    vi.mocked(getGit).mockReturnValue(git as any);
    const result = await blameFile('/repo', 'src/a.ts');
    expect(git.raw).toHaveBeenCalledWith(['blame', '--', 'src/a.ts']);
    expect(result).toContain('line content');
  });

  it('blames a file at a given ref', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('output') });
    vi.mocked(getGit).mockReturnValue(git as any);
    await blameFile('/repo', 'src/a.ts', 'HEAD~1');
    expect(git.raw).toHaveBeenCalledWith(['blame', 'HEAD~1', '--', 'src/a.ts']);
  });
});

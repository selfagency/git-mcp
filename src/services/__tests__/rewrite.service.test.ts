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
    status: vi.fn().mockResolvedValue({ isClean: () => true }),
    revparse: vi.fn().mockResolvedValue('/repo/.git'),
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
  it('builds a msg-filter that reads messages from a temp file', async () => {
    const git = makeGit();
    vi.mocked(getGit).mockReturnValue(git as never);
    await rewriteMessages('/repo', { range: 'HEAD~5..HEAD', messages: { abc1234: 'new msg' } });
    const filterCall = git.raw.mock.calls.find((c: string[][]) => c[0][0] === 'filter-branch')!;
    expect(filterCall).toBeDefined();
    const args = filterCall[0] as string[];
    expect(args).toContain('HEAD~5..HEAD');
    // The filter must NOT embed the message content in the shell string.
    expect(args.join(' ')).not.toContain('new msg');
    // It must reference a temp file instead.
    expect(args.join(' ')).toContain('messages.txt');
  });

  it('rejects empty messages mapping', async () => {
    const git = makeGit();
    vi.mocked(getGit).mockReturnValue(git as never);
    await expect(rewriteMessages('/repo', { range: 'HEAD~2..HEAD', messages: {} })).rejects.toThrow(
      'must not be empty',
    );
  });
});

describe('rewrite shell-injection regression', () => {
  const EXPLOITS = ['$(id)', '`touch /tmp/pwned`', '!', '$IFS', 'a\nb', "'single'", '"double"'];

  it('never embeds message content in the filter-branch shell string', async () => {
    for (const exploit of EXPLOITS) {
      const git = makeGit();
      vi.mocked(getGit).mockReturnValue(git as never);
      await rewordCommit('/repo', { ref: 'abc1234', message: exploit });
      const filterCall = git.raw.mock.calls.find((c: string[][]) => c[0][0] === 'filter-branch')!;
      expect(filterCall).toBeDefined();
      const filter = filterCall[0][3] as string;
      // The message must never appear in the shell command string.
      expect(filter).not.toContain(exploit);
      // The message must be read from a temp file instead.
      expect(filter).toContain('cat');
    }
  });

  it('never embeds mapped message content in the rewrite-messages shell string', async () => {
    for (const exploit of EXPLOITS) {
      const git = makeGit();
      vi.mocked(getGit).mockReturnValue(git as never);
      await rewriteMessages('/repo', { range: 'HEAD~5..HEAD', messages: { abc1234: exploit } });
      const filterCall = git.raw.mock.calls.find((c: string[][]) => c[0][0] === 'filter-branch')!;
      expect(filterCall).toBeDefined();
      const filter = (filterCall[0] as string[])[3] as string;
      expect(filter).not.toContain(exploit);
      expect(filter).toContain('messages.txt');
    }
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

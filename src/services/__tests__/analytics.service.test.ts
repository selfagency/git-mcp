import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../git/client.js', () => ({
  getGit: vi.fn(),
  validateRepoPath: vi.fn((p: string) => p),
  toGitError: vi.fn((e: unknown) => ({ kind: 'unknown', message: String(e) })),
}));

import { getGit } from '../../git/client.js';
import { getContributors, getChurn, getActivity, getRepoSummary, getFileStats } from '../analytics.service.js';

function makeGit(overrides: Record<string, unknown> = {}) {
  return {
    raw: vi.fn().mockResolvedValue(''),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getContributors', () => {
  it('aggregates commits per author with line stats', async () => {
    const git = makeGit({
      raw: vi
        .fn()
        .mockResolvedValue(
          [
            'abc\tAlice\talice@x.com\t2024-01-01T00:00:00Z\t10\t2',
            'def\tBob\tbob@x.com\t2024-01-02T00:00:00Z\t5\t1',
            'ghi\tAlice\talice@x.com\t2024-01-03T00:00:00Z\t3\t0',
          ].join('\n'),
        ),
    });
    vi.mocked(getGit).mockReturnValue(git as never);
    const result = await getContributors('/repo');
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ name: 'Alice', commits: 2, additions: 13, deletions: 2 });
    expect(result[1]).toMatchObject({ name: 'Bob', commits: 1 });
  });
});

describe('getChurn', () => {
  it('aggregates file churn from numstat', async () => {
    const git = makeGit({
      raw: vi.fn().mockResolvedValue(['10\t2\tsrc/a.ts', '5\t1\tsrc/b.ts', '3\t0\tsrc/a.ts'].join('\n')),
    });
    vi.mocked(getGit).mockReturnValue(git as never);
    const result = await getChurn('/repo');
    expect(result[0]).toMatchObject({ file: 'src/a.ts', commits: 2, additions: 13, deletions: 2 });
  });
});

describe('getActivity', () => {
  it('counts commits per day', async () => {
    const git = makeGit({
      raw: vi.fn().mockResolvedValue(['2024-01-01', '2024-01-01', '2024-01-02'].join('\n')),
    });
    vi.mocked(getGit).mockReturnValue(git as never);
    const result = await getActivity('/repo');
    expect(result).toEqual([
      { period: '2024-01-01', commits: 2 },
      { period: '2024-01-02', commits: 1 },
    ]);
  });
});

describe('getRepoSummary', () => {
  it('returns repo overview metrics', async () => {
    const git = makeGit({
      raw: vi.fn().mockImplementation(async (args: string[]) => {
        if (args[0] === 'branch') return 'main\ndevelop\n';
        if (args[0] === 'tag') return 'v1.0\nv1.1\n';
        if (args[0] === 'rev-list') return '42';
        if (args[0] === 'log' && args.includes('--reverse')) return '2024-01-01T00:00:00Z';
        if (args[0] === 'log' && args[1] === '-1') return '2024-06-01T00:00:00Z';
        return '';
      }),
    });
    vi.mocked(getGit).mockReturnValue(git as never);
    const result = await getRepoSummary('/repo');
    expect(result).toMatchObject({ branchCount: 2, tagCount: 2, totalCommits: 42 });
  });
});

describe('getFileStats', () => {
  it('returns file type breakdown and largest files', async () => {
    const git = makeGit({
      raw: vi.fn().mockImplementation(async (args: string[]) => {
        if (args[0] === 'ls-tree') {
          return [
            '100644 blob abc123 100\tsrc/a.ts',
            '100644 blob def456 200\tsrc/b.ts',
            '100644 blob 789abc 50\tREADME.md',
          ].join('\n');
        }
        if (args[0] === 'log') return 'src/a.ts\nREADME.md\n';
        return '';
      }),
    });
    vi.mocked(getGit).mockReturnValue(git as never);
    const result = await getFileStats('/repo');
    expect(result.byExtension).toEqual([
      { extension: 'ts', count: 2 },
      { extension: 'md', count: 1 },
    ]);
    expect(result.largestFiles).toHaveLength(3);
    expect(result.recentlyModified).toEqual(['src/a.ts', 'README.md']);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../git/client.js', () => ({
  getGit: vi.fn(),
  validateRepoPath: vi.fn((p: string) => p),
  toGitError: vi.fn((e: unknown) => ({ kind: 'unknown', message: String(e) })),
}));

vi.mock('../../git/external.js', () => ({
  probeBinary: vi.fn(),
  hasMarkerDir: vi.fn(),
}));

vi.mock('../../config.js', () => ({
  ALLOW_TANGLED: true,
  ALLOW_ENTIRE: true,
  ENTIRE_BINARY: 'entire',
}));

import { getGit } from '../../git/client.js';
import { probeBinary, hasMarkerDir } from '../../git/external.js';
import { checkTangled } from '../tangled.service.js';
import { checkEntire } from '../entire.service.js';

function makeGit(remotes: Array<{ name: string; refs: { fetch: string } }>) {
  return {
    getRemotes: vi.fn().mockResolvedValue(remotes),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('checkTangled', () => {
  it('detects a tangled.org remote', async () => {
    const git = makeGit([{ name: 'origin', refs: { fetch: 'git@tangled.org:owner/repo.git' } }]);
    vi.mocked(getGit).mockReturnValue(git as never);
    const result = await checkTangled('/repo');
    expect(result.tangled).toBe(true);
    expect(result.guidance).toContain('Tangled');
  });

  it('reports non-tangled for a github remote', async () => {
    const git = makeGit([{ name: 'origin', refs: { fetch: 'git@github.com:owner/repo.git' } }]);
    vi.mocked(getGit).mockReturnValue(git as never);
    const result = await checkTangled('/repo');
    expect(result.tangled).toBe(false);
  });
});

describe('checkEntire', () => {
  it('reports Entire-managed repo and recommends entire CLI', async () => {
    vi.mocked(probeBinary).mockResolvedValue({ available: true, version: 'entire 1.0.0' });
    vi.mocked(hasMarkerDir).mockReturnValue(true);
    const result = await checkEntire('/repo');
    expect(result.available).toBe(true);
    expect(result.managed).toBe(true);
    expect(result.guidance).toContain('entire');
  });

  it('reports non-managed repo when no .entire marker', async () => {
    vi.mocked(probeBinary).mockResolvedValue({ available: true, version: 'entire 1.0.0' });
    vi.mocked(hasMarkerDir).mockReturnValue(false);
    const result = await checkEntire('/repo');
    expect(result.managed).toBe(false);
    expect(result.guidance).toContain('not Entire-managed');
  });

  it('reports managed repo without entire CLI installed', async () => {
    vi.mocked(probeBinary).mockResolvedValue({ available: false, error: 'ENOENT' });
    vi.mocked(hasMarkerDir).mockReturnValue(true);
    const result = await checkEntire('/repo');
    expect(result.available).toBe(false);
    expect(result.managed).toBe(true);
    expect(result.guidance).toContain('not installed');
  });
});

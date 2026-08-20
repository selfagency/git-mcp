import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../git/client.js', () => ({
  getGit: vi.fn(),
  validateRepoPath: vi.fn((p: string) => p),
  toGitError: vi.fn((e: unknown) => ({ kind: 'unknown', message: String(e) })),
}));

vi.mock('../../config.js', () => ({
  GIT_FORGE_PROVIDER: undefined,
  GITHUB_TOKEN: 'gh-token',
  GITLAB_TOKEN: 'gl-token',
  FORGEJO_TOKEN: 'fj-token',
  BITBUCKET_TOKEN: 'bb-token',
}));

import { getGit } from '../../git/client.js';
import { detectForge } from '../forge.service.js';

function makeGit(remotes: Array<{ name: string; refs: { fetch: string } }>) {
  return {
    getRemotes: vi.fn().mockResolvedValue(remotes),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('detectForge', () => {
  it.each([
    ['GitHub', 'github.com', 'owner/repo', 'github', 'owner', 'repo'],
    ['GitLab', 'gitlab.com', 'group/project', 'gitlab', 'group', 'project'],
    ['Forgejo', 'codeberg.org', 'owner/repo', 'forgejo', 'owner', 'repo'],
    ['Gitea', 'gitea.com', 'owner/repo', 'gitea', 'owner', 'repo'],
  ] as const)('detects %s from %s', async (name, host, path, provider, owner, repo) => {
    const git = makeGit([{ name: 'origin', refs: { fetch: `https://${host}/${path}.git` } }]);
    vi.mocked(getGit).mockReturnValue(git as never);
    const result = await detectForge('/repo');
    expect(result.provider).toBe(provider);
    expect(result.owner).toBe(owner);
    expect(result.repo).toBe(repo);
  });

  it('detects Bitbucket from bitbucket.org', async () => {
    const git = makeGit([{ name: 'origin', refs: { fetch: 'https://bitbucket.org/owner/repo.git' } }]);
    vi.mocked(getGit).mockReturnValue(git as never);
    const result = await detectForge('/repo');
    expect(result.provider).toBe('bitbucket');
  });

  it('returns unknown for unrecognized self-hosted host', async () => {
    const git = makeGit([{ name: 'origin', refs: { fetch: 'https://git.example.com/owner/repo.git' } }]);
    vi.mocked(getGit).mockReturnValue(git as never);
    const result = await detectForge('/repo');
    expect(result.provider).toBe('unknown');
  });

  it('handles nested GitLab groups over SSH', async () => {
    const git = makeGit([{ name: 'origin', refs: { fetch: 'git@gitlab.com:group/subgroup/repo.git' } }]);
    vi.mocked(getGit).mockReturnValue(git as never);
    const result = await detectForge('/repo');
    expect(result.provider).toBe('gitlab');
    expect(result.owner).toBe('group/subgroup');
    expect(result.repo).toBe('repo');
  });

  it('handles nested GitLab groups over HTTPS', async () => {
    const git = makeGit([{ name: 'origin', refs: { fetch: 'https://gitlab.com/group/subgroup/repo.git' } }]);
    vi.mocked(getGit).mockReturnValue(git as never);
    const result = await detectForge('/repo');
    expect(result.owner).toBe('group/subgroup');
    expect(result.repo).toBe('repo');
  });

  it('preserves custom port in baseUrl', async () => {
    const git = makeGit([{ name: 'origin', refs: { fetch: 'https://gitlab.example.com:8443/group/repo.git' } }]);
    vi.mocked(getGit).mockReturnValue(git as never);
    const result = await detectForge('/repo');
    expect(result.baseUrl).toBe('https://gitlab.example.com:8443');
  });
});

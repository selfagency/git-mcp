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
  it('detects GitHub from github.com', async () => {
    const git = makeGit([{ name: 'origin', refs: { fetch: 'git@github.com:owner/repo.git' } }]);
    vi.mocked(getGit).mockReturnValue(git as never);
    const result = await detectForge('/repo');
    expect(result.provider).toBe('github');
    expect(result.owner).toBe('owner');
    expect(result.repo).toBe('repo');
  });

  it('detects GitLab from gitlab.com', async () => {
    const git = makeGit([{ name: 'origin', refs: { fetch: 'https://gitlab.com/group/project.git' } }]);
    vi.mocked(getGit).mockReturnValue(git as never);
    const result = await detectForge('/repo');
    expect(result.provider).toBe('gitlab');
    expect(result.owner).toBe('group');
    expect(result.repo).toBe('project');
  });

  it('detects Forgejo from codeberg.org', async () => {
    const git = makeGit([{ name: 'origin', refs: { fetch: 'https://codeberg.org/owner/repo.git' } }]);
    vi.mocked(getGit).mockReturnValue(git as never);
    const result = await detectForge('/repo');
    expect(result.provider).toBe('forgejo');
  });

  it('detects Gitea from gitea.com', async () => {
    const git = makeGit([{ name: 'origin', refs: { fetch: 'https://gitea.com/owner/repo.git' } }]);
    vi.mocked(getGit).mockReturnValue(git as never);
    const result = await detectForge('/repo');
    expect(result.provider).toBe('gitea');
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

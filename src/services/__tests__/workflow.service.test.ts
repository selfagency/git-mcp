import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../git/client.js', () => ({
  getGit: vi.fn(),
  validateRepoPath: vi.fn((p: string) => p),
  toGitError: vi.fn((e: unknown) => ({ kind: 'unknown', message: String(e) })),
}));

import { getGit } from '../../git/client.js';
import { runWorkflowAction } from '../workflow.service.js';

interface ConfigAwareGit {
  raw: ReturnType<typeof vi.fn>;
}

function makeConfigAwareGit(
  overrides: {
    onRaw?: (args: string[]) => Promise<string>;
  } = {},
): ConfigAwareGit {
  const config = new Map<string, string>();

  const raw = vi.fn(async (args: string[]) => {
    if (args[0] === 'config' && args[1] === '--local' && args[2] === '--get') {
      const key = args[3] ?? '';
      if (!config.has(key)) {
        throw new Error('not found');
      }
      return config.get(key) ?? '';
    }

    if (args[0] === 'config' && args[1] === '--local' && args[2] === '--unset-all') {
      const key = args[3] ?? '';
      config.delete(key);
      return '';
    }

    if (args[0] === 'config' && args[1] === '--local' && args.length >= 4) {
      const key = args[2] ?? '';
      const value = args[3] ?? '';
      config.set(key, value);
      return '';
    }

    if (overrides.onRaw) {
      return overrides.onRaw(args);
    }

    return '';
  });

  return { raw };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runWorkflowAction', () => {
  it('lists supported workflows', async () => {
    const git = makeConfigAwareGit();
    vi.mocked(getGit).mockReturnValue(git as never);

    const result = await runWorkflowAction('/repo', { action: 'list' });

    expect(result.markdown).toContain('snapshot');
    expect(result.markdown).toContain('replay');
  });

  it('runs snapshot workflow to completion', async () => {
    const git = makeConfigAwareGit({
      onRaw: async args => {
        if (args[0] === 'remote') return 'origin\thttps://example.com/repo.git (fetch)';
        if (args[0] === 'branch') return '* main 1234567 [origin/main]';
        if (args[0] === 'merge-base') return '1234567';
        if (args[0] === 'log') return '* 1234567 init';
        if (args[0] === 'status') return ' M src/index.ts';
        return '';
      },
    });
    vi.mocked(getGit).mockReturnValue(git as never);

    const result = await runWorkflowAction('/repo', {
      action: 'start',
      workflow: 'snapshot',
      baseBranch: 'origin/main',
      logCount: 5,
    });

    expect(result.markdown).toContain('Status: completed');

    const status = await runWorkflowAction('/repo', { action: 'status' });
    expect(status.markdown).toContain('No active workflow state.');
  });

  it('pauses replay workflow on conflict then continues', async () => {
    let cherryPickFailed = false;
    const git = makeConfigAwareGit({
      onRaw: async args => {
        if (args[0] === 'checkout') return '';

        if (args[0] === 'cherry-pick' && args[1] === 'abc123' && !cherryPickFailed) {
          cherryPickFailed = true;
          throw new Error('CONFLICT (content): merge conflict');
        }

        if (args[0] === 'cherry-pick' && args[1] === '--continue') {
          return 'continued';
        }

        return '';
      },
    });
    vi.mocked(getGit).mockReturnValue(git as never);

    const started = await runWorkflowAction('/repo', {
      action: 'start',
      workflow: 'replay',
      mode: 'cherry-pick',
      targetBranch: 'feature/test',
      sourceCommits: ['abc123'],
    });

    expect(started.markdown).toContain('Status: paused');

    const resumed = await runWorkflowAction('/repo', { action: 'continue' });
    expect(resumed.markdown).toContain('Status: completed');
  });

  it('aborts an active paused workflow', async () => {
    let cherryPickFailed = false;
    const git = makeConfigAwareGit({
      onRaw: async args => {
        if (args[0] === 'checkout') return '';

        if (args[0] === 'cherry-pick' && args[1] === 'abc123' && !cherryPickFailed) {
          cherryPickFailed = true;
          throw new Error('CONFLICT (content): merge conflict');
        }

        if (args[0] === 'cherry-pick' && args[1] === '--abort') {
          return 'aborted';
        }

        return '';
      },
    });
    vi.mocked(getGit).mockReturnValue(git as never);

    await runWorkflowAction('/repo', {
      action: 'start',
      workflow: 'replay',
      mode: 'cherry-pick',
      targetBranch: 'feature/test',
      sourceCommits: ['abc123'],
    });

    const aborted = await runWorkflowAction('/repo', { action: 'abort' });
    expect(aborted.markdown).toContain('Aborted workflow replay');

    const status = await runWorkflowAction('/repo', { action: 'status' });
    expect(status.markdown).toContain('No active workflow state.');
  });

  it('returns no-op message for abort when no active workflow exists', async () => {
    const git = makeConfigAwareGit();
    vi.mocked(getGit).mockReturnValue(git as never);

    const result = await runWorkflowAction('/repo', { action: 'abort' });
    expect(result.markdown).toContain('No active workflow to abort.');
  });

  it('throws for continue when no active workflow exists', async () => {
    const git = makeConfigAwareGit();
    vi.mocked(getGit).mockReturnValue(git as never);

    await expect(runWorkflowAction('/repo', { action: 'continue' })).rejects.toThrow('No active workflow state');
  });

  it('requires workflow when start is requested', async () => {
    const git = makeConfigAwareGit();
    vi.mocked(getGit).mockReturnValue(git as never);

    await expect(runWorkflowAction('/repo', { action: 'start' })).rejects.toThrow('workflow is required');
  });

  it('rejects start when another workflow is already active', async () => {
    let cherryPickFailed = false;
    const git = makeConfigAwareGit({
      onRaw: async args => {
        if (args[0] === 'checkout') return '';

        if (args[0] === 'cherry-pick' && args[1] === 'abc123' && !cherryPickFailed) {
          cherryPickFailed = true;
          throw new Error('CONFLICT (content): merge conflict');
        }

        return '';
      },
    });
    vi.mocked(getGit).mockReturnValue(git as never);

    await runWorkflowAction('/repo', {
      action: 'start',
      workflow: 'replay',
      mode: 'cherry-pick',
      targetBranch: 'feature/test',
      sourceCommits: ['abc123'],
    });

    await expect(
      runWorkflowAction('/repo', {
        action: 'start',
        workflow: 'snapshot',
      }),
    ).rejects.toThrow('Active workflow replay');
  });
});

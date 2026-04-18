import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../git/client.js', () => ({
  getGit: vi.fn(),
  validateRepoPath: vi.fn((p: string) => p),
  toGitError: vi.fn((e: unknown) => ({ kind: 'unknown', message: String(e) })),
}));

import { getGit } from '../../git/client.js';
import { runFlowAction } from '../flow.service.js';

function joinLines(lines: string[]): string {
  return lines.join('\n');
}

function makeGit(overrides: Record<string, unknown> = {}) {
  return {
    raw: vi.fn(),
    branch: vi.fn().mockResolvedValue({ all: [], current: '', branches: {} }),
    status: vi.fn().mockResolvedValue({ current: 'main' }),
    fetch: vi.fn().mockResolvedValue(''),
    checkoutBranch: vi.fn().mockResolvedValue(''),
    checkout: vi.fn().mockResolvedValue(''),
    push: vi.fn().mockResolvedValue(''),
    pushTags: vi.fn().mockResolvedValue(''),
    commit: vi.fn().mockResolvedValue({ commit: 'abc1234' }),
    getRemotes: vi.fn().mockResolvedValue([{ name: 'origin' }, { name: 'upstream' }]),
    deleteLocalBranch: vi.fn().mockResolvedValue(''),
    addAnnotatedTag: vi.fn().mockResolvedValue(''),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runFlowAction overview/config support', () => {
  it('builds an overview from structured gitflow config', async () => {
    const git = makeGit({
      raw: vi.fn().mockImplementation(async (args: string[]) => {
        if (args[0] === 'config' && args[1] === '--get-regexp') {
          return joinLines([
            'gitflow.version 1.0',
            'gitflow.initialized true',
            'gitflow.branch.main.type base',
            'gitflow.branch.develop.type base',
            'gitflow.branch.develop.parent main',
            'gitflow.branch.develop.autoupdate true',
            'gitflow.branch.feature.type topic',
            'gitflow.branch.feature.parent develop',
            'gitflow.branch.feature.prefix feature/',
          ]);
        }

        if (args[0] === 'for-each-ref') {
          return 'feature/test\torigin/feature/test\t=';
        }

        return '';
      }),
      status: vi.fn().mockResolvedValue({ current: 'feature/test' }),
    });

    vi.mocked(getGit).mockReturnValue(git as never);

    const result = await runFlowAction('/repo', { action: 'overview' });

    expect(result.markdown).toContain('git-flow overview (structured)');
    expect(result.markdown).toContain('feature/test');
    expect(result.data).toMatchObject({
      initialized: true,
      compatibility: 'structured',
      health: { status: 'healthy' },
    });
  });

  it('translates legacy config into config-list output', async () => {
    const git = makeGit({
      raw: vi.fn().mockImplementation(async (args: string[]) => {
        if (args[0] === 'config' && args[1] === '--get-regexp') {
          return joinLines([
            'gitflow.branch.master main',
            'gitflow.branch.develop develop',
            'gitflow.prefix.feature feat/',
            'gitflow.prefix.release release/',
            'gitflow.prefix.hotfix hotfix/',
            'gitflow.prefix.support support/',
            'gitflow.prefix.versiontag v',
          ]);
        }

        return '';
      }),
    });

    vi.mocked(getGit).mockReturnValue(git as never);

    const result = await runFlowAction('/repo', { action: 'config-list' });

    expect(result.markdown).toContain('git-flow configuration (legacy)');
    expect(result.markdown).toContain('feature: prefix=feat/');
    expect(result.data).toMatchObject({ compatibility: 'legacy' });
  });

  it('supports canonical config add operations', async () => {
    const raw = vi.fn().mockResolvedValue('');
    const git = makeGit({ raw });

    vi.mocked(getGit).mockReturnValue(git as never);

    const result = await runFlowAction('/repo', {
      operation: 'config',
      configAction: 'add',
      name: 'qa',
      branchKind: 'base',
      parent: 'main',
      autoUpdate: true,
    });

    expect(raw).toHaveBeenCalledWith(['config', '--local', 'gitflow.branch.qa.type', 'base']);
    expect(result.markdown).toContain('Added flow base branch definition qa.');
  });
});

describe('runFlowAction init and dynamic topic actions', () => {
  it('initializes the github preset without creating branches when asked', async () => {
    const raw = vi
      .fn()
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce(
        joinLines([
          'gitflow.version 1.0',
          'gitflow.initialized true',
          'gitflow.branch.main.type base',
          'gitflow.branch.feature.type topic',
          'gitflow.branch.feature.parent main',
          'gitflow.branch.feature.prefix feature/',
        ]),
      );
    const git = makeGit({ raw });

    vi.mocked(getGit).mockReturnValue(git as never);

    const result = await runFlowAction('/repo', {
      action: 'init',
      preset: 'github',
      noCreateBranches: true,
      force: true,
    });

    expect(result.markdown).toContain('Initialized git-flow-next preset "github".');
    expect(result.markdown).toContain('Skipped branch creation');
    expect(raw).toHaveBeenCalledWith(['config', '--local', 'gitflow.version', '1.0']);
  });

  it('starts a dynamic topic branch using structured config', async () => {
    const git = makeGit({
      raw: vi.fn().mockImplementation(async (args: string[]) => {
        if (args[0] === 'config' && args[1] === '--get-regexp') {
          return joinLines([
            'gitflow.version 1.0',
            'gitflow.initialized true',
            'gitflow.branch.main.type base',
            'gitflow.branch.feature.type topic',
            'gitflow.branch.feature.parent main',
            'gitflow.branch.feature.prefix feat/',
          ]);
        }

        return '';
      }),
    });

    vi.mocked(getGit).mockReturnValue(git as never);

    const result = await runFlowAction('/repo', {
      action: 'topic-start',
      topic: 'feature',
      name: 'user-auth',
    });

    expect(git.checkoutBranch).toHaveBeenCalledWith('feat/user-auth', 'main');
    expect(result.markdown).toContain('feat/user-auth');
  });

  it('publishes a dynamic topic branch using structured config', async () => {
    const git = makeGit({
      raw: vi.fn().mockImplementation(async (args: string[]) => {
        if (args[0] === 'config' && args[1] === '--get-regexp') {
          return joinLines([
            'gitflow.version 1.0',
            'gitflow.initialized true',
            'gitflow.branch.main.type base',
            'gitflow.branch.feature.type topic',
            'gitflow.branch.feature.parent main',
            'gitflow.branch.feature.prefix feature/',
          ]);
        }

        return '';
      }),
    });

    vi.mocked(getGit).mockReturnValue(git as never);

    const result = await runFlowAction('/repo', {
      action: 'topic-publish',
      topic: 'feature',
      name: 'shared-work',
      remote: 'upstream',
    });

    expect(git.push).toHaveBeenCalledWith('upstream', 'feature/shared-work', ['--set-upstream']);
    expect(result.data).toMatchObject({ remote: 'upstream' });
  });

  it('uses current-branch shorthand for update when name is omitted', async () => {
    const git = makeGit({
      raw: vi.fn().mockImplementation(async (args: string[]) => {
        if (args[0] === 'config' && args[1] === '--get-regexp') {
          return joinLines([
            'gitflow.version 1.0',
            'gitflow.initialized true',
            'gitflow.branch.main.type base',
            'gitflow.branch.feature.type topic',
            'gitflow.branch.feature.parent main',
            'gitflow.branch.feature.prefix feature/',
          ]);
        }

        return '';
      }),
      status: vi.fn().mockResolvedValue({ current: 'feature/current-work' }),
    });

    vi.mocked(getGit).mockReturnValue(git as never);

    const result = await runFlowAction('/repo', {
      action: 'topic-update',
      topic: 'feature',
    });

    expect(git.checkout).toHaveBeenCalledWith('feature/current-work');
    expect(result.markdown).toContain('feature/current-work');
  });

  it('returns a recoverable paused state when finish hits a conflict', async () => {
    const raw = vi.fn().mockImplementation(async (args: string[]) => {
      if (args[0] === 'config' && args[1] === '--get-regexp') {
        if (args[2] === String.raw`^gitflow\.`) {
          return joinLines([
            'gitflow.version 1.0',
            'gitflow.initialized true',
            'gitflow.branch.main.type base',
            'gitflow.branch.develop.type base',
            'gitflow.branch.develop.parent main',
            'gitflow.branch.feature.type topic',
            'gitflow.branch.feature.parent develop',
            'gitflow.branch.feature.prefix feature/',
          ]);
        }

        return '';
      }

      if (args[0] === 'merge' && args.includes('feature/login-rework')) {
        throw new Error('CONFLICT (content): merge conflict');
      }

      return '';
    });
    const git = makeGit({
      raw,
      branch: vi.fn().mockResolvedValue({
        all: ['main', 'develop', 'feature/login-rework'],
        current: 'feature/login-rework',
        branches: {},
      }),
      status: vi.fn().mockResolvedValue({ current: 'feature/login-rework' }),
    });

    vi.mocked(getGit).mockReturnValue(git as never);

    const result = await runFlowAction('/repo', {
      action: 'topic-finish',
      topic: 'feature',
      name: 'login-rework',
    });

    expect(result.markdown).toContain('control-continue');
    expect(result.data).toMatchObject({
      completed: false,
      state: { stage: 'integrate-parent', branchName: 'feature/login-rework' },
    });
  });

  it('aborts a persisted finish state through the control action', async () => {
    const raw = vi.fn().mockImplementation(async (args: string[]) => {
      if (args[0] === 'config' && args[1] === '--get-regexp') {
        if (args[2] === String.raw`^gitflow\.`) {
          return joinLines([
            'gitflow.version 1.0',
            'gitflow.initialized true',
            'gitflow.branch.main.type base',
            'gitflow.branch.feature.type topic',
            'gitflow.branch.feature.parent main',
            'gitflow.branch.feature.prefix feature/',
          ]);
        }

        if (
          (args[2] ?? '').includes('gitflow') &&
          (args[2] ?? '').includes('state') &&
          (args[2] ?? '').includes('finish')
        ) {
          return joinLines([
            'gitflow.state.finish.topic feature',
            'gitflow.state.finish.shortName login-rework',
            'gitflow.state.finish.branchName feature/login-rework',
            'gitflow.state.finish.originalBranch feature/login-rework',
            'gitflow.state.finish.parentBranch main',
            'gitflow.state.finish.backmergeBranches []',
            'gitflow.state.finish.stage integrate-parent',
            'gitflow.state.finish.strategy merge',
            'gitflow.state.finish.deleteBranch true',
            'gitflow.state.finish.keepBranch false',
            'gitflow.state.finish.pendingBackmergeIndex 0',
            'gitflow.state.finish.publishAfterFinish false',
          ]);
        }

        return '';
      }

      return '';
    });
    const git = makeGit({ raw, status: vi.fn().mockResolvedValue({ current: 'main' }) });

    vi.mocked(getGit).mockReturnValue(git as never);

    const result = await runFlowAction('/repo', {
      operation: 'control',
      controlAction: 'abort',
    });

    expect(raw).toHaveBeenCalledWith(['merge', '--abort']);
    expect(result.markdown).toContain('Aborted finish for feature/login-rework.');
  });

  it('throws when control operation is missing controlAction', async () => {
    const git = makeGit({ raw: vi.fn().mockResolvedValue('') });
    vi.mocked(getGit).mockReturnValue(git as never);

    await expect(runFlowAction('/repo', { operation: 'control' })).rejects.toThrow('controlAction is required');
  });

  it('throws when control action is requested without persisted finish state', async () => {
    const raw = vi.fn().mockImplementation(async (args: string[]) => {
      if (args[0] === 'config' && args[1] === '--get-regexp') {
        if (args[2] === '^gitflow\\.') {
          return joinLines([
            'gitflow.version 1.0',
            'gitflow.initialized true',
            'gitflow.branch.main.type base',
            'gitflow.branch.feature.type topic',
            'gitflow.branch.feature.parent main',
            'gitflow.branch.feature.prefix feature/',
          ]);
        }

        return '';
      }

      return '';
    });

    const git = makeGit({ raw });
    vi.mocked(getGit).mockReturnValue(git as never);

    await expect(runFlowAction('/repo', { operation: 'control', controlAction: 'continue' })).rejects.toThrow(
      'No in-progress git_flow finish state found',
    );
  });
});

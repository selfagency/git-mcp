// Verifies the argv table against the real binary, when one is present.
//
// The unit tests in flow-args.test.ts pin the mapping so the suite stays green
// without git-flow installed; these tests prove the table matches an actual CLI
// rather than a stale reading of the docs. Each command is run with the built
// argv plus `--help` — git-flow prints the usage block and exits 0 without
// executing the operation, so this never mutates a repository.
//
// Any non-zero exit means git-flow rejected the flags.
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { buildFlowArgs } from '../flow-args.js';

const hasBinary = (): boolean => {
  try {
    execFileSync('git', ['flow', 'version'], { stdio: 'ignore', timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
};

const describeIfBinary = hasBinary() ? describe : describe.skip;

/** Runs `git flow <args> --help`, which validates flags without executing. */
const runAccepting = (args: string[]): void => {
  execFileSync('git', ['flow', ...args, '--help'], { stdio: 'ignore', timeout: 10_000 });
};

describeIfBinary('git-flow-next accepts every mapping we build', () => {
  it('init', () => {
    expect(() =>
      runAccepting(
        buildFlowArgs({
          operation: 'init',
          preset: 'classic',
          force: true,
          noCreateBranches: true,
          scope: 'local',
          mainBranch: 'trunk',
          developBranch: 'dev',
          tagPrefix: 'v',
        }),
      ),
    ).not.toThrow();
  });

  it('config edit with strategies', () => {
    expect(() =>
      runAccepting(
        buildFlowArgs({
          operation: 'config',
          configAction: 'update',
          branchKind: 'base',
          name: 'develop',
          autoUpdate: false,
          upstreamStrategy: 'rebase',
        }),
      ),
    ).not.toThrow();
  });

  it('topic start with a worktree path', () => {
    expect(() =>
      runAccepting(
        buildFlowArgs({
          operation: 'topic',
          topic: 'feature',
          topicAction: 'start',
          name: 'x',
          worktree: true,
          worktreePath: '../wt',
        }),
      ),
    ).not.toThrow();
  });

  it('topic finish with the full cleanup flag set', () => {
    expect(() =>
      runAccepting(
        buildFlowArgs({
          operation: 'topic',
          topic: 'feature',
          topicAction: 'finish',
          name: 'x',
          keepWorktree: true,
          forceWorktree: true,
          keepBranch: true,
          fetch: true,
          strategy: 'squash',
          tag: true,
          tagMessage: 'v1',
          ff: true,
          preserveMerges: true,
        }),
      ),
    ).not.toThrow();
  });

  it('topic delete with the remote flag', () => {
    expect(() => runAccepting(['feature', 'delete', 'x', '--remote'])).not.toThrow();
  });

  it('topic list with worktrees', () => {
    expect(() =>
      runAccepting(buildFlowArgs({ operation: 'topic', topic: 'feature', topicAction: 'list', worktrees: true })),
    ).not.toThrow();
  });

  it('control for both recover targets', () => {
    expect(() => runAccepting(buildFlowArgs({ operation: 'control', controlAction: 'continue' }))).not.toThrow();
    expect(() =>
      runAccepting(buildFlowArgs({ operation: 'control', controlAction: 'abort', recover: 'update' })),
    ).not.toThrow();
  });
});

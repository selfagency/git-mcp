import { describe, expect, it } from 'vitest';
import { buildWorktreeArgs } from '../workspace.tools.js';

/** Narrows to the plain-git backend; a flow_* action here would be a test bug. */
const plain = (action: 'add' | 'list' | 'remove' | 'lock' | 'unlock' | 'prune' | 'repair', opts = {}) => {
  const built = buildWorktreeArgs(action, opts);
  if (!('args' in built)) throw new Error(`expected the plain backend for ${action}`);
  return built;
};

/** Narrows to the git-flow backend; a non-flow_* action here would be a test bug. */
const flow = (
  action: 'flow_add' | 'flow_remove' | 'flow_list' | 'flow_path',
  opts = {},
): { flow: string[]; fallback: string } => {
  const built = buildWorktreeArgs(action, opts);
  if (!('flow' in built)) throw new Error(`expected the git-flow backend for ${action}`);
  return built;
};

/**
 * `git_worktree` has two backends and they must not be confused.
 *
 * Path-addressed actions drive plain `git worktree` and need nothing beyond
 * git itself. Branch-addressed `flow_*` actions drive `git flow worktree`,
 * which addresses worktrees by branch name, computes paths from the
 * gitflow.worktreePath template, and tags provenance (git-flow-created vs
 * hand-made) so cleanup can choose remove-vs-detach.
 */
describe('buildWorktreeArgs', () => {
  describe('path-addressed (plain git)', () => {
    it('lists in porcelain form for stable parsing', () => {
      expect(plain('list')).toEqual({ args: ['worktree', 'list', '--porcelain'], fallback: 'No worktrees.' });
    });

    it('requires a path for remove', () => {
      expect(() => plain('remove')).toThrow(/path is required/);
    });

    it('passes --force through to remove', () => {
      expect(plain('remove', { path: '../wt', force: true }).args).toEqual(['worktree', 'remove', '--force', '../wt']);
    });

    it('locks with a reason and unlocks without one', () => {
      expect(plain('lock', { path: '../wt', lock_reason: 'busy' }).args).toEqual([
        'worktree',
        'lock',
        '../wt',
        '--reason',
        'busy',
      ]);
      expect(plain('unlock', { path: '../wt' }).args).toEqual(['worktree', 'unlock', '../wt']);
    });

    it('adds with a branch, or detached when no branch is given', () => {
      expect(plain('add', { path: '../wt', branch: 'feature/x' }).args).toEqual([
        'worktree',
        'add',
        '../wt',
        'feature/x',
      ]);
      expect(plain('add', { path: '../wt', detached: true }).args).toEqual(['worktree', 'add', '--detach', '../wt']);
    });

    it('refuses add with neither a branch nor detached', () => {
      expect(() => plain('add', { path: '../wt' })).toThrow(/branch is required/);
    });

    it('prunes and repairs', () => {
      expect(plain('prune').args).toEqual(['worktree', 'prune']);
      expect(plain('repair').args).toEqual(['worktree', 'repair']);
    });
  });

  describe('branch-addressed (git flow worktree)', () => {
    it('prints the computed path for a branch without creating anything', () => {
      expect(flow('flow_path', { branch: 'feature/user-auth' })).toEqual({
        flow: ['worktree', 'path', 'feature/user-auth'],
        fallback: 'No path computed.',
      });
    });

    it('creates a worktree for an existing branch at its computed path', () => {
      expect(flow('flow_add', { branch: 'feature/user-auth' })).toEqual({
        flow: ['worktree', 'add', 'feature/user-auth'],
        fallback: 'Worktree created.',
      });
    });

    it('overrides the computed path when one is given', () => {
      expect(flow('flow_add', { branch: 'feature/x', path: '../review-copy' }).flow).toEqual([
        'worktree',
        'add',
        'feature/x',
        '--path',
        '../review-copy',
      ]);
    });

    it('keeps the branch when removing, and honours --force', () => {
      expect(flow('flow_remove', { branch: 'feature/x' }).flow).toEqual(['worktree', 'remove', 'feature/x']);
      expect(flow('flow_remove', { branch: 'feature/x', force: true }).flow).toEqual([
        'worktree',
        'remove',
        'feature/x',
        '--force',
      ]);
    });

    it('lists with provenance, which plain git cannot report', () => {
      expect(flow('flow_list').flow).toEqual(['worktree', 'list']);
    });

    it('prunes admin entries for directories that are gone', () => {
      expect(plain('prune').args).toEqual(['worktree', 'prune']);
    });

    it('requires a branch for every flow_* action that targets one', () => {
      for (const action of ['flow_path', 'flow_add', 'flow_remove'] as const) {
        expect(() => buildWorktreeArgs(action, {})).toThrow(/branch is required/);
      }
    });

    it('does not accept a lock reason, which git flow worktree has no flag for', () => {
      expect(() => buildWorktreeArgs('flow_add', { branch: 'feature/x', lock_reason: 'busy' })).toThrow(
        /lock_reason is not supported/,
      );
    });
  });
});

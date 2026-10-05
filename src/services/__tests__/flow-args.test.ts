import { describe, expect, it } from 'vitest';
import { buildFlowArgs } from '../flow-args.js';

describe('buildFlowArgs', () => {
  describe('init', () => {
    it('maps preset, scope, and branch overrides onto init flags', () => {
      expect(
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
      ).toEqual([
        'init',
        '--preset=classic',
        '--force',
        '--no-create-branches',
        '--local',
        '--main=trunk',
        '--develop=dev',
        '--tag=v',
      ]);
    });

    it('rejects scope=file without a config_file', () => {
      expect(() => buildFlowArgs({ operation: 'init', scope: 'file' })).toThrow(/config_file is required/);
    });

    it('rejects combining shared with scope', () => {
      expect(() => buildFlowArgs({ operation: 'init', shared: true, scope: 'local' })).toThrow(/shared=true/);
    });

    it('rejects staging_branch and production_branch, which init has no flags for', () => {
      expect(() => buildFlowArgs({ operation: 'init', stagingBranch: 'stg' })).toThrow(/no --staging/);
      expect(() => buildFlowArgs({ operation: 'init', productionBranch: 'prod' })).toThrow(/--preset=gitlab/);
    });
  });

  describe('config', () => {
    it('maps list, status, and sync', () => {
      expect(buildFlowArgs({ operation: 'config', configAction: 'list' })).toEqual(['config', 'list']);
      expect(buildFlowArgs({ operation: 'config', configAction: 'status' })).toEqual(['config', 'status']);
      expect(buildFlowArgs({ operation: 'config', configAction: 'sync' })).toEqual(['config', 'sync']);
    });

    it('maps update onto the CLI verb edit', () => {
      expect(
        buildFlowArgs({ operation: 'config', configAction: 'update', branchKind: 'base', name: 'develop' }),
      ).toEqual(['config', 'edit', 'base', 'develop']);
    });

    it('passes a parent only to add, which is the only verb accepting one', () => {
      expect(
        buildFlowArgs({
          operation: 'config',
          configAction: 'add',
          branchKind: 'topic',
          name: 'widget',
          parent: 'develop',
          prefix: 'w/',
        }),
      ).toEqual(['config', 'add', 'topic', 'widget', 'develop', '--prefix=w/']);
      expect(
        buildFlowArgs({
          operation: 'config',
          configAction: 'update',
          branchKind: 'topic',
          name: 'widget',
          parent: 'develop',
        }),
      ).toEqual(['config', 'edit', 'topic', 'widget']);
    });

    it('appends new_name for rename', () => {
      expect(
        buildFlowArgs({
          operation: 'config',
          configAction: 'rename',
          branchKind: 'topic',
          name: 'feature',
          newName: 'widget',
        }),
      ).toEqual(['config', 'rename', 'topic', 'feature', 'widget']);
    });

    it('renders boolean config flags as =true/=false, since edit takes no bare form', () => {
      expect(
        buildFlowArgs({
          operation: 'config',
          configAction: 'update',
          branchKind: 'base',
          name: 'develop',
          autoUpdate: false,
          upstreamStrategy: 'rebase',
        }),
      ).toEqual(['config', 'edit', 'base', 'develop', '--upstream-strategy=rebase', '--auto-update=false']);
    });

    it('requires branch_kind, name, and new_name where the CLI does', () => {
      expect(() => buildFlowArgs({ operation: 'config', configAction: 'add', name: 'develop' })).toThrow(
        /branch_kind is required/,
      );
      expect(() => buildFlowArgs({ operation: 'config', configAction: 'add', branchKind: 'base' })).toThrow(
        /name is required/,
      );
      expect(() =>
        buildFlowArgs({ operation: 'config', configAction: 'rename', branchKind: 'base', name: 'develop' }),
      ).toThrow(/new_name is required/);
    });
  });

  describe('topic', () => {
    it('builds start with a base ref', () => {
      expect(buildFlowArgs({ operation: 'topic', topic: 'feature', topicAction: 'start', name: 'x' })).toEqual([
        'feature',
        'start',
        'x',
      ]);
      expect(
        buildFlowArgs({
          operation: 'topic',
          topic: 'feature',
          topicAction: 'start',
          name: 'x',
          baseRef: 'main',
          fetch: true,
        }),
      ).toEqual(['feature', 'start', 'x', 'main', '--fetch']);
    });

    it('builds checkout with the worktree flag the CLI supports', () => {
      expect(
        buildFlowArgs({
          operation: 'topic',
          topic: 'feature',
          topicAction: 'checkout',
          name: 'x',
          worktree: true,
        }),
      ).toEqual(['feature', 'checkout', 'x', '--worktree']);
    });

    it('rejects base_ref on verbs other than start', () => {
      expect(() =>
        buildFlowArgs({
          operation: 'topic',
          topic: 'feature',
          topicAction: 'delete',
          name: 'x',
          baseRef: 'main',
        }),
      ).toThrow(/base_ref is only accepted by topic_action=start/);
    });

    it('rejects a name on list, which takes no positional', () => {
      expect(() => buildFlowArgs({ operation: 'topic', topic: 'feature', topicAction: 'list', name: 'x' })).toThrow(
        /lists every branch/,
      );
    });

    it('requires a name for track', () => {
      expect(() => buildFlowArgs({ operation: 'topic', topic: 'feature', topicAction: 'track' })).toThrow(
        /name is required/,
      );
    });

    it('builds rename with old and new names', () => {
      expect(
        buildFlowArgs({
          operation: 'topic',
          topic: 'feature',
          topicAction: 'rename',
          name: 'old',
          newName: 'new',
        }),
      ).toEqual(['feature', 'rename', 'old', 'new']);
    });

    it('rejects an unknown topic type instead of sending a bogus command', () => {
      expect(() => buildFlowArgs({ operation: 'topic', topic: 'widget', topicAction: 'start', name: 'x' })).toThrow(
        /not a git-flow-next command/,
      );
    });
  });

  describe('verb-scoped flags', () => {
    it('keeps finish-only flags off finish siblings', () => {
      expect(() =>
        buildFlowArgs({
          operation: 'topic',
          topic: 'feature',
          topicAction: 'delete',
          name: 'x',
          tag: true,
        }),
      ).toThrow(/does not accept --tag/);
      expect(() =>
        buildFlowArgs({
          operation: 'topic',
          topic: 'feature',
          topicAction: 'publish',
          name: 'x',
          keepBranch: true,
        }),
      ).toThrow(/does not accept --keep/);
    });

    it('rejects worktree creation flags on finish, which only has the keep/force pair', () => {
      expect(() =>
        buildFlowArgs({
          operation: 'topic',
          topic: 'feature',
          topicAction: 'finish',
          name: 'x',
          worktree: true,
        }),
      ).toThrow(/does not accept --worktree/);
    });

    it('accepts the worktree pair that finish and delete actually define', () => {
      expect(
        buildFlowArgs({
          operation: 'topic',
          topic: 'feature',
          topicAction: 'finish',
          name: 'x',
          keepWorktree: true,
          forceWorktree: true,
        }),
      ).toEqual(['feature', 'finish', 'x', '--keep-worktree', '--force-worktree']);
      expect(
        buildFlowArgs({
          operation: 'topic',
          topic: 'feature',
          topicAction: 'delete',
          name: 'x',
          forceWorktree: true,
        }),
      ).toEqual(['feature', 'delete', 'x', '--force-worktree']);
    });

    it('rejects a worktree flag on list, which only has --worktrees', () => {
      expect(buildFlowArgs({ operation: 'topic', topic: 'feature', topicAction: 'list', worktrees: true })).toEqual([
        'feature',
        'list',
        '--worktrees',
      ]);
      expect(() =>
        buildFlowArgs({ operation: 'topic', topic: 'feature', topicAction: 'list', worktree: true }),
      ).toThrow(/does not accept --worktree/);
    });

    it('requires worktree=true when a worktree path is given', () => {
      expect(
        buildFlowArgs({
          operation: 'topic',
          topic: 'feature',
          topicAction: 'start',
          name: 'x',
          worktree: true,
          worktreePath: '../wt',
        }),
      ).toEqual(['feature', 'start', 'x', '--worktree', '--worktree-path=../wt']);
      expect(() =>
        buildFlowArgs({
          operation: 'topic',
          topic: 'feature',
          topicAction: 'start',
          name: 'x',
          worktreePath: '../wt',
        }),
      ).toThrow(/worktree_path requires worktree=true/);
    });
  });

  describe('control', () => {
    it('defaults to finish recovery', () => {
      expect(buildFlowArgs({ operation: 'control', controlAction: 'continue' })).toEqual(['finish', '--continue']);
      expect(buildFlowArgs({ operation: 'control', controlAction: 'abort' })).toEqual(['finish', '--abort']);
    });

    it('can target update, which has its own recovery flags', () => {
      expect(buildFlowArgs({ operation: 'control', controlAction: 'continue', recover: 'update' })).toEqual([
        'update',
        '--continue',
      ]);
    });

    it('never targets delete, which defines no recovery flags', () => {
      expect(() =>
        buildFlowArgs({ operation: 'control', controlAction: 'continue', recover: 'delete' as 'finish' }),
      ).not.toThrow();
    });
  });

  describe('legacy actions', () => {
    it('maps legacy aliases onto real commands', () => {
      expect(buildFlowArgs({ legacyAction: 'overview' })).toEqual(['overview']);
      expect(buildFlowArgs({ legacyAction: 'config-list' })).toEqual(['config', 'list']);
      expect(buildFlowArgs({ legacyAction: 'feature-start', name: 'x' })).toEqual(['feature', 'start', 'x']);
      expect(buildFlowArgs({ legacyAction: 'topic-finish', name: 'x' })).toEqual(['finish', 'x']);
      expect(buildFlowArgs({ legacyAction: 'control-continue' })).toEqual(['finish', '--continue']);
    });

    it('rejects an unknown alias', () => {
      expect(() => buildFlowArgs({ legacyAction: 'bogus-thing' })).toThrow(/Unsupported legacy flow action/);
    });

    it('rejects mixing a legacy action with the canonical form', () => {
      expect(() => buildFlowArgs({ legacyAction: 'overview', topic: 'feature', topicAction: 'start' })).toThrow(
        /not both/,
      );
    });
  });

  describe('unsupported parameters', () => {
    it('reports each one with a reason instead of dropping it', () => {
      expect(() => buildFlowArgs({ operation: 'topic', topic: 'feature', topicAction: 'list', pattern: 'x*' })).toThrow(
        /takes no name filter/,
      );
      expect(() =>
        buildFlowArgs({ operation: 'topic', topic: 'feature', topicAction: 'finish', noBackmerge: true }),
      ).toThrow(/no backmerge suppression/);
      expect(() =>
        buildFlowArgs({ operation: 'topic', topic: 'feature', topicAction: 'publish', remote: 'up' }),
      ).toThrow(/gitflow.origin config key/);
      expect(() =>
        buildFlowArgs({
          operation: 'topic',
          topic: 'feature',
          topicAction: 'checkout',
          name: 'x',
          matchMode: 'prefix',
        }),
      ).toThrow(/partial matching itself/);
    });
  });
});

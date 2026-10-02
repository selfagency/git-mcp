import type {
  FlowBranchKind,
  FlowConfigAction,
  FlowControlAction,
  FlowMergeStrategy,
  FlowOperation,
  FlowPreset,
  FlowScope,
  FlowTopicAction,
} from '../types.js';

/** Everything `git_flow` accepts, after schema coercion. */
export interface FlowArgOptions {
  readonly operation?: FlowOperation;
  readonly legacyAction?: string;
  readonly configAction?: FlowConfigAction;
  readonly topicAction?: FlowTopicAction;
  readonly controlAction?: FlowControlAction;
  /** Which in-progress operation `control_action` resumes. finish is the common case. */
  readonly recover?: FlowRecoverTarget;
  readonly topic?: string;
  readonly name?: string;
  readonly newName?: string;
  readonly branchKind?: FlowBranchKind;
  readonly parent?: string;
  readonly prefix?: string;
  readonly startPoint?: string;
  readonly baseRef?: string;
  readonly preset?: FlowPreset;
  readonly scope?: FlowScope;
  readonly shared?: boolean;
  readonly configFile?: string;
  readonly strategy?: FlowMergeStrategy;
  readonly force?: boolean;
  readonly noCreateBranches?: boolean;
  readonly mainBranch?: string;
  readonly developBranch?: string;
  readonly tagPrefix?: string;
  readonly upstreamStrategy?: FlowMergeStrategy;
  readonly downstreamStrategy?: FlowMergeStrategy;
  readonly autoUpdate?: boolean;
  readonly fetch?: boolean;
  readonly ff?: boolean;
  readonly keepBranch?: boolean;
  readonly rebaseBeforeFinish?: boolean;
  readonly preserveMerges?: boolean;
  readonly publish?: boolean;
  readonly forceDelete?: boolean;
  readonly tag?: boolean;
  readonly tagMessage?: string;
  readonly worktree?: boolean;
  readonly worktrees?: boolean;
  readonly worktreePath?: string;
  readonly keepWorktree?: boolean;
  readonly forceWorktree?: boolean;
  // Retained in the tool schema but unsupported by git-flow-next 2.1.0.
  // Reported, never silently dropped — a dropped flag is an invisible
  // behaviour change, so each has a stated reason.
  readonly pattern?: string;
  readonly matchMode?: 'exact' | 'prefix';
  readonly noBackmerge?: boolean;
  readonly remote?: string;
  readonly stagingBranch?: string;
  readonly productionBranch?: string;
}

export type FlowRecoverTarget = 'finish' | 'update';

/** Topic branch types git-flow-next exposes as commands. */
export const TOPIC_TYPES = ['bugfix', 'feature', 'release', 'hotfix', 'support'] as const;

const CONFIG_VERB: Record<Exclude<FlowConfigAction, 'list' | 'status' | 'sync'>, string> = {
  add: 'add',
  update: 'edit',
  rename: 'rename',
  delete: 'delete',
};

/** `init` maps topic-type prefixes onto their flags; gitlab's staging/production have none. */
const INIT_FLAG: Record<string, string> = {
  mainBranch: '--main',
  developBranch: '--develop',
  tagPrefix: '--tag',
};

const CONFIG_FLAG: Record<string, string> = {
  prefix: '--prefix',
  startPoint: '--starting-point',
  upstreamStrategy: '--upstream-strategy',
  downstreamStrategy: '--downstream-strategy',
  autoUpdate: '--auto-update',
};

/**
 * Per-verb flag sets, verified against `git flow <type> <verb> --help` on 2.1.0.
 * A flag absent here raises rather than being sent, because git-flow rejects
 * unknown flags with a usage dump that buries the real error.
 *
 * Exported so the CLI-contract test can assert the table itself; a CLI upgrade
 * means updating this table and that test together.
 */
export const VERB_FLAGS: Record<FlowTopicAction, ReadonlySet<string>> = {
  start: new Set(['fetch', 'no-fetch', 'no-cd', 'quiet', 'worktree', 'no-worktree', 'worktree-path']),
  finish: new Set([
    'abort',
    'continue',
    'fetch',
    'no-fetch',
    'ff',
    'ff-only',
    'force',
    'force-delete',
    'no-force-delete',
    'force-worktree',
    'keep',
    'no-keep',
    'keep-worktree',
    'keeplocal',
    'no-keeplocal',
    'keepremote',
    'no-keepremote',
    'merge-message',
    'message',
    'messagefile',
    'no-ff',
    'no-preserve-merges',
    'no-rebase',
    'no-sign',
    'no-squash',
    'no-verify',
    'notag',
    'preserve-merges',
    'push',
    'pushtag',
    'no-pushtag',
    'no-push',
    'rebase',
    'sign',
    'signingkey',
    'squash',
    'squash-message',
    'tag',
    'tagname',
    'update-message',
  ]),
  publish: new Set(['no-push-option', 'push-option']),
  list: new Set(['worktrees']),
  update: new Set(['abort', 'continue', 'rebase']),
  delete: new Set(['fetch', 'no-fetch', 'force', 'no-force', 'keep-worktree', 'force-worktree', 'remote', 'no-remote']),
  rename: new Set<string>(),
  checkout: new Set(['force', 'no-cd', 'quiet', 'showcommands', 'worktree']),
  track: new Set<string>(),
};

/**
 * Translates a tool request into `git flow` argv.
 *
 * Every parameter either becomes a flag or raises. Silently dropping an
 * unsupported option would let a caller believe a safety switch was applied
 * when the CLI never saw it.
 */
export function buildFlowArgs(options: FlowArgOptions): string[] {
  const args = options.legacyAction ? fromLegacyAction(options) : fromOperation(options);
  assertSupported(options);
  return args;
}

// git-flow-next 2.1.0 exposes no --format on any command; the published
// command reference documents one the released binary rejects, so output is text.
function fromLegacyAction(options: FlowArgOptions): string[] {
  const action = options.legacyAction ?? '';
  const [group, verb] = action.split('-');
  if (action === 'init') return ['init'];
  if (action === 'overview') return ['overview'];
  if (group === 'config') {
    return configArgs({ ...options, configAction: verb as FlowConfigAction, legacyAction: undefined });
  }
  if (group === 'control') {
    return controlArgs({ ...options, controlAction: verb as FlowControlAction, legacyAction: undefined });
  }
  // `topic-finish` maps to the bare current-branch command; the typed groups
  // carry the verb for a specific branch type.
  if (group === 'topic') return [verb].concat(options.name ? [options.name] : []);
  if ((TOPIC_TYPES as readonly string[]).includes(group)) {
    return [group, verb].concat(options.name ? [options.name] : []);
  }
  throw new Error(`Unsupported legacy flow action: ${action}`);
}

function fromOperation(options: FlowArgOptions): string[] {
  switch (options.operation) {
    case 'init':
      return initArgs(options);
    case 'overview':
      return ['overview'];
    case 'config':
      return configArgs(options);
    case 'control':
      return controlArgs(options);
    case 'topic':
      return topicArgs(options);
    default:
      throw new Error('operation is required. Use operation=config|topic|control, or a legacy action.');
  }
}

function initArgs(options: FlowArgOptions): string[] {
  const args = ['init'];
  if (options.preset) args.push(`--preset=${options.preset}`);
  if (options.force) args.push('--force');
  if (options.noCreateBranches) args.push('--no-create-branches');
  if (options.shared) {
    if (options.scope) throw new Error('shared=true cannot be combined with scope; --shared picks its own storage.');
    args.push('--shared');
  } else if (options.scope === 'file') {
    if (!options.configFile) throw new Error('config_file is required when scope is "file".');
    args.push(`--file=${options.configFile}`);
  } else if (options.scope) {
    args.push(`--${options.scope}`);
  }
  for (const [key, flag] of Object.entries(INIT_FLAG)) {
    const value = options[key as keyof FlowArgOptions];
    if (typeof value === 'string' && value) args.push(`${flag}=${value}`);
  }
  return args;
}

function configArgs(options: FlowArgOptions): string[] {
  const action = options.configAction;
  if (!action) throw new Error('config_action is required for operation=config.');
  if (action === 'list') return ['config', 'list'];
  if (action === 'status') return ['config', 'status'];
  if (action === 'sync') return ['config', 'sync'];

  if (!options.branchKind) throw new Error('branch_kind is required for config add, update, rename, and delete.');
  if (!options.name) throw new Error('name is required for config operations.');
  if (action === 'rename' && !options.newName) throw new Error('new_name is required for config rename.');

  const args = ['config', CONFIG_VERB[action], options.branchKind, options.name];
  // Only `add` takes a parent; edit/rename/delete reject a second positional.
  if (action === 'add' && options.parent) args.push(options.parent);
  if (action === 'rename' && options.newName) args.push(options.newName);

  for (const [key, flag] of Object.entries(CONFIG_FLAG)) {
    const value = options[key as keyof FlowArgOptions];
    if (value === undefined) continue;
    args.push(typeof value === 'boolean' ? `${flag}=${value}` : `${flag}=${value as string}`);
  }
  if (options.shared) args.push('--shared');
  return args;
}

function controlArgs(options: FlowArgOptions): string[] {
  const action = options.controlAction;
  if (!action) throw new Error('control_action is required for operation=control.');
  // finish and update each own their recovery flags; `delete` has none.
  return [options.recover ?? 'finish', `--${action}`];
}

function topicArgs(options: FlowArgOptions): string[] {
  const action = options.topicAction;
  if (!action) throw new Error('topic_action is required for operation=topic.');
  if (!options.topic)
    throw new Error(
      `topic is required for operation=topic (${TOPIC_TYPES.join(', ')}, or a custom type you configured).`,
    );
  if (!(TOPIC_TYPES as readonly string[]).includes(options.topic))
    throw new Error(
      `topic="${options.topic}" is not a git-flow-next command. Built-in types: ${TOPIC_TYPES.join(', ')}.`,
    );

  const allowed = VERB_FLAGS[action];
  const flags = collectFlags(options, allowed);

  const args = [options.topic, action];
  if (action === 'rename') {
    if (!options.newName) throw new Error('new_name is required for topic_action=rename.');
    if (options.name) args.push(options.name, options.newName);
    else args.push(options.newName);
  } else if (action === 'track') {
    if (!options.name) throw new Error('name is required for topic_action=track.');
    args.push(options.name);
  } else if (action === 'list') {
    if (options.name) throw new Error('name is not accepted by topic_action=list; it lists every branch of the type.');
  } else {
    if (options.name) args.push(options.name);
    if (options.baseRef && action === 'start') args.push(options.baseRef);
    else if (options.baseRef) throw new Error(`base_ref is only accepted by topic_action=start, not ${action}.`);
  }
  args.push(...flags);
  return args;
}

/** Maps options onto flags, rejecting any the target verb does not define. */
function collectFlags(options: FlowArgOptions, allowed: ReadonlySet<string>): string[] {
  const args: string[] = [];
  const push = (flag: string): void => {
    assertFlagAllowed(options, flag, allowed);
    args.push(`--${flag}`);
  };
  const pushValue = (flag: string, value: string | boolean): void => {
    assertFlagAllowed(options, flag, allowed);
    args.push(typeof value === 'boolean' ? `${flag}=${value}` : `--${flag}=${value}`);
  };

  if (options.fetch === true) push('fetch');
  if (options.fetch === false) push('no-fetch');
  if (options.keepBranch === true) push('keep');
  if (options.keepBranch === false) push('no-keep');
  if (options.publish) push('push');
  if (options.forceDelete) push('force-delete');
  if (options.keepWorktree) push('keep-worktree');
  if (options.forceWorktree) push('force-worktree');
  if (options.worktrees) push('worktrees');
  if (options.worktree === true) push('worktree');
  if (options.worktree === false) push('no-worktree');
  if (options.worktreePath) {
    // Namer's intent is a worktree; make that explicit rather than relying on
    // the CLI's implicit behaviour.
    if (options.worktree !== true) {
      throw new Error(
        'worktree_path requires worktree=true; the CLI treats naming a path as a request for a worktree.',
      );
    }
    pushValue('worktree-path', options.worktreePath);
  }
  if (options.rebaseBeforeFinish) push('rebase');
  if (options.preserveMerges) push('preserve-merges');
  if (options.ff) push('ff');
  // git-flow has no --strategy flag; the strategy is expressed as the
  // positive/negative pair it does define.
  if (options.strategy === 'rebase') push('rebase');
  if (options.strategy === 'squash') push('squash');
  if (options.strategy === 'none') {
    push('no-rebase');
    push('no-squash');
  }
  if (options.tag === true) push('tag');
  if (options.tag === false) push('notag');
  if (options.tagMessage) pushValue('message', options.tagMessage);
  return args;
}

function assertFlagAllowed(options: FlowArgOptions, flag: string, allowed: ReadonlySet<string>): void {
  if (!allowed.has(flag)) {
    throw new Error(
      `git flow does not accept --${flag} for this operation (topic_action=${options.topicAction ?? 'none'}).`,
    );
  }
}

function assertSupported(options: FlowArgOptions): void {
  if (options.pattern) {
    throw new Error('pattern is not supported: `git flow <type> list` takes no name filter.');
  }
  if (options.noBackmerge) {
    throw new Error('no_backmerge is not supported: git-flow-next has no backmerge suppression flag.');
  }
  if (options.remote) {
    throw new Error('remote is not supported: git-flow-next uses the gitflow.origin config key, not a per-call flag.');
  }
  if (options.matchMode && options.matchMode !== 'exact') {
    throw new Error(
      'match_mode=prefix is not supported as a parameter; git-flow does partial matching itself on checkout.',
    );
  }
  if (options.stagingBranch || options.productionBranch) {
    throw new Error(
      'staging_branch/production_branch are not supported: git-flow-next 2.1.0 init has no --staging or ' +
        '--production flag. Use --preset=gitlab, which configures both.',
    );
  }
  if (options.legacyAction && options.topicAction) {
    throw new Error('Pass either a legacy action or operation/topic_action, not both.');
  }
}

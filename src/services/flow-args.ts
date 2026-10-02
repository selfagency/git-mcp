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

/** Verbs that take no branch kind or name; the verb name is the argv. */
type FlowStandaloneConfigVerb = 'list' | 'status' | 'sync';

function isStandaloneConfigVerb(action: FlowConfigAction): action is FlowStandaloneConfigVerb {
  return action === 'list' || action === 'status' || action === 'sync';
}

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
  if (isStandaloneConfigVerb(action)) return ['config', action];

  if (!options.branchKind) throw new Error('branch_kind is required for config add, update, rename, and delete.');
  if (!options.name) throw new Error('name is required for config operations.');
  if (action === 'rename' && !options.newName) throw new Error('new_name is required for config rename.');

  return ['config', CONFIG_VERB[action], options.branchKind, options.name].concat(
    configPositionals(options, action),
    configFlags(options),
  );
}

function configPositionals(options: FlowArgOptions, action: string): string[] {
  // Only `add` takes a parent; edit/rename/delete reject a second positional.
  if (action === 'add' && options.parent) return [options.parent];
  if (action === 'rename' && options.newName) return [options.newName];
  return [];
}

function configFlags(options: FlowArgOptions): string[] {
  const args: string[] = [];
  for (const [key, flag] of Object.entries(CONFIG_FLAG)) {
    const value = options[key as keyof FlowArgOptions];
    if (value !== undefined) args.push(`${flag}=${value}`);
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

  const flags = collectFlags(options, VERB_FLAGS[action]);
  return [options.topic, action].concat(topicPositionals(options, action), flags);
}

function topicPositionals(options: FlowArgOptions, action: FlowTopicAction): string[] {
  if (action === 'rename') {
    if (!options.newName) throw new Error('new_name is required for topic_action=rename.');
    return options.name ? [options.name, options.newName] : [options.newName];
  }
  if (action === 'track') {
    if (!options.name) throw new Error('name is required for topic_action=track.');
    return [options.name];
  }
  if (action === 'list') {
    if (options.name) throw new Error('name is not accepted by topic_action=list; it lists every branch of the type.');
    return [];
  }
  if (!options.baseRef) return options.name ? [options.name] : [];
  if (action !== 'start') throw new Error(`base_ref is only accepted by topic_action=start, not ${action}.`);
  return options.name ? [options.name, options.baseRef] : [options.baseRef];
}

/** Maps options onto flags, rejecting any the target verb does not define. */
function collectFlags(options: FlowArgOptions, allowed: ReadonlySet<string>): string[] {
  // Validate coherence before any flag lookup: naming a path without asking for
  // a worktree is a self-contradictory request, and saying so beats the generic
  // "flag not allowed here" it would otherwise trip over first.
  if (options.worktreePath && options.worktree !== true) {
    throw new Error('worktree_path requires worktree=true; the CLI treats naming a path as a request for a worktree.');
  }

  const emit = (pairs: ReadonlyArray<readonly [string, boolean]>): void => {
    for (const [flag, enabled] of pairs) {
      if (enabled) args.push(`--${guard(options, allowed, flag)}`);
    }
  };

  const args: string[] = [];
  emit(lifecycleFlags(options));
  if (options.worktreePath) args.push(`--${guard(options, allowed, 'worktree-path')}=${options.worktreePath}`);
  emit(tagFlags(options));
  if (options.tagMessage) args.push(`--${guard(options, allowed, 'message')}=${options.tagMessage}`);
  return args;
}

/**
 * Valueless flags in emission order. git-flow has no `--strategy` flag, so
 * `strategy` expands into the positive/negative pairs it does define. Kept in
 * two groups only so the worktree path lands between them, as the emitted argv
 * has always done.
 */
function lifecycleFlags(options: FlowArgOptions): Array<readonly [string, boolean]> {
  return [
    ['fetch', options.fetch === true],
    ['no-fetch', options.fetch === false],
    ['keep', options.keepBranch === true],
    ['no-keep', options.keepBranch === false],
    ['push', Boolean(options.publish)],
    ['force-delete', Boolean(options.forceDelete)],
    ['keep-worktree', Boolean(options.keepWorktree)],
    ['force-worktree', Boolean(options.forceWorktree)],
    ['worktrees', Boolean(options.worktrees)],
    ['worktree', options.worktree === true],
    ['no-worktree', options.worktree === false],
    ['rebase', Boolean(options.rebaseBeforeFinish) || options.strategy === 'rebase'],
    ['preserve-merges', Boolean(options.preserveMerges)],
    ['ff', Boolean(options.ff)],
    ['squash', options.strategy === 'squash'],
    ['no-rebase', options.strategy === 'none'],
    ['no-squash', options.strategy === 'none'],
  ];
}

function tagFlags(options: FlowArgOptions): Array<readonly [string, boolean]> {
  return [
    ['tag', options.tag === true],
    ['notag', options.tag === false],
  ];
}

/** Returns the bare flag name, or raises when the target verb does not define it. */
function guard(options: FlowArgOptions, allowed: ReadonlySet<string>, flag: string): string {
  if (!allowed.has(flag)) {
    throw new Error(
      `git flow does not accept --${flag} for this operation (topic_action=${options.topicAction ?? 'none'}).`,
    );
  }
  return flag;
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

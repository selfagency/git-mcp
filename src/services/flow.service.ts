import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { ALLOW_FLOW_HOOKS } from '../config.js';
import { getGit, toGitError } from '../git/client.js';
import { CHARACTER_LIMIT } from '../constants.js';
import type {
  FlowActiveBranch,
  FlowBranchDefinition,
  FlowBranchKind,
  FlowConfigAction,
  FlowConfigMutationResult,
  FlowControlAction,
  FlowFilterExecutionResult,
  FlowFilterKind,
  FlowFinishResult,
  FlowFinishStage,
  FlowFinishState,
  FlowHealthStatus,
  FlowHookExecutionResult,
  FlowHookPhase,
  FlowMatchMode,
  FlowMergeStrategy,
  FlowOverview,
  FlowTopicAction,
  FlowTopicSelection,
} from '../types.js';

const execFileAsync = promisify(execFile);

type GitClient = ReturnType<typeof getGit>;

export type FlowLegacyAction =
  | 'init'
  | 'overview'
  | 'config-list'
  | 'config-add'
  | 'config-update'
  | 'config-rename'
  | 'config-delete'
  | 'topic-start'
  | 'topic-finish'
  | 'topic-publish'
  | 'topic-list'
  | 'topic-update'
  | 'topic-delete'
  | 'topic-rename'
  | 'topic-checkout'
  | 'topic-track'
  | 'control-continue'
  | 'control-abort'
  | 'feature-start'
  | 'feature-finish'
  | 'feature-publish'
  | 'feature-list'
  | 'feature-update'
  | 'feature-delete'
  | 'feature-rename'
  | 'feature-checkout'
  | 'feature-track'
  | 'release-start'
  | 'release-finish'
  | 'release-publish'
  | 'release-list'
  | 'release-update'
  | 'release-delete'
  | 'release-rename'
  | 'release-checkout'
  | 'release-track'
  | 'hotfix-start'
  | 'hotfix-finish'
  | 'hotfix-publish'
  | 'hotfix-list'
  | 'hotfix-update'
  | 'hotfix-delete'
  | 'hotfix-rename'
  | 'hotfix-checkout'
  | 'hotfix-track'
  | 'support-start'
  | 'support-finish'
  | 'support-publish'
  | 'support-list'
  | 'support-update'
  | 'support-delete'
  | 'support-rename'
  | 'support-checkout'
  | 'support-track';

export type FlowOperation = 'init' | 'overview' | 'config' | 'topic' | 'control';

export interface FlowOptions {
  readonly action?: FlowLegacyAction;
  readonly operation?: FlowOperation;
  readonly configAction?: FlowConfigAction;
  readonly topicAction?: FlowTopicAction;
  readonly controlAction?: FlowControlAction;
  readonly topic?: string;
  readonly name?: string;
  readonly newName?: string;
  readonly pattern?: string;
  readonly matchMode?: FlowMatchMode;
  readonly branchKind?: FlowBranchKind;
  readonly parent?: string;
  readonly prefix?: string;
  readonly startPoint?: string;
  readonly mainBranch?: string;
  readonly developBranch?: string;
  readonly stagingBranch?: string;
  readonly productionBranch?: string;
  readonly remote?: string;
  readonly tag?: boolean;
  readonly tagMessage?: string;
  readonly tagPrefix?: string;
  readonly deleteBranch?: boolean;
  readonly keepBranch?: boolean;
  readonly publishAfterFinish?: boolean;
  readonly preset?: 'classic' | 'github' | 'gitlab';
  readonly scope?: 'local' | 'global' | 'system' | 'file';
  readonly configFile?: string;
  readonly force?: boolean;
  readonly forceDelete?: boolean;
  readonly noCreateBranches?: boolean;
  readonly autoUpdate?: boolean;
  readonly upstreamStrategy?: FlowMergeStrategy;
  readonly downstreamStrategy?: FlowMergeStrategy;
  readonly strategy?: FlowMergeStrategy;
  readonly fetch?: boolean;
  readonly ff?: boolean;
  readonly noBackmerge?: boolean;
  readonly rebaseBeforeFinish?: boolean;
  readonly preserveMerges?: boolean;
  readonly publish?: boolean;
  readonly signTag?: boolean;
  readonly baseRef?: string;
}

export interface FlowActionResult {
  readonly markdown: string;
  readonly data?: unknown;
}

interface FlowCommandConfig {
  readonly finishStrategy: FlowMergeStrategy;
  readonly fetchBeforeFinish: boolean;
  readonly keepBranch: boolean;
  readonly publishAfterFinish: boolean;
  readonly rebaseBeforeFinish: boolean;
  readonly preserveMerges: boolean;
  readonly ff: boolean;
}

interface FlowFilterConfig {
  readonly version?: string;
  readonly tagMessage?: string;
}

interface FlowTopicDefinition extends FlowBranchDefinition {
  readonly command: FlowCommandConfig;
  readonly filters: FlowFilterConfig;
}

interface FlowConfigState {
  readonly initialized: boolean;
  readonly version?: string;
  readonly compatibility: 'structured' | 'legacy' | 'unconfigured';
  readonly bases: readonly FlowBranchDefinition[];
  readonly topics: readonly FlowTopicDefinition[];
  readonly versionTagPrefix: string;
  readonly config: ReadonlyMap<string, string>;
}

interface FlowPresetDefinition {
  readonly versionTagPrefix: string;
  readonly bases: readonly FlowBranchDefinition[];
  readonly topics: readonly FlowTopicDefinition[];
}

interface NormalizedFlowRequest {
  readonly operation: FlowOperation;
  readonly configAction?: FlowConfigAction;
  readonly topicAction?: FlowTopicAction;
  readonly controlAction?: FlowControlAction;
  readonly topic?: string;
}

const DEFAULT_REMOTE = 'origin';
const FINISH_STATE_PREFIX = 'gitflow.state.finish';
const FILTER_MAX_RUNTIME_MS = 10_000;
const FILTER_MAX_OUTPUT_CHARS = 64_000;
const SAFE_CHILD_ENV_KEYS = [
  'PATH',
  'HOME',
  'USER',
  'LOGNAME',
  'SHELL',
  'TMPDIR',
  'TMP',
  'TEMP',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'SystemRoot',
  'ComSpec',
  'PATHEXT',
  'WINDIR',
] as const;
const FLOW_CONFIG_PROPERTIES = [
  'type',
  'parent',
  'prefix',
  'startpoint',
  'upstreamstrategy',
  'downstreamstrategy',
  'tag',
  'tagprefix',
  'autoupdate',
  'forcedelete',
] as const;
const FLOW_FINISH_PROPERTIES = [
  'strategy',
  'fetch',
  'keep',
  'publish',
  'rebaseBeforeFinish',
  'preserveMerges',
  'ff',
] as const;
const FLOW_FILTER_PROPERTIES = ['version', 'tagMessage'] as const;
const CONTROL_STAGES: ReadonlySet<FlowFinishStage> = new Set<FlowFinishStage>([
  'prepare',
  'hook-pre-finish',
  'filter-version',
  'checkout-parent',
  'integrate-parent',
  'tag',
  'hook-post-parent',
  'checkout-backmerge',
  'integrate-backmerge',
  'hook-post-finish',
  'publish',
  'cleanup',
]);

function buildSafeChildEnv(extraEnv: Readonly<Record<string, string>>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of SAFE_CHILD_ENV_KEYS) {
    const value = process.env[key];
    if (value !== undefined) {
      env[key] = value;
    }
  }
  return {
    ...env,
    ...extraEnv,
  };
}

function isFileSafe(candidate: string): boolean {
  try {
    return existsSync(candidate) && statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function asBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return undefined;
}

function asStrategy(value: string | undefined, fallback: FlowMergeStrategy): FlowMergeStrategy {
  if (value === 'merge' || value === 'rebase' || value === 'squash' || value === 'none') {
    return value;
  }
  return fallback;
}

function splitConfigLine(line: string): [string, string] | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  const whitespaceIndex = trimmed.search(/\s/);
  if (whitespaceIndex === -1) {
    return [trimmed, ''];
  }

  return [trimmed.slice(0, whitespaceIndex), trimmed.slice(whitespaceIndex).trim()];
}

async function readGitflowConfig(git: GitClient): Promise<Map<string, string>> {
  try {
    const rawConfig = await git.raw(['config', '--get-regexp', '^gitflow\\.']);
    const entries = rawConfig
      .split(/\r?\n/)
      .map(splitConfigLine)
      .filter((entry): entry is [string, string] => entry !== null);

    return new Map(entries);
  } catch {
    return new Map();
  }
}

function getConfigValue(config: ReadonlyMap<string, string>, key: string): string | undefined {
  return config.get(key)?.trim() || undefined;
}

function defaultCommandConfig(kind: FlowBranchKind): FlowCommandConfig {
  return {
    finishStrategy: kind === 'topic' ? 'merge' : 'none',
    fetchBeforeFinish: true,
    keepBranch: false,
    publishAfterFinish: false,
    rebaseBeforeFinish: false,
    preserveMerges: false,
    ff: false,
  };
}

function buildTopicDefinition(
  branch: FlowBranchDefinition,
  config: ReadonlyMap<string, string>,
  versionTagPrefix: string,
): FlowTopicDefinition {
  const defaults = defaultCommandConfig('topic');
  return {
    ...branch,
    tagPrefix: branch.tagPrefix ?? versionTagPrefix,
    command: {
      finishStrategy: asStrategy(
        getConfigValue(config, `gitflow.${branch.name}.finish.strategy`),
        defaults.finishStrategy,
      ),
      fetchBeforeFinish:
        asBoolean(getConfigValue(config, `gitflow.${branch.name}.finish.fetch`)) ?? defaults.fetchBeforeFinish,
      keepBranch: asBoolean(getConfigValue(config, `gitflow.${branch.name}.finish.keep`)) ?? defaults.keepBranch,
      publishAfterFinish:
        asBoolean(getConfigValue(config, `gitflow.${branch.name}.finish.publish`)) ?? defaults.publishAfterFinish,
      rebaseBeforeFinish:
        asBoolean(getConfigValue(config, `gitflow.${branch.name}.finish.rebaseBeforeFinish`)) ??
        defaults.rebaseBeforeFinish,
      preserveMerges:
        asBoolean(getConfigValue(config, `gitflow.${branch.name}.finish.preserveMerges`)) ?? defaults.preserveMerges,
      ff: asBoolean(getConfigValue(config, `gitflow.${branch.name}.finish.ff`)) ?? defaults.ff,
    },
    filters: {
      version: getConfigValue(config, `gitflow.${branch.name}.filter.version`),
      tagMessage:
        getConfigValue(config, `gitflow.${branch.name}.filter.tagMessage`) ??
        getConfigValue(config, `gitflow.${branch.name}.filter.tag_message`),
    },
  };
}

function getPresetDefinition(options: FlowOptions): FlowPresetDefinition {
  const preset = options.preset ?? 'classic';

  if (preset === 'github') {
    const mainBranch = options.mainBranch ?? 'main';
    return {
      versionTagPrefix: '',
      bases: [
        {
          name: mainBranch,
          kind: 'base',
          upstreamStrategy: 'none',
          downstreamStrategy: 'none',
          source: 'structured',
        },
      ],
      topics: [
        {
          name: 'feature',
          kind: 'topic',
          parent: mainBranch,
          prefix: 'feature/',
          upstreamStrategy: 'merge',
          downstreamStrategy: 'rebase',
          source: 'structured',
          command: {
            ...defaultCommandConfig('topic'),
            finishStrategy: 'merge',
            ff: true,
          },
          filters: {},
        },
      ],
    };
  }

  if (preset === 'gitlab') {
    const productionBranch = options.productionBranch ?? 'production';
    const stagingBranch = options.stagingBranch ?? 'staging';
    const mainBranch = options.mainBranch ?? 'main';
    return {
      versionTagPrefix: '',
      bases: [
        {
          name: productionBranch,
          kind: 'base',
          upstreamStrategy: 'none',
          downstreamStrategy: 'none',
          source: 'structured',
        },
        {
          name: stagingBranch,
          kind: 'base',
          parent: productionBranch,
          upstreamStrategy: 'merge',
          downstreamStrategy: 'merge',
          autoUpdate: true,
          source: 'structured',
        },
        {
          name: mainBranch,
          kind: 'base',
          parent: stagingBranch,
          upstreamStrategy: 'merge',
          downstreamStrategy: 'merge',
          autoUpdate: true,
          source: 'structured',
        },
      ],
      topics: [
        {
          name: 'feature',
          kind: 'topic',
          parent: mainBranch,
          prefix: 'feature/',
          upstreamStrategy: 'merge',
          downstreamStrategy: 'rebase',
          source: 'structured',
          command: {
            ...defaultCommandConfig('topic'),
            finishStrategy: 'merge',
            ff: true,
          },
          filters: {},
        },
        {
          name: 'hotfix',
          kind: 'topic',
          parent: productionBranch,
          prefix: 'hotfix/',
          upstreamStrategy: 'merge',
          downstreamStrategy: 'merge',
          tag: true,
          source: 'structured',
          command: defaultCommandConfig('topic'),
          filters: {},
        },
      ],
    };
  }

  const mainBranch = options.mainBranch ?? 'main';
  const developBranch = options.developBranch ?? 'develop';
  return {
    versionTagPrefix: '',
    bases: [
      {
        name: mainBranch,
        kind: 'base',
        upstreamStrategy: 'none',
        downstreamStrategy: 'none',
        source: 'structured',
      },
      {
        name: developBranch,
        kind: 'base',
        parent: mainBranch,
        upstreamStrategy: 'merge',
        downstreamStrategy: 'merge',
        autoUpdate: true,
        source: 'structured',
      },
    ],
    topics: [
      {
        name: 'feature',
        kind: 'topic',
        parent: developBranch,
        prefix: 'feature/',
        upstreamStrategy: 'merge',
        downstreamStrategy: 'rebase',
        source: 'structured',
        command: {
          ...defaultCommandConfig('topic'),
          finishStrategy: 'merge',
        },
        filters: {},
      },
      {
        name: 'release',
        kind: 'topic',
        parent: mainBranch,
        startPoint: developBranch,
        prefix: 'release/',
        upstreamStrategy: 'merge',
        downstreamStrategy: 'merge',
        tag: true,
        source: 'structured',
        command: defaultCommandConfig('topic'),
        filters: {},
      },
      {
        name: 'hotfix',
        kind: 'topic',
        parent: mainBranch,
        prefix: 'hotfix/',
        upstreamStrategy: 'merge',
        downstreamStrategy: 'merge',
        tag: true,
        source: 'structured',
        command: defaultCommandConfig('topic'),
        filters: {},
      },
      {
        name: 'support',
        kind: 'topic',
        parent: mainBranch,
        prefix: 'support/',
        upstreamStrategy: 'merge',
        downstreamStrategy: 'merge',
        source: 'structured',
        command: {
          ...defaultCommandConfig('topic'),
          keepBranch: true,
        },
        filters: {},
      },
    ],
  };
}

function parseStructuredBranchEntry(key: string): { readonly branchName: string; readonly property: string } | null {
  const match = /^gitflow\.branch\.([^.]+)\.(.+)$/.exec(key);
  if (!match) {
    return null;
  }

  return {
    branchName: match[1] ?? '',
    property: match[2] ?? '',
  };
}

function applyStructuredBranchProperty(
  current: Partial<FlowBranchDefinition>,
  property: string,
  value: string,
): Partial<FlowBranchDefinition> {
  return {
    ...current,
    kind: property === 'type' ? (value === 'base' ? 'base' : 'topic') : current.kind,
    parent: property === 'parent' ? value : current.parent,
    prefix: property === 'prefix' ? value : current.prefix,
    startPoint: property === 'startpoint' ? value : current.startPoint,
    upstreamStrategy: property === 'upstreamstrategy' ? asStrategy(value, 'merge') : current.upstreamStrategy,
    downstreamStrategy: property === 'downstreamstrategy' ? asStrategy(value, 'merge') : current.downstreamStrategy,
    tag: property === 'tag' ? asBoolean(value) : current.tag,
    tagPrefix: property === 'tagprefix' ? value : current.tagPrefix,
    autoUpdate: property === 'autoupdate' ? asBoolean(value) : current.autoUpdate,
    forceDelete: property === 'forcedelete' ? asBoolean(value) : current.forceDelete,
  };
}

const LEGACY_FLOW_KEYS = [
  'gitflow.branch.master',
  'gitflow.branch.develop',
  'gitflow.prefix.feature',
  'gitflow.prefix.release',
  'gitflow.prefix.hotfix',
  'gitflow.prefix.support',
] as const;

function hasLegacyFlowKeys(config: ReadonlyMap<string, string>): boolean {
  return LEGACY_FLOW_KEYS.some(key => config.has(key));
}

function getStructuredConfigState(config: ReadonlyMap<string, string>): FlowConfigState | null {
  const branches = new Map<string, Partial<FlowBranchDefinition>>();

  for (const [key, value] of config.entries()) {
    const parsed = parseStructuredBranchEntry(key);
    if (!parsed) {
      continue;
    }

    const { branchName, property } = parsed;
    const current = branches.get(branchName) ?? {
      name: branchName,
      source: 'structured' as const,
    };

    branches.set(branchName, applyStructuredBranchProperty(current, property, value));
  }

  if (branches.size === 0) {
    return null;
  }

  const versionTagPrefix =
    getConfigValue(config, 'gitflow.versiontag.prefix') ?? getConfigValue(config, 'gitflow.prefix.versiontag') ?? '';
  const definitions = [...branches.values()]
    .filter((branch): branch is FlowBranchDefinition => branch.kind === 'base' || branch.kind === 'topic')
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    initialized: asBoolean(getConfigValue(config, 'gitflow.initialized')) ?? true,
    version: getConfigValue(config, 'gitflow.version'),
    compatibility: 'structured',
    bases: definitions.filter(branch => branch.kind === 'base'),
    topics: definitions
      .filter((branch): branch is FlowBranchDefinition => branch.kind === 'topic')
      .map(branch => buildTopicDefinition(branch, config, versionTagPrefix)),
    versionTagPrefix,
    config,
  };
}

function getLegacyConfigState(config: ReadonlyMap<string, string>, options: FlowOptions): FlowConfigState | null {
  if (!hasLegacyFlowKeys(config)) {
    return null;
  }

  const mainBranch = options.mainBranch ?? getConfigValue(config, 'gitflow.branch.master') ?? 'main';
  const developBranch = options.developBranch ?? getConfigValue(config, 'gitflow.branch.develop') ?? 'develop';
  const versionTagPrefix = getConfigValue(config, 'gitflow.prefix.versiontag') ?? '';

  const topics: readonly FlowTopicDefinition[] = [
    {
      name: 'feature',
      kind: 'topic',
      parent: developBranch,
      prefix: getConfigValue(config, 'gitflow.prefix.feature') ?? 'feature/',
      upstreamStrategy: 'merge',
      downstreamStrategy: 'rebase',
      source: 'legacy',
      command: defaultCommandConfig('topic'),
      filters: {},
    },
    {
      name: 'release',
      kind: 'topic',
      parent: mainBranch,
      startPoint: developBranch,
      prefix: getConfigValue(config, 'gitflow.prefix.release') ?? 'release/',
      upstreamStrategy: 'merge',
      downstreamStrategy: 'merge',
      tag: true,
      tagPrefix: versionTagPrefix,
      source: 'legacy',
      command: defaultCommandConfig('topic'),
      filters: {},
    },
    {
      name: 'hotfix',
      kind: 'topic',
      parent: mainBranch,
      prefix: getConfigValue(config, 'gitflow.prefix.hotfix') ?? 'hotfix/',
      upstreamStrategy: 'merge',
      downstreamStrategy: 'merge',
      tag: true,
      tagPrefix: versionTagPrefix,
      source: 'legacy',
      command: defaultCommandConfig('topic'),
      filters: {},
    },
    {
      name: 'support',
      kind: 'topic',
      parent: mainBranch,
      prefix: getConfigValue(config, 'gitflow.prefix.support') ?? 'support/',
      upstreamStrategy: 'merge',
      downstreamStrategy: 'merge',
      source: 'legacy',
      command: {
        ...defaultCommandConfig('topic'),
        keepBranch: true,
      },
      filters: {},
    },
  ];

  return {
    initialized: true,
    version: getConfigValue(config, 'gitflow.version'),
    compatibility: 'legacy',
    bases: [
      {
        name: mainBranch,
        kind: 'base',
        upstreamStrategy: 'none',
        downstreamStrategy: 'none',
        source: 'legacy',
      },
      {
        name: developBranch,
        kind: 'base',
        parent: mainBranch,
        upstreamStrategy: 'merge',
        downstreamStrategy: 'merge',
        autoUpdate: true,
        source: 'legacy',
      },
    ],
    topics,
    versionTagPrefix,
    config,
  };
}

async function getFlowConfigState(git: GitClient, options: FlowOptions): Promise<FlowConfigState> {
  const config = await readGitflowConfig(git);
  const structured = getStructuredConfigState(config);
  if (structured) {
    return structured;
  }

  const legacy = getLegacyConfigState(config, options);
  if (legacy) {
    return legacy;
  }

  return {
    initialized: false,
    compatibility: 'unconfigured',
    bases: [],
    topics: [],
    versionTagPrefix: '',
    config,
  };
}

function getScopeArgs(options: FlowOptions): string[] {
  const scope = options.scope ?? 'local';
  if (scope === 'file') {
    if (!options.configFile) {
      throw new Error('configFile is required when scope is "file".');
    }

    return ['--file', options.configFile];
  }

  return [`--${scope}`];
}

async function setConfigValue(git: GitClient, scopeArgs: readonly string[], key: string, value: string): Promise<void> {
  await git.raw(['config', ...scopeArgs, key, value]);
}

async function unsetConfigValue(git: GitClient, scopeArgs: readonly string[], key: string): Promise<void> {
  try {
    await git.raw(['config', ...scopeArgs, '--unset-all', key]);
  } catch {
    // no-op if unset target is absent
  }
}

function truncateText(text: string): string {
  if (text.length <= CHARACTER_LIMIT) {
    return text;
  }

  const omitted = text.length - CHARACTER_LIMIT;
  return `${text.slice(0, CHARACTER_LIMIT)}\n\n... truncated ${omitted} characters. Narrow the request or use JSON output.`;
}

function pushIssue(issues: string[], issue: string): void {
  if (!issues.includes(issue)) {
    issues.push(issue);
  }
}

function inferHealthStatus(issues: readonly string[]): FlowHealthStatus {
  if (issues.some(issue => issue.startsWith('Error:'))) {
    return 'error';
  }
  if (issues.length > 0) {
    return 'warning';
  }
  return 'healthy';
}

function validateTopicDefinitions(
  topics: readonly FlowTopicDefinition[],
  baseNames: ReadonlySet<string>,
  issues: string[],
): void {
  const prefixes = new Map<string, string[]>();

  for (const topic of topics) {
    if (!topic.parent) {
      pushIssue(issues, `Error: topic branch type "${topic.name}" is missing a parent branch.`);
    } else if (!baseNames.has(topic.parent)) {
      pushIssue(issues, `Error: topic branch type "${topic.name}" references missing parent "${topic.parent}".`);
    }

    if (!topic.prefix) {
      pushIssue(issues, `Error: topic branch type "${topic.name}" is missing a prefix.`);
    }

    if (topic.prefix) {
      prefixes.set(topic.prefix, [...(prefixes.get(topic.prefix) ?? []), topic.name]);
    }
  }

  for (const [prefix, owners] of prefixes.entries()) {
    if (owners.length > 1) {
      pushIssue(issues, `Error: prefix "${prefix}" is shared by multiple topic types: ${owners.join(', ')}.`);
    }
  }
}

function validateBaseBranchCycles(bases: readonly FlowBranchDefinition[], issues: string[]): void {
  const parentMap = new Map(bases.map(branch => [branch.name, branch.parent]));
  for (const base of bases) {
    const seen = new Set<string>();
    let cursor = base.parent;
    while (cursor) {
      if (seen.has(cursor) || cursor === base.name) {
        pushIssue(issues, `Error: circular base-branch dependency detected at "${base.name}".`);
        break;
      }
      seen.add(cursor);
      cursor = parentMap.get(cursor);
    }
  }
}

function validateFlowState(state: FlowConfigState): readonly string[] {
  const issues: string[] = [];

  if (!state.initialized) {
    pushIssue(issues, 'Warning: git-flow is not initialized in this repository.');
    return issues;
  }

  const baseNames = new Set(state.bases.map(branch => branch.name));
  if (baseNames.size === 0) {
    pushIssue(issues, 'Error: no base branches are configured.');
  }

  validateTopicDefinitions(state.topics, baseNames, issues);
  validateBaseBranchCycles(state.bases, issues);

  return issues;
}

function renderConfigList(state: FlowConfigState): string {
  if (!state.initialized) {
    return 'git-flow is not initialized.';
  }

  const lines: string[] = [`git-flow configuration (${state.compatibility})`, '', 'Base branches:'];
  for (const base of state.bases) {
    lines.push(
      `- ${base.name}${base.parent ? ` (parent: ${base.parent})` : ''}${base.autoUpdate ? ', auto-update: true' : ''}`,
    );
  }

  lines.push('', 'Topic branch types:');
  for (const topic of state.topics) {
    lines.push(
      `- ${topic.name}: prefix=${topic.prefix ?? '—'}, parent=${topic.parent ?? '—'}, ` +
        `start=${topic.startPoint ?? topic.parent ?? '—'}, strategy=${topic.command.finishStrategy}`,
    );
  }

  return truncateText(lines.join('\n'));
}

function renderOverview(overview: FlowOverview): string {
  const lines: string[] = [
    `git-flow overview (${overview.compatibility})`,
    `Initialized: ${overview.initialized ? 'yes' : 'no'}`,
    `Health: ${overview.health.status}`,
  ];

  if (overview.version) {
    lines.push(`Version: ${overview.version}`);
  }
  if (overview.currentBranch) {
    lines.push(`Current branch: ${overview.currentBranch}`);
  }
  if (overview.ahead !== undefined || overview.behind !== undefined) {
    lines.push(`Tracking: ahead ${overview.ahead ?? 0}, behind ${overview.behind ?? 0}`);
  }

  lines.push('', `Base branches (${overview.bases.length}):`);
  for (const base of overview.bases) {
    lines.push(`- ${base.name}${base.parent ? ` ← ${base.parent}` : ''}`);
  }

  lines.push('', `Topic branch types (${overview.topics.length}):`);
  for (const topic of overview.topics) {
    lines.push(`- ${topic.name}: ${topic.prefix ?? '—'} → ${topic.parent ?? '—'}`);
  }

  lines.push('', `Active topic branches (${overview.activeBranches.length}):`);
  if (overview.activeBranches.length === 0) {
    lines.push('- none');
  } else {
    for (const branch of overview.activeBranches) {
      lines.push(
        `- ${branch.fullName} (${branch.type}${branch.isCurrent ? ', current' : ''}${
          branch.upstream ? `, upstream: ${branch.upstream}` : ''
        }${branch.tracking ? `, tracking: ${branch.tracking}` : ''})`,
      );
    }
  }

  if (overview.health.issues.length > 0) {
    lines.push('', 'Health issues:');
    for (const issue of overview.health.issues) {
      lines.push(`- ${issue}`);
    }
  }

  return truncateText(lines.join('\n'));
}

async function getTrackingInfo(git: GitClient): Promise<readonly FlowActiveBranch[]> {
  try {
    const raw = await git.raw([
      'for-each-ref',
      '--format=%(refname:short)\t%(upstream:short)\t%(upstream:trackshort)',
      'refs/heads',
    ]);

    return raw
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const [fullName, upstream = '', tracking = ''] = line.split('\t');
        return {
          type: '',
          fullName,
          shortName: fullName,
          isCurrent: false,
          upstream: upstream || undefined,
          tracking: tracking || undefined,
        } satisfies FlowActiveBranch;
      });
  } catch {
    return [];
  }
}

async function buildOverview(git: GitClient, state: FlowConfigState): Promise<FlowOverview> {
  const status = await git.status();
  const issues = validateFlowState(state);
  const tracking = await getTrackingInfo(git);

  const activeBranches = tracking
    .map(branch => {
      const topic = state.topics.find(candidate => branch.fullName.startsWith(candidate.prefix ?? ''));
      if (!topic?.prefix) {
        return null;
      }

      return {
        type: topic.name,
        fullName: branch.fullName,
        shortName: branch.fullName.slice(topic.prefix.length),
        isCurrent: branch.fullName === status.current,
        upstream: branch.upstream,
        tracking: branch.tracking,
      } satisfies FlowActiveBranch;
    })
    .filter((branch): branch is NonNullable<typeof branch> => branch !== null);

  return {
    initialized: state.initialized,
    version: state.version,
    compatibility: state.compatibility,
    bases: state.bases,
    topics: state.topics,
    activeBranches,
    currentBranch: status.current || undefined,
    ahead: status.ahead,
    behind: status.behind,
    health: {
      status: inferHealthStatus(issues),
      issues,
    },
  };
}

function normalizeRequest(options: FlowOptions): NormalizedFlowRequest {
  if (options.action) {
    if (options.action === 'init') {
      return { operation: 'init' };
    }
    if (options.action === 'overview') {
      return { operation: 'overview' };
    }
    if (options.action.startsWith('config-')) {
      return {
        operation: 'config',
        configAction: options.action.slice('config-'.length) as FlowConfigAction,
      };
    }
    if (options.action.startsWith('topic-')) {
      return {
        operation: 'topic',
        topicAction: options.action.slice('topic-'.length) as FlowTopicAction,
        topic: options.topic,
      };
    }
    if (options.action.startsWith('control-')) {
      return {
        operation: 'control',
        controlAction: options.action.slice('control-'.length) as FlowControlAction,
      };
    }

    const [topic, topicAction] = options.action.split('-', 2);
    return {
      operation: 'topic',
      topicAction: topicAction as FlowTopicAction,
      topic,
    };
  }

  if (!options.operation) {
    throw new Error('operation is required when action is not provided.');
  }

  return {
    operation: options.operation,
    configAction: options.configAction,
    topicAction: options.topicAction,
    controlAction: options.controlAction,
    topic: options.topic,
  };
}

function getTopicDefinition(state: FlowConfigState, topicName: string | undefined): FlowTopicDefinition {
  if (!topicName) {
    throw new Error('topic is required.');
  }

  const topic = state.topics.find(candidate => candidate.name === topicName);
  if (!topic) {
    throw new Error(`Unknown git-flow topic type: ${topicName}`);
  }

  return topic;
}

async function branchExists(git: GitClient, branchName: string): Promise<boolean> {
  try {
    const summary = await git.branch(['-a']);
    return summary.all.some(branch => branch === branchName || branch.endsWith(`/${branchName}`));
  } catch {
    return false;
  }
}

function selectionFromCurrentBranch(
  currentBranch: string | undefined,
  topic: FlowTopicDefinition,
): FlowTopicSelection | null {
  if (!currentBranch?.startsWith(topic.prefix ?? '')) {
    return null;
  }

  return {
    topic: topic.name,
    fullName: currentBranch,
    shortName: currentBranch.slice((topic.prefix ?? '').length),
  };
}

function filterMatchingTopicCandidates(
  allBranches: readonly string[],
  topic: FlowTopicDefinition,
  requestedName: string,
  matchMode: FlowMatchMode,
): FlowTopicSelection[] {
  const prefix = topic.prefix ?? '';

  return allBranches
    .map(branch => branch.replace(/^remotes\/[^/]+\//, '').trim())
    .filter((branch, index, entries) => entries.indexOf(branch) === index)
    .filter(branch => branch.startsWith(prefix))
    .map(branch => ({
      topic: topic.name,
      fullName: branch,
      shortName: branch.slice(prefix.length),
    }))
    .filter(selection =>
      matchMode === 'exact' ? selection.shortName === requestedName : selection.shortName.startsWith(requestedName),
    );
}

async function resolveTopicBranchSelection(
  git: GitClient,
  state: FlowConfigState,
  topic: FlowTopicDefinition,
  options: FlowOptions,
): Promise<FlowTopicSelection> {
  const matchMode = options.matchMode ?? 'exact';
  const currentStatus = await git.status();
  const currentBranchSelection = selectionFromCurrentBranch(currentStatus.current ?? undefined, topic);

  if (!options.name) {
    if (currentBranchSelection) {
      return currentBranchSelection;
    }

    throw new Error(`name is required for ${topic.name} unless the current branch is already a ${topic.name} branch.`);
  }

  const summary = await git.branch(['-a']);
  const candidates = filterMatchingTopicCandidates(summary.all, topic, options.name, matchMode);

  if (candidates.length === 0) {
    throw new Error(`No ${topic.name} branch matches "${options.name}".`);
  }
  if (candidates.length > 1) {
    throw new Error(
      `Multiple ${topic.name} branches match "${options.name}": ${candidates.map(candidate => candidate.fullName).join(', ')}.`,
    );
  }

  return candidates[0];
}

function globMatches(value: string, pattern: string): boolean {
  const normalizedValue = value.toLocaleLowerCase();
  const normalizedPattern = pattern.toLocaleLowerCase();

  let valueIndex = 0;
  let patternIndex = 0;
  let starIndex = -1;
  let backtrackValueIndex = -1;

  while (valueIndex < normalizedValue.length) {
    const patternChar = normalizedPattern[patternIndex];
    if (patternChar === '?' || patternChar === normalizedValue[valueIndex]) {
      patternIndex += 1;
      valueIndex += 1;
      continue;
    }

    if (patternChar === '*') {
      starIndex = patternIndex;
      backtrackValueIndex = valueIndex;
      patternIndex += 1;
      continue;
    }

    if (starIndex !== -1) {
      patternIndex = starIndex + 1;
      backtrackValueIndex += 1;
      valueIndex = backtrackValueIndex;
      continue;
    }

    return false;
  }

  while (normalizedPattern[patternIndex] === '*') {
    patternIndex += 1;
  }

  return patternIndex === normalizedPattern.length;
}

async function listTopicBranches(
  git: GitClient,
  topic: FlowTopicDefinition,
  pattern?: string,
): Promise<readonly FlowTopicSelection[]> {
  const matcher = pattern ? (candidate: string) => globMatches(candidate, pattern) : null;
  const summary = await git.branch(['-a']);
  const prefix = topic.prefix ?? '';

  return summary.all
    .map(branch => branch.replace(/^remotes\/[^/]+\//, '').trim())
    .filter((branch, index, all) => all.indexOf(branch) === index)
    .filter(branch => branch.startsWith(prefix))
    .map(branch => ({
      topic: topic.name,
      fullName: branch,
      shortName: branch.slice(prefix.length),
    }))
    .filter(branch => (matcher ? matcher(branch.shortName) : true))
    .sort((left, right) => left.shortName.localeCompare(right.shortName));
}

async function getRemotesSafe(git: GitClient): Promise<readonly string[]> {
  try {
    const remotes = await git.getRemotes(true);
    return remotes.map(remote => remote.name);
  } catch {
    return [];
  }
}

async function ensureRemoteExists(git: GitClient, remoteName: string): Promise<void> {
  const remotes = await getRemotesSafe(git);
  if (remotes.length > 0 && !remotes.includes(remoteName)) {
    throw new Error(`Remote does not exist: ${remoteName}`);
  }
}

async function resolveGitDir(repoPath: string, git: GitClient): Promise<string> {
  try {
    const gitDir = await git.raw(['rev-parse', '--git-common-dir']);
    return path.resolve(repoPath, gitDir.trim());
  } catch {
    return path.join(repoPath, '.git');
  }
}

async function resolveHooksDirectory(repoPath: string, git: GitClient, state: FlowConfigState): Promise<string> {
  const configuredHooks = getConfigValue(state.config, 'gitflow.path.hooks');
  if (configuredHooks) {
    return path.resolve(repoPath, configuredHooks);
  }

  const coreHooks = getConfigValue(state.config, 'core.hooksPath');
  if (coreHooks) {
    return path.resolve(repoPath, coreHooks);
  }

  return path.join(await resolveGitDir(repoPath, git), 'hooks');
}

async function runHook(
  repoPath: string,
  git: GitClient,
  state: FlowConfigState,
  phase: FlowHookPhase,
  context: {
    readonly topic: string;
    readonly shortName: string;
    readonly fullName: string;
    readonly parent?: string;
    readonly remote?: string;
    readonly stage?: FlowFinishStage;
  },
): Promise<FlowHookExecutionResult> {
  if (!ALLOW_FLOW_HOOKS) {
    return {
      phase,
      executed: false,
      skippedReason: 'Hook execution disabled. Set GIT_ALLOW_FLOW_HOOKS=true to enable.',
    };
  }

  const hooksDir = await resolveHooksDirectory(repoPath, git, state);
  const candidates = [
    phase,
    `gitflow-${phase}`,
    `git-flow-${phase}`,
    `${context.topic}-${phase}`,
    `gitflow-${context.topic}-${phase}`,
  ].map(candidate => path.join(hooksDir, candidate));
  const hookPath = candidates.find(candidate => isFileSafe(candidate));

  if (!hookPath) {
    return {
      phase,
      executed: false,
      skippedReason: `No hook found in ${hooksDir}.`,
    };
  }

  try {
    const result = await execFileAsync(hookPath, [context.topic, context.shortName, context.fullName], {
      cwd: repoPath,
      env: buildSafeChildEnv({
        GITFLOW_ACTION: phase,
        GITFLOW_TOPIC: context.topic,
        GITFLOW_NAME: context.shortName,
        GITFLOW_BRANCH: context.fullName,
        GITFLOW_PARENT: context.parent ?? '',
        GITFLOW_REMOTE: context.remote ?? '',
        GITFLOW_STAGE: context.stage ?? '',
      }),
    });

    return {
      phase,
      hookPath,
      executed: true,
      exitCode: 0,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error) {
    const gitError = toGitError(error);
    throw new Error(`Hook ${phase} failed: ${gitError.message}`);
  }
}

function splitCommand(command: string): { executable: string; args: string[] } {
  const parts = command.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
  const [executable = '', ...args] = parts.map(part => part.replace(/^"|"$/g, ''));
  return { executable, args };
}

async function runFilterProgram(
  executable: string,
  args: readonly string[],
  repoPath: string,
  input: string,
): Promise<{ stdout: string; stderr: string }> {
  return await new Promise((resolve, reject) => {
    const child = spawn(executable, [...args], {
      cwd: repoPath,
      env: buildSafeChildEnv({
        GITFLOW_FILTER_INPUT: input,
      }),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill('SIGKILL');
      reject(new Error(`Filter timed out after ${FILTER_MAX_RUNTIME_MS}ms.`));
    }, FILTER_MAX_RUNTIME_MS);

    const rejectOnce = (error: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      reject(error);
    };

    const resolveOnce = (result: { stdout: string; stderr: string }): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const appendBounded = (current: string, chunk: string): string => {
      const remaining = FILTER_MAX_OUTPUT_CHARS - current.length;
      if (remaining <= 0) {
        throw new Error(`Filter output exceeded ${FILTER_MAX_OUTPUT_CHARS} characters.`);
      }
      if (chunk.length > remaining) {
        throw new Error(`Filter output exceeded ${FILTER_MAX_OUTPUT_CHARS} characters.`);
      }
      return current + chunk;
    };

    child.stdout.on('data', chunk => {
      try {
        stdout = appendBounded(stdout, chunk.toString());
      } catch (error) {
        child.kill('SIGKILL');
        rejectOnce(error instanceof Error ? error : new Error(String(error)));
      }
    });
    child.stderr.on('data', chunk => {
      try {
        stderr = appendBounded(stderr, chunk.toString());
      } catch (error) {
        child.kill('SIGKILL');
        rejectOnce(error instanceof Error ? error : new Error(String(error)));
      }
    });
    child.on('error', error => {
      rejectOnce(error instanceof Error ? error : new Error(String(error)));
    });
    child.on('close', code => {
      if (settled) {
        return;
      }
      if (code === 0) {
        resolveOnce({ stdout, stderr });
        return;
      }

      rejectOnce(new Error(stderr || `Filter exited with code ${code ?? 'unknown'}.`));
    });

    child.stdin.end(input);
  });
}

async function runFilter(
  repoPath: string,
  kind: FlowFilterKind,
  command: string | undefined,
  input: string,
): Promise<FlowFilterExecutionResult> {
  if (!command) {
    return {
      kind,
      executed: false,
      skippedReason: 'No filter configured.',
      input,
      output: input,
    };
  }

  if (!ALLOW_FLOW_HOOKS) {
    return {
      kind,
      command,
      executed: false,
      skippedReason: 'Hook/filter execution disabled. Set GIT_ALLOW_FLOW_HOOKS=true to enable.',
      input,
      output: input,
    };
  }

  const parsed = splitCommand(command);
  if (!parsed.executable) {
    return {
      kind,
      command,
      executed: false,
      skippedReason: 'Filter command is empty.',
      input,
      output: input,
    };
  }

  try {
    const result = await runFilterProgram(parsed.executable, parsed.args, repoPath, input);

    return {
      kind,
      command,
      executed: true,
      input,
      output: result.stdout.trim() || input,
    };
  } catch (error) {
    const gitError = toGitError(error);
    throw new Error(`Filter ${kind} failed: ${gitError.message}`);
  }
}

function buildFinishStateKey(property: string): string {
  return `${FINISH_STATE_PREFIX}.${property}`;
}

async function writeFinishState(git: GitClient, state: FlowFinishState): Promise<void> {
  const scopeArgs = ['--local'];
  const serializable: Record<string, string> = {
    topic: state.topic,
    shortName: state.shortName,
    branchName: state.branchName,
    originalBranch: state.originalBranch,
    parentBranch: state.parentBranch,
    backmergeBranches: JSON.stringify(state.backmergeBranches),
    stage: state.stage,
    strategy: state.strategy,
    deleteBranch: String(state.deleteBranch),
    keepBranch: String(state.keepBranch),
    pendingBackmergeIndex: String(state.pendingBackmergeIndex),
    publishAfterFinish: String(state.publishAfterFinish),
    filters: JSON.stringify(state.filters),
    tagName: state.tagName ?? '',
    tagMessage: state.tagMessage ?? '',
    remote: state.remote ?? '',
  };

  for (const [property, value] of Object.entries(serializable)) {
    await setConfigValue(git, scopeArgs, buildFinishStateKey(property), value);
  }
}

async function clearFinishState(git: GitClient): Promise<void> {
  for (const property of [
    'topic',
    'shortName',
    'branchName',
    'originalBranch',
    'parentBranch',
    'backmergeBranches',
    'stage',
    'strategy',
    'deleteBranch',
    'keepBranch',
    'pendingBackmergeIndex',
    'publishAfterFinish',
    'filters',
    'tagName',
    'tagMessage',
    'remote',
  ]) {
    await unsetConfigValue(git, ['--local'], buildFinishStateKey(property));
  }
}

async function readFinishState(git: GitClient): Promise<FlowFinishState | null> {
  try {
    const raw = await git.raw(['config', '--get-regexp', `^${FINISH_STATE_PREFIX.replace(/\./g, '\\.')}\\.`]);
    const entries = new Map(
      raw
        .split(/\r?\n/)
        .map(splitConfigLine)
        .filter((entry): entry is [string, string] => entry !== null),
    );

    const stage = getConfigValue(entries, buildFinishStateKey('stage')) as FlowFinishStage | undefined;
    if (!stage || !CONTROL_STAGES.has(stage)) {
      return null;
    }

    return {
      topic: getConfigValue(entries, buildFinishStateKey('topic')) ?? '',
      shortName: getConfigValue(entries, buildFinishStateKey('shortName')) ?? '',
      branchName: getConfigValue(entries, buildFinishStateKey('branchName')) ?? '',
      originalBranch: getConfigValue(entries, buildFinishStateKey('originalBranch')) ?? '',
      parentBranch: getConfigValue(entries, buildFinishStateKey('parentBranch')) ?? '',
      backmergeBranches: JSON.parse(
        getConfigValue(entries, buildFinishStateKey('backmergeBranches')) ?? '[]',
      ) as readonly string[],
      stage,
      strategy: asStrategy(getConfigValue(entries, buildFinishStateKey('strategy')), 'merge'),
      deleteBranch: asBoolean(getConfigValue(entries, buildFinishStateKey('deleteBranch'))) ?? true,
      keepBranch: asBoolean(getConfigValue(entries, buildFinishStateKey('keepBranch'))) ?? false,
      filters: JSON.parse(
        getConfigValue(entries, buildFinishStateKey('filters')) ?? '[]',
      ) as readonly FlowFilterExecutionResult[],
      tagName: getConfigValue(entries, buildFinishStateKey('tagName')) || undefined,
      tagMessage: getConfigValue(entries, buildFinishStateKey('tagMessage')) || undefined,
      remote: getConfigValue(entries, buildFinishStateKey('remote')) || undefined,
      pendingBackmergeIndex: Number(getConfigValue(entries, buildFinishStateKey('pendingBackmergeIndex')) ?? '0'),
      publishAfterFinish: asBoolean(getConfigValue(entries, buildFinishStateKey('publishAfterFinish'))) ?? false,
    };
  } catch {
    return null;
  }
}

async function getCurrentBranch(git: GitClient): Promise<string> {
  const status = await git.status();
  return status.current || 'HEAD';
}

async function checkoutRefIfNeeded(git: GitClient, ref: string): Promise<void> {
  const currentBranch = await getCurrentBranch(git);
  if (currentBranch !== ref) {
    await git.checkout(ref);
  }
}

async function performIntegration(
  git: GitClient,
  targetBranch: string,
  sourceBranch: string,
  strategy: FlowMergeStrategy,
  ff: boolean,
  preserveMerges: boolean,
): Promise<void> {
  if (strategy === 'none') {
    return;
  }

  if (strategy === 'merge') {
    const mergeArgs = ['merge'];
    if (ff) {
      mergeArgs.push('--ff');
    } else {
      mergeArgs.push('--no-ff');
    }
    mergeArgs.push(sourceBranch, '-m', `Merge branch '${sourceBranch}' into ${targetBranch}`);
    await git.raw(mergeArgs);
    return;
  }

  if (strategy === 'squash') {
    await git.raw(['merge', '--squash', sourceBranch]);
    await git.commit(`Squash merge '${sourceBranch}' into ${targetBranch}`);
    return;
  }

  const rebaseArgs = ['rebase'];
  if (preserveMerges) {
    rebaseArgs.push('--rebase-merges');
  }
  rebaseArgs.push(targetBranch);
  await git.checkout(sourceBranch);
  await git.raw(rebaseArgs);
  await git.checkout(targetBranch);
  await git.raw(['merge', '--ff-only', sourceBranch]);
}

async function maybeFetchRemote(git: GitClient, remote: string | undefined, enabled: boolean): Promise<void> {
  if (!enabled || !remote) {
    return;
  }

  const remotes = await getRemotesSafe(git);
  if (remotes.length > 0 && remotes.includes(remote)) {
    await git.fetch(remote);
  }
}

function getBackmergeBranches(state: FlowConfigState, topic: FlowTopicDefinition): readonly string[] {
  const mainBase = state.bases.find(branch => branch.name === topic.parent);
  const developBase = state.bases.find(
    branch => branch.name !== topic.parent && branch.name.toLowerCase().includes('develop'),
  );

  if (topic.startPoint && topic.startPoint !== topic.parent) {
    return [topic.startPoint];
  }

  if (topic.name === 'hotfix' && mainBase && developBase) {
    return [developBase.name];
  }

  if (topic.name === 'release' && developBase) {
    return [developBase.name];
  }

  return [];
}

async function startTopic(
  repoPath: string,
  git: GitClient,
  state: FlowConfigState,
  topic: FlowTopicDefinition,
  options: FlowOptions,
): Promise<FlowActionResult> {
  if (!options.name) {
    throw new Error('name is required for topic start.');
  }

  const fullName = `${topic.prefix ?? ''}${options.name}`;
  const startPoint = options.baseRef ?? topic.startPoint ?? topic.parent;
  if (!startPoint) {
    throw new Error(`Topic type "${topic.name}" does not define a start point or parent.`);
  }

  const hooks = [
    await runHook(repoPath, git, state, 'pre-start', {
      topic: topic.name,
      shortName: options.name,
      fullName,
      parent: topic.parent,
      remote: options.remote,
    }),
  ];
  await git.checkoutBranch(fullName, startPoint);
  hooks.push(
    await runHook(repoPath, git, state, 'post-start', {
      topic: topic.name,
      shortName: options.name,
      fullName,
      parent: topic.parent,
      remote: options.remote,
    }),
  );

  return {
    markdown: [
      `Created and switched to branch ${fullName} from ${startPoint}.`,
      ...hooks.filter(h => h.executed).map(h => `Hook: ${h.phase}`),
    ].join('\n'),
    data: {
      topic: topic.name,
      branch: fullName,
      startPoint,
      hooks,
    },
  };
}

async function listTopic(git: GitClient, topic: FlowTopicDefinition, options: FlowOptions): Promise<FlowActionResult> {
  const branches = await listTopicBranches(git, topic, options.pattern);
  const markdown =
    branches.length > 0
      ? branches.map(branch => branch.fullName).join('\n')
      : `No ${topic.name} branches found${options.pattern ? ` matching ${options.pattern}` : ''}.`;

  return {
    markdown: truncateText(markdown),
    data: {
      topic: topic.name,
      branches,
      pattern: options.pattern ?? null,
    },
  };
}

async function publishTopic(
  repoPath: string,
  git: GitClient,
  state: FlowConfigState,
  topic: FlowTopicDefinition,
  options: FlowOptions,
): Promise<FlowActionResult> {
  const selection = options.name
    ? {
        topic: topic.name,
        fullName: `${topic.prefix ?? ''}${options.name}`,
        shortName: options.name,
      }
    : await resolveTopicBranchSelection(git, state, topic, options);
  const remote = options.remote ?? DEFAULT_REMOTE;
  await ensureRemoteExists(git, remote);
  const hooks = [
    await runHook(repoPath, git, state, 'pre-publish', {
      topic: topic.name,
      shortName: selection.shortName,
      fullName: selection.fullName,
      parent: topic.parent,
      remote,
    }),
  ];
  await git.push(remote, selection.fullName, ['--set-upstream']);
  hooks.push(
    await runHook(repoPath, git, state, 'post-publish', {
      topic: topic.name,
      shortName: selection.shortName,
      fullName: selection.fullName,
      parent: topic.parent,
      remote,
    }),
  );

  return {
    markdown: `Published ${selection.fullName} to ${remote}.`,
    data: {
      topic: topic.name,
      branch: selection.fullName,
      remote,
      hooks,
    },
  };
}

async function checkoutTopic(
  git: GitClient,
  state: FlowConfigState,
  topic: FlowTopicDefinition,
  options: FlowOptions,
): Promise<FlowActionResult> {
  const selection = await resolveTopicBranchSelection(git, state, topic, options);
  await git.checkout(selection.fullName);
  return {
    markdown: `Checked out ${selection.fullName}.`,
    data: selection,
  };
}

async function trackTopic(
  repoPath: string,
  git: GitClient,
  state: FlowConfigState,
  topic: FlowTopicDefinition,
  options: FlowOptions,
): Promise<FlowActionResult> {
  if (!options.name) {
    throw new Error('name is required for topic track.');
  }

  const remote = options.remote ?? DEFAULT_REMOTE;
  await ensureRemoteExists(git, remote);
  const branchName = `${topic.prefix ?? ''}${options.name}`;
  const remoteRef = `${remote}/${branchName}`;
  const hooks = [
    await runHook(repoPath, git, state, 'pre-track', {
      topic: topic.name,
      shortName: options.name,
      fullName: branchName,
      parent: topic.parent,
      remote,
    }),
  ];
  await git.raw(['checkout', '--track', remoteRef]);
  hooks.push(
    await runHook(repoPath, git, state, 'post-track', {
      topic: topic.name,
      shortName: options.name,
      fullName: branchName,
      parent: topic.parent,
      remote,
    }),
  );

  return {
    markdown: `Tracking ${remoteRef}.`,
    data: {
      topic: topic.name,
      branch: branchName,
      remote,
      hooks,
    },
  };
}

async function renameTopic(
  git: GitClient,
  state: FlowConfigState,
  topic: FlowTopicDefinition,
  options: FlowOptions,
): Promise<FlowActionResult> {
  if (!options.newName) {
    throw new Error('newName is required for topic rename.');
  }

  const selection = await resolveTopicBranchSelection(git, state, topic, options);
  const renamedBranch = `${topic.prefix ?? ''}${options.newName}`;
  await git.raw(['branch', '-m', selection.fullName, renamedBranch]);

  return {
    markdown: `Renamed ${selection.fullName} to ${renamedBranch}.`,
    data: {
      topic: topic.name,
      previousName: selection.fullName,
      branch: renamedBranch,
    },
  };
}

async function deleteTopic(
  repoPath: string,
  git: GitClient,
  state: FlowConfigState,
  topic: FlowTopicDefinition,
  options: FlowOptions,
): Promise<FlowActionResult> {
  const selection = await resolveTopicBranchSelection(git, state, topic, options);
  const remote = options.remote;
  const hooks = [
    await runHook(repoPath, git, state, 'pre-delete', {
      topic: topic.name,
      shortName: selection.shortName,
      fullName: selection.fullName,
      parent: topic.parent,
      remote,
    }),
  ];
  await git.deleteLocalBranch(selection.fullName, options.forceDelete ?? topic.forceDelete ?? false);

  if (remote) {
    await ensureRemoteExists(git, remote);
    await git.push(remote, selection.fullName, ['--delete']);
  }

  hooks.push(
    await runHook(repoPath, git, state, 'post-delete', {
      topic: topic.name,
      shortName: selection.shortName,
      fullName: selection.fullName,
      parent: topic.parent,
      remote,
    }),
  );

  return {
    markdown: remote ? `Deleted ${selection.fullName} locally and from ${remote}.` : `Deleted ${selection.fullName}.`,
    data: {
      topic: topic.name,
      branch: selection.fullName,
      remote: remote ?? null,
      hooks,
    },
  };
}

async function updateTopic(
  repoPath: string,
  git: GitClient,
  state: FlowConfigState,
  topic: FlowTopicDefinition,
  options: FlowOptions,
): Promise<FlowActionResult> {
  const selection = await resolveTopicBranchSelection(git, state, topic, options);
  const originalBranch = await getCurrentBranch(git);
  const parent = topic.parent;
  if (!parent) {
    throw new Error(`Topic type "${topic.name}" does not define a parent branch.`);
  }

  const hooks = [
    await runHook(repoPath, git, state, 'pre-update', {
      topic: topic.name,
      shortName: selection.shortName,
      fullName: selection.fullName,
      parent,
      remote: options.remote,
    }),
  ];
  await git.checkout(selection.fullName);
  const strategy = options.strategy ?? topic.downstreamStrategy ?? 'merge';
  if (strategy === 'rebase') {
    await git.raw(['rebase', parent]);
  } else if (strategy === 'squash') {
    await git.raw(['merge', '--squash', parent]);
    await git.commit(`Update ${selection.fullName} from ${parent}`);
  } else if (strategy === 'merge') {
    await git.raw(['merge', '--no-ff', parent, '-m', `Merge '${parent}' into ${selection.fullName}`]);
  }

  if (originalBranch !== selection.fullName) {
    await git.checkout(originalBranch);
  }
  hooks.push(
    await runHook(repoPath, git, state, 'post-update', {
      topic: topic.name,
      shortName: selection.shortName,
      fullName: selection.fullName,
      parent,
      remote: options.remote,
    }),
  );

  return {
    markdown: `Updated ${selection.fullName} from ${parent} using ${strategy}.`,
    data: {
      topic: topic.name,
      branch: selection.fullName,
      parent,
      strategy,
      hooks,
    },
  };
}

async function writeBaseConfig(
  git: GitClient,
  scopeArgs: readonly string[],
  base: FlowBranchDefinition,
): Promise<void> {
  await setConfigValue(git, scopeArgs, `gitflow.branch.${base.name}.type`, 'base');
  if (base.parent) {
    await setConfigValue(git, scopeArgs, `gitflow.branch.${base.name}.parent`, base.parent);
  }
  if (base.upstreamStrategy) {
    await setConfigValue(git, scopeArgs, `gitflow.branch.${base.name}.upstreamstrategy`, base.upstreamStrategy);
  }
  if (base.downstreamStrategy) {
    await setConfigValue(git, scopeArgs, `gitflow.branch.${base.name}.downstreamstrategy`, base.downstreamStrategy);
  }
  if (base.autoUpdate !== undefined) {
    await setConfigValue(git, scopeArgs, `gitflow.branch.${base.name}.autoupdate`, String(base.autoUpdate));
  }
}

async function writeTopicConfig(
  git: GitClient,
  scopeArgs: readonly string[],
  topic: FlowTopicDefinition,
): Promise<void> {
  await setConfigValue(git, scopeArgs, `gitflow.branch.${topic.name}.type`, 'topic');
  if (topic.parent) {
    await setConfigValue(git, scopeArgs, `gitflow.branch.${topic.name}.parent`, topic.parent);
  }
  if (topic.prefix) {
    await setConfigValue(git, scopeArgs, `gitflow.branch.${topic.name}.prefix`, topic.prefix);
  }
  if (topic.startPoint) {
    await setConfigValue(git, scopeArgs, `gitflow.branch.${topic.name}.startpoint`, topic.startPoint);
  }
  if (topic.upstreamStrategy) {
    await setConfigValue(git, scopeArgs, `gitflow.branch.${topic.name}.upstreamstrategy`, topic.upstreamStrategy);
  }
  if (topic.downstreamStrategy) {
    await setConfigValue(git, scopeArgs, `gitflow.branch.${topic.name}.downstreamstrategy`, topic.downstreamStrategy);
  }
  if (topic.tag !== undefined) {
    await setConfigValue(git, scopeArgs, `gitflow.branch.${topic.name}.tag`, String(topic.tag));
  }
  if (topic.tagPrefix) {
    await setConfigValue(git, scopeArgs, `gitflow.branch.${topic.name}.tagprefix`, topic.tagPrefix);
  }
  await setConfigValue(git, scopeArgs, `gitflow.${topic.name}.finish.strategy`, topic.command.finishStrategy);
  await setConfigValue(git, scopeArgs, `gitflow.${topic.name}.finish.fetch`, String(topic.command.fetchBeforeFinish));
  await setConfigValue(git, scopeArgs, `gitflow.${topic.name}.finish.keep`, String(topic.command.keepBranch));
  await setConfigValue(
    git,
    scopeArgs,
    `gitflow.${topic.name}.finish.publish`,
    String(topic.command.publishAfterFinish),
  );
}

async function createMissingBaseBranches(git: GitClient, bases: readonly FlowBranchDefinition[]): Promise<string[]> {
  const createdBranches: string[] = [];
  for (const base of bases) {
    if (await branchExists(git, base.name)) {
      continue;
    }
    if (base.parent) {
      await git.raw(['branch', base.name, base.parent]);
    } else {
      await git.raw(['branch', base.name]);
    }
    createdBranches.push(base.name);
  }
  return createdBranches;
}

async function initializeFlow(git: GitClient, options: FlowOptions): Promise<FlowActionResult> {
  const state = await getFlowConfigState(git, options);
  if (state.initialized && !options.force) {
    throw new Error('git-flow is already initialized. Use force=true to rewrite the configuration.');
  }

  const scopeArgs = getScopeArgs(options);
  const preset = getPresetDefinition(options);

  await setConfigValue(git, scopeArgs, 'gitflow.version', '1.0');
  await setConfigValue(git, scopeArgs, 'gitflow.initialized', 'true');
  await setConfigValue(git, scopeArgs, 'gitflow.versiontag.prefix', preset.versionTagPrefix);

  for (const base of preset.bases) {
    await writeBaseConfig(git, scopeArgs, base);
  }

  for (const topic of preset.topics) {
    await writeTopicConfig(git, scopeArgs, topic);
  }

  const createdBranches = options.noCreateBranches ? [] : await createMissingBaseBranches(git, preset.bases);

  const updatedState = await getFlowConfigState(git, options);
  const lines = [
    `Initialized git-flow-next preset "${options.preset ?? 'classic'}".`,
    `Configured ${updatedState.bases.length} base branch(es) and ${updatedState.topics.length} topic type(s).`,
  ];
  if (createdBranches.length > 0) {
    lines.push(`Created branches: ${createdBranches.join(', ')}`);
  }
  if (options.noCreateBranches) {
    lines.push('Skipped branch creation because noCreateBranches=true.');
  }

  return {
    markdown: lines.join('\n'),
    data: {
      preset: options.preset ?? 'classic',
      bases: updatedState.bases,
      topics: updatedState.topics,
      createdBranches,
    },
  };
}

function makeBranchDefinition(
  state: FlowConfigState,
  options: FlowOptions,
  existing?: FlowBranchDefinition,
): FlowBranchDefinition {
  const name = options.name ?? existing?.name;
  const kind = options.branchKind ?? existing?.kind;
  if (!name || !kind) {
    throw new Error('name and branchKind are required for flow config mutations.');
  }

  return {
    name,
    kind,
    parent: options.parent ?? existing?.parent,
    prefix: options.prefix ?? existing?.prefix,
    startPoint: options.startPoint ?? existing?.startPoint,
    upstreamStrategy: options.upstreamStrategy ?? existing?.upstreamStrategy,
    downstreamStrategy: options.downstreamStrategy ?? existing?.downstreamStrategy,
    tag: options.tag ?? existing?.tag,
    tagPrefix: options.tagPrefix ?? existing?.tagPrefix ?? state.versionTagPrefix,
    autoUpdate: options.autoUpdate ?? existing?.autoUpdate,
    forceDelete: options.forceDelete ?? existing?.forceDelete,
    source: 'structured',
  };
}

async function writeBranchDefinition(
  git: GitClient,
  options: FlowOptions,
  branch: FlowBranchDefinition,
  existingName?: string,
): Promise<void> {
  const scopeArgs = getScopeArgs(options);
  const namespace = existingName ?? branch.name;

  for (const property of FLOW_CONFIG_PROPERTIES) {
    await unsetConfigValue(git, scopeArgs, `gitflow.branch.${namespace}.${property}`);
  }

  if (existingName && existingName !== branch.name) {
    for (const property of FLOW_CONFIG_PROPERTIES) {
      await unsetConfigValue(git, scopeArgs, `gitflow.branch.${existingName}.${property}`);
    }
  }

  await setConfigValue(git, scopeArgs, `gitflow.branch.${branch.name}.type`, branch.kind);
  if (branch.parent) {
    await setConfigValue(git, scopeArgs, `gitflow.branch.${branch.name}.parent`, branch.parent);
  }
  if (branch.prefix) {
    await setConfigValue(git, scopeArgs, `gitflow.branch.${branch.name}.prefix`, branch.prefix);
  }
  if (branch.startPoint) {
    await setConfigValue(git, scopeArgs, `gitflow.branch.${branch.name}.startpoint`, branch.startPoint);
  }
  if (branch.upstreamStrategy) {
    await setConfigValue(git, scopeArgs, `gitflow.branch.${branch.name}.upstreamstrategy`, branch.upstreamStrategy);
  }
  if (branch.downstreamStrategy) {
    await setConfigValue(git, scopeArgs, `gitflow.branch.${branch.name}.downstreamstrategy`, branch.downstreamStrategy);
  }
  if (branch.tag !== undefined) {
    await setConfigValue(git, scopeArgs, `gitflow.branch.${branch.name}.tag`, String(branch.tag));
  }
  if (branch.tagPrefix) {
    await setConfigValue(git, scopeArgs, `gitflow.branch.${branch.name}.tagprefix`, branch.tagPrefix);
  }
  if (branch.autoUpdate !== undefined) {
    await setConfigValue(git, scopeArgs, `gitflow.branch.${branch.name}.autoupdate`, String(branch.autoUpdate));
  }
  if (branch.forceDelete !== undefined) {
    await setConfigValue(git, scopeArgs, `gitflow.branch.${branch.name}.forcedelete`, String(branch.forceDelete));
  }

  const finishPrefix = `gitflow.${branch.name}.finish`;
  const filterPrefix = `gitflow.${branch.name}.filter`;
  if (options.strategy) {
    await setConfigValue(git, scopeArgs, `${finishPrefix}.strategy`, options.strategy);
  }
  if (options.fetch !== undefined) {
    await setConfigValue(git, scopeArgs, `${finishPrefix}.fetch`, String(options.fetch));
  }
  if (options.keepBranch !== undefined) {
    await setConfigValue(git, scopeArgs, `${finishPrefix}.keep`, String(options.keepBranch));
  }
  if (options.publish !== undefined) {
    await setConfigValue(git, scopeArgs, `${finishPrefix}.publish`, String(options.publish));
  }
  if (options.rebaseBeforeFinish !== undefined) {
    await setConfigValue(git, scopeArgs, `${finishPrefix}.rebaseBeforeFinish`, String(options.rebaseBeforeFinish));
  }
  if (options.preserveMerges !== undefined) {
    await setConfigValue(git, scopeArgs, `${finishPrefix}.preserveMerges`, String(options.preserveMerges));
  }
  if (options.ff !== undefined) {
    await setConfigValue(git, scopeArgs, `${finishPrefix}.ff`, String(options.ff));
  }
  if (options.tagMessage) {
    await setConfigValue(git, scopeArgs, `${filterPrefix}.tagMessage`, options.tagMessage);
  }
}

async function updateDependentBranchReferences(
  git: GitClient,
  options: FlowOptions,
  allBranches: readonly FlowBranchDefinition[],
  previousName: string,
  nextName: string,
): Promise<void> {
  for (const dependent of allBranches.filter(
    branch => branch.parent === previousName || branch.startPoint === previousName,
  )) {
    const updatedDependent: FlowBranchDefinition = {
      ...dependent,
      parent: dependent.parent === previousName ? nextName : dependent.parent,
      startPoint: dependent.startPoint === previousName ? nextName : dependent.startPoint,
    };
    await writeBranchDefinition(git, options, updatedDependent);
  }
}

async function deleteBranchDefinitionConfig(git: GitClient, options: FlowOptions, branchName: string): Promise<void> {
  const scopeArgs = getScopeArgs(options);
  for (const property of FLOW_CONFIG_PROPERTIES) {
    await unsetConfigValue(git, scopeArgs, `gitflow.branch.${branchName}.${property}`);
  }
  for (const property of FLOW_FINISH_PROPERTIES) {
    await unsetConfigValue(git, scopeArgs, `gitflow.${branchName}.finish.${property}`);
  }
  for (const property of FLOW_FILTER_PROPERTIES) {
    await unsetConfigValue(git, scopeArgs, `gitflow.${branchName}.filter.${property}`);
  }
}

async function mutateConfig(
  git: GitClient,
  state: FlowConfigState,
  options: FlowOptions,
  action: FlowConfigAction,
): Promise<FlowActionResult> {
  if (action === 'list') {
    return {
      markdown: renderConfigList(state),
      data: state,
    };
  }

  const allBranches = [...state.bases, ...state.topics];
  const existing = allBranches.find(branch => branch.name === options.name);

  if (action === 'add') {
    if (existing) {
      throw new Error(`Flow branch type already exists: ${options.name}`);
    }
    const branch = makeBranchDefinition(state, options);
    await writeBranchDefinition(git, options, branch);
    return {
      markdown: `Added flow ${branch.kind} branch definition ${branch.name}.`,
      data: {
        action,
        branch,
      } satisfies FlowConfigMutationResult,
    };
  }

  if (!existing) {
    throw new Error(`Unknown flow branch definition: ${options.name}`);
  }

  if (action === 'update') {
    const branch = makeBranchDefinition(state, options, existing);
    await writeBranchDefinition(git, options, branch);
    return {
      markdown: `Updated flow ${branch.kind} branch definition ${branch.name}.`,
      data: {
        action,
        branch,
      } satisfies FlowConfigMutationResult,
    };
  }

  if (action === 'rename') {
    if (!options.newName) {
      throw new Error('newName is required for config rename.');
    }
    const renamed = makeBranchDefinition(state, { ...options, name: options.newName }, existing);
    await writeBranchDefinition(git, options, renamed, existing.name);
    await updateDependentBranchReferences(git, options, allBranches, existing.name, renamed.name);

    return {
      markdown: `Renamed flow branch definition ${existing.name} to ${renamed.name}.`,
      data: {
        action,
        branch: renamed,
        previousName: existing.name,
      } satisfies FlowConfigMutationResult,
    };
  }
  await deleteBranchDefinitionConfig(git, options, existing.name);

  return {
    markdown: `Deleted flow branch definition ${existing.name}.`,
    data: {
      action,
      branch: existing,
    } satisfies FlowConfigMutationResult,
  };
}

async function prepareFinishState(
  repoPath: string,
  git: GitClient,
  state: FlowConfigState,
  topic: FlowTopicDefinition,
  selection: FlowTopicSelection,
  options: FlowOptions,
): Promise<FlowFinishState> {
  const originalBranch = await getCurrentBranch(git);
  const parentBranch = topic.parent;
  if (!parentBranch) {
    throw new Error(`Topic type "${topic.name}" does not define a parent branch.`);
  }

  const strategy = options.strategy ?? topic.command.finishStrategy;
  const keepBranch = options.keepBranch ?? topic.command.keepBranch;
  const backmergeBranches = options.noBackmerge ? [] : getBackmergeBranches(state, topic);
  let tagName =
    options.tag === false
      ? undefined
      : topic.tag
        ? `${topic.tagPrefix ?? state.versionTagPrefix}${selection.shortName}`
        : undefined;
  let tagMessage = options.tagMessage;
  const filters: FlowFilterExecutionResult[] = [];

  if (topic.filters.version) {
    const filtered = await runFilter(repoPath, 'version', topic.filters.version, selection.shortName);
    filters.push(filtered);
    if (tagName) {
      tagName = `${topic.tagPrefix ?? state.versionTagPrefix}${filtered.output}`;
    }
  }
  if (topic.filters.tagMessage && tagMessage) {
    const filtered = await runFilter(repoPath, 'tag_message', topic.filters.tagMessage, tagMessage);
    filters.push(filtered);
    tagMessage = filtered.output;
  }

  return {
    topic: topic.name,
    shortName: selection.shortName,
    branchName: selection.fullName,
    originalBranch,
    parentBranch,
    backmergeBranches,
    stage: 'prepare',
    strategy,
    deleteBranch: options.deleteBranch ?? !keepBranch,
    keepBranch,
    filters,
    tagName,
    tagMessage,
    remote: options.remote,
    pendingBackmergeIndex: 0,
    publishAfterFinish: options.publishAfterFinish ?? options.publish ?? topic.command.publishAfterFinish,
  };
}

async function executeFinishStages(
  repoPath: string,
  git: GitClient,
  state: FlowConfigState,
  topicDefinition: FlowTopicDefinition,
  finishState: FlowFinishState,
  options: FlowOptions,
): Promise<FlowFinishResult> {
  const hooks: FlowHookExecutionResult[] = [];
  const filters: FlowFilterExecutionResult[] = [...finishState.filters];
  let current = finishState;

  if (current.stage === 'prepare') {
    if (options.fetch ?? topicDefinition.command.fetchBeforeFinish) {
      await maybeFetchRemote(git, current.remote, true);
    }
    if (options.rebaseBeforeFinish ?? topicDefinition.command.rebaseBeforeFinish) {
      await git.checkout(current.branchName);
      const rebaseArgs = ['rebase'];
      if (options.preserveMerges ?? topicDefinition.command.preserveMerges) {
        rebaseArgs.push('--rebase-merges');
      }
      rebaseArgs.push(current.parentBranch);
      await git.raw(rebaseArgs);
    }
    current = { ...current, stage: 'hook-pre-finish' };
    await writeFinishState(git, current);
  }

  if (current.stage === 'hook-pre-finish') {
    hooks.push(
      await runHook(repoPath, git, state, 'pre-finish', {
        topic: current.topic,
        shortName: current.shortName,
        fullName: current.branchName,
        parent: current.parentBranch,
        remote: current.remote,
        stage: current.stage,
      }),
    );
    current = { ...current, stage: 'checkout-parent' };
    await writeFinishState(git, current);
  }

  if (current.stage === 'checkout-parent') {
    await checkoutRefIfNeeded(git, current.parentBranch);
    current = { ...current, stage: 'integrate-parent' };
    await writeFinishState(git, current);
  }

  if (current.stage === 'integrate-parent') {
    try {
      await performIntegration(
        git,
        current.parentBranch,
        current.branchName,
        current.strategy,
        options.ff ?? topicDefinition.command.ff,
        options.preserveMerges ?? topicDefinition.command.preserveMerges,
      );
    } catch {
      await writeFinishState(git, current);
      return buildPausedFinishResult(current, hooks, filters, []);
    }
    current = { ...current, stage: 'tag' };
    await writeFinishState(git, current);
  }

  if (current.stage === 'tag') {
    if (current.tagName) {
      await git.addAnnotatedTag(current.tagName, current.tagMessage ?? `Release ${current.shortName}`);
    }
    current = { ...current, stage: 'hook-post-parent' };
    await writeFinishState(git, current);
  }

  if (current.stage === 'hook-post-parent') {
    current = {
      ...current,
      stage: current.backmergeBranches.length > 0 ? 'checkout-backmerge' : 'hook-post-finish',
    };
    await writeFinishState(git, current);
  }

  const backmergeResult = await processBackmergeStages(git, topicDefinition, options, current, hooks, filters);
  if (backmergeResult.paused) {
    return backmergeResult.result;
  }
  current = backmergeResult.state;

  if (current.stage === 'hook-post-finish') {
    hooks.push(
      await runHook(repoPath, git, state, 'post-finish', {
        topic: current.topic,
        shortName: current.shortName,
        fullName: current.branchName,
        parent: current.parentBranch,
        remote: current.remote,
        stage: current.stage,
      }),
    );

    current = { ...current, stage: 'publish' };
    await writeFinishState(git, current);
  }

  if (current.stage === 'publish') {
    if (current.publishAfterFinish && current.remote) {
      await ensureRemoteExists(git, current.remote);
      await git.push(current.remote, current.parentBranch);
      for (const branch of current.backmergeBranches) {
        await git.push(current.remote, branch);
      }
      if (current.tagName) {
        await git.pushTags(current.remote);
      }
    }
    current = { ...current, stage: 'cleanup' };
    await writeFinishState(git, current);
  }

  if (current.stage === 'cleanup') {
    if (!current.keepBranch && current.deleteBranch) {
      await git.deleteLocalBranch(current.branchName);
    }
    await checkoutRefIfNeeded(git, current.originalBranch);
    await clearFinishState(git);
  }

  return {
    completed: true,
    mergedInto: [current.parentBranch, ...current.backmergeBranches],
    deleted: !current.keepBranch && current.deleteBranch,
    tagName: current.tagName,
    hooks,
    filters,
  } satisfies FlowFinishResult;
}

function buildPausedFinishResult(
  current: FlowFinishState,
  hooks: readonly FlowHookExecutionResult[],
  filters: readonly FlowFilterExecutionResult[],
  mergedInto: readonly string[],
): FlowFinishResult {
  return {
    completed: false,
    state: current,
    mergedInto,
    deleted: false,
    tagName: current.tagName,
    hooks,
    filters,
  } satisfies FlowFinishResult;
}

async function processBackmergeStages(
  git: GitClient,
  topicDefinition: FlowTopicDefinition,
  options: FlowOptions,
  initialState: FlowFinishState,
  hooks: readonly FlowHookExecutionResult[],
  filters: readonly FlowFilterExecutionResult[],
): Promise<{ paused: false; state: FlowFinishState } | { paused: true; result: FlowFinishResult }> {
  let current = initialState;

  while (current.stage === 'checkout-backmerge' || current.stage === 'integrate-backmerge') {
    const target = current.backmergeBranches[current.pendingBackmergeIndex];
    if (!target) {
      current = { ...current, stage: 'publish' };
      await writeFinishState(git, current);
      break;
    }

    if (current.stage === 'checkout-backmerge') {
      await checkoutRefIfNeeded(git, target);
      current = { ...current, stage: 'integrate-backmerge' };
      await writeFinishState(git, current);
    }

    try {
      await performIntegration(
        git,
        target,
        current.branchName,
        'merge',
        false,
        options.preserveMerges ?? topicDefinition.command.preserveMerges,
      );
    } catch {
      await writeFinishState(git, current);
      return {
        paused: true,
        result: buildPausedFinishResult(current, hooks, filters, [
          current.parentBranch,
          ...current.backmergeBranches.slice(0, current.pendingBackmergeIndex),
        ]),
      };
    }

    current = {
      ...current,
      pendingBackmergeIndex: current.pendingBackmergeIndex + 1,
      stage:
        current.pendingBackmergeIndex + 1 < current.backmergeBranches.length
          ? 'checkout-backmerge'
          : 'hook-post-finish',
    };
    await writeFinishState(git, current);
  }

  return { paused: false, state: current };
}

async function finishTopic(
  repoPath: string,
  git: GitClient,
  state: FlowConfigState,
  topic: FlowTopicDefinition,
  options: FlowOptions,
): Promise<FlowActionResult> {
  const selection = await resolveTopicBranchSelection(git, state, topic, options);
  const finishState = await prepareFinishState(repoPath, git, state, topic, selection, options);
  await writeFinishState(git, finishState);
  const result = await executeFinishStages(repoPath, git, state, topic, finishState, options);

  if (!result.completed) {
    return {
      markdown:
        `Finish paused for ${selection.fullName} at stage ${result.state?.stage}. ` +
        'Resolve conflicts, then use control/continue or action="control-continue".',
      data: result,
    };
  }

  return {
    markdown: [
      `Finished ${selection.fullName}.`,
      `Merged into: ${result.mergedInto.join(', ') || 'none'}`,
      ...(result.tagName ? [`Tag: ${result.tagName}`] : []),
      ...(result.deleted ? [`Deleted ${selection.fullName}.`] : []),
    ].join('\n'),
    data: result,
  };
}

async function continueOrAbort(
  repoPath: string,
  git: GitClient,
  state: FlowConfigState,
  controlAction: FlowControlAction,
): Promise<FlowActionResult> {
  const finishState = await readFinishState(git);
  if (!finishState) {
    throw new Error('No in-progress git_flow finish state found.');
  }

  if (controlAction === 'abort') {
    try {
      await git.raw(['merge', '--abort']);
    } catch {
      try {
        await git.raw(['rebase', '--abort']);
      } catch {
        // best effort
      }
    }
    await checkoutRefIfNeeded(git, finishState.originalBranch);
    await clearFinishState(git);
    return {
      markdown: `Aborted finish for ${finishState.branchName}.`,
      data: {
        aborted: true,
        state: finishState,
      },
    };
  }

  const topic = getTopicDefinition(state, finishState.topic);
  const result = await executeFinishStages(repoPath, git, state, topic, finishState, {});
  return {
    markdown: result.completed
      ? `Resumed and completed finish for ${finishState.branchName}.`
      : `Finish for ${finishState.branchName} is still blocked at ${result.state?.stage}.`,
    data: result,
  };
}

async function runTopicOperation(
  repoPath: string,
  git: GitClient,
  state: FlowConfigState,
  topicAction: FlowTopicAction,
  topic: FlowTopicDefinition,
  options: FlowOptions,
): Promise<FlowActionResult> {
  switch (topicAction) {
    case 'start':
      return startTopic(repoPath, git, state, topic, options);
    case 'list':
      return listTopic(git, topic, options);
    case 'publish':
      return publishTopic(repoPath, git, state, topic, options);
    case 'checkout':
      return checkoutTopic(git, state, topic, options);
    case 'track':
      return trackTopic(repoPath, git, state, topic, options);
    case 'rename':
      return renameTopic(git, state, topic, options);
    case 'delete':
      return deleteTopic(repoPath, git, state, topic, options);
    case 'update':
      return updateTopic(repoPath, git, state, topic, options);
    case 'finish':
      return finishTopic(repoPath, git, state, topic, options);
  }
}

async function runOverviewOperation(git: GitClient, state: FlowConfigState): Promise<FlowActionResult> {
  const overview = await buildOverview(git, state);
  return {
    markdown: renderOverview(overview),
    data: overview,
  };
}

async function runConfigOperation(
  git: GitClient,
  state: FlowConfigState,
  options: FlowOptions,
  configAction: FlowConfigAction | undefined,
): Promise<FlowActionResult> {
  if (!configAction) {
    throw new Error('configAction is required for operation="config".');
  }
  return mutateConfig(git, state, options, configAction);
}

async function runTopicDispatch(
  repoPath: string,
  git: GitClient,
  state: FlowConfigState,
  options: FlowOptions,
  topicAction: FlowTopicAction | undefined,
  topicName: string | undefined,
): Promise<FlowActionResult> {
  if (!topicAction) {
    throw new Error('topicAction is required for operation="topic".');
  }
  const topic = getTopicDefinition(state, topicName);
  return runTopicOperation(repoPath, git, state, topicAction, topic, options);
}

async function runControlOperation(
  repoPath: string,
  git: GitClient,
  state: FlowConfigState,
  controlAction: FlowControlAction | undefined,
): Promise<FlowActionResult> {
  if (!controlAction) {
    throw new Error('controlAction is required for operation="control".');
  }
  return continueOrAbort(repoPath, git, state, controlAction);
}

export async function runFlowAction(repoPath: string, options: FlowOptions): Promise<FlowActionResult> {
  const git = getGit(repoPath);
  const normalized = normalizeRequest(options);

  if (normalized.operation === 'init') {
    return initializeFlow(git, options);
  }

  const state = await getFlowConfigState(git, options);

  switch (normalized.operation) {
    case 'overview':
      return runOverviewOperation(git, state);
    case 'config':
      return runConfigOperation(git, state, options, normalized.configAction);
    case 'topic':
      return runTopicDispatch(repoPath, git, state, options, normalized.topicAction, normalized.topic);
    case 'control':
      return runControlOperation(repoPath, git, state, normalized.controlAction);
  }
}
